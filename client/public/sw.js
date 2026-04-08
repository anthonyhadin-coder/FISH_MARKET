const CACHE_NAME = 'fish-market-v5';
const API_CACHE_NAME = 'api-cache'; // CLEANUP 8: separate named bucket for API responses
const API_CACHE_MAX = 50;           // CLEANUP 8: hard limit on cached API entries
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
];

// CLEANUP 8: Only cache safe, non-sensitive GET endpoints.
// /api/reports is excluded because it contains private financial data.
const CACHEABLE_API_PREFIXES = ['/api/config', '/api/lookup', '/api/fish'];
const UNCACHEABLE_API_PATTERNS = ['/api/reports', '/api/auth'];

function isCacheableApiUrl(url) {
  const path = new URL(url).pathname;
  if (UNCACHEABLE_API_PATTERNS.some((p) => path.startsWith(p))) return false;
  return CACHEABLE_API_PREFIXES.some((p) => path.startsWith(p));
}

// ── INSTALL ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// ── ACTIVATE ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.map((name) => {
          // Purge old versioned shell caches but keep api-cache across activations
          if (name !== CACHE_NAME && name !== API_CACHE_NAME) {
            return caches.delete(name);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// ────────────────────────────────────────────────────────────────────────────
// FIX 2: OFFLINE MUTATION QUEUE (IndexedDB + Background Sync)
// ────────────────────────────────────────────────────────────────────────────
// When a mutating request (POST/PATCH/DELETE) is made while the device is
// offline the full request is serialised to IndexedDB.  A Background Sync tag
// is registered so the queue is replayed automatically once connectivity
// returns.  If the Background Sync API is not supported, a focus-based
// setInterval fallback polls the queue.
//
// A request is only removed from the queue once the server replies HTTP 2xx,
// ensuring no mutation is silently dropped.

const IDB_NAME    = 'fm-offline-queue';
const IDB_VERSION = 1;
const IDB_STORE   = 'mutations';

/** Open (or create) the IndexedDB queue database */
function openQueueDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        // id is auto-incremented so entries replay in insertion order
        db.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/** Persist a serialised mutation to the queue */
async function enqueueMutation(entry) {
  const db    = await openQueueDb();
  const tx    = db.transaction(IDB_STORE, 'readwrite');
  const store = tx.objectStore(IDB_STORE);
  return new Promise((resolve, reject) => {
    const req = store.add(entry);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/** Read all pending mutations in insertion order */
async function getAllMutations() {
  const db    = await openQueueDb();
  const tx    = db.transaction(IDB_STORE, 'readonly');
  const store = tx.objectStore(IDB_STORE);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/** Remove a successfully replayed mutation by its auto-id */
async function dequeueById(id) {
  const db    = await openQueueDb();
  const tx    = db.transaction(IDB_STORE, 'readwrite');
  const store = tx.objectStore(IDB_STORE);
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Replay every queued mutation sequentially.
 * A request is only dequeued once the server responds 2xx.
 * Non-2xx responses are left in the queue to be retried later.
 */
async function flushMutationQueue() {
  const mutations = await getAllMutations();
  for (const mutation of mutations) {
    try {
      const { id, url, method, headers, body } = mutation;
      const response = await fetch(url, {
        method,
        headers,
        body: body ?? undefined,
        credentials: 'include', // ensure HttpOnly cookies are sent
      });
      if (response.ok) {
        await dequeueById(id);
        console.log(`[SW] Replayed offline mutation: ${method} ${url}`);
      } else {
        console.warn(`[SW] Mutation replay got ${response.status}, keeping in queue.`);
      }
    } catch (err) {
      console.error('[SW] Mutation replay failed, keeping in queue:', err);
    }
  }
}

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith('http')) return;

  const method = event.request.method;

  // ── FIX 2: Intercept non-GET mutations while offline ──────────────────────
  if (method !== 'GET') {
    // We only queue mutations — pass online requests straight through
    // (we check navigator.onLine which is available inside SW)
    if (!navigator.onLine) {
      event.respondWith(
        (async () => {
          // Serialise: body can only be read once, so clone first
          let bodyText = null;
          try {
            bodyText = await event.request.clone().text();
          } catch {
            // body may be empty or unreadable — that's fine
          }

          const entry = {
            url    : event.request.url,
            method : event.request.method,
            headers: Object.fromEntries(event.request.headers.entries()),
            body   : bodyText || null,
            timestamp: Date.now(),
          };

          await enqueueMutation(entry);

          // Register Background Sync so Chrome replays automatically on reconnect.
          // If the API is unavailable, the setInterval fallback (see below) handles it.
          if (self.registration.sync) {
            try {
              await self.registration.sync.register('sync-mutations');
            } catch {
              // Background Sync not supported — fallback handles replay
            }
          }

          // Return a synthetic 202 Accepted so the calling code knows the
          // request was accepted for later delivery rather than silently dropped.
          return new Response(
            JSON.stringify({ queued: true, message: 'Saved offline — will sync when back online.' }),
            { status: 202, headers: { 'Content-Type': 'application/json' } }
          );
        })()
      );
    }
    // Online → fall through to the network normally (no caching for mutations)
    return;
  }

  // ── CLEANUP 8: API GET requests — Network-First with selective caching ─────
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(async (networkResponse) => {
          // Only cache safe, non-sensitive endpoints (excludes /api/reports)
          if (
            networkResponse.ok &&
            isCacheableApiUrl(event.request.url)
          ) {
            const responseToCache = networkResponse.clone();
            const cache = await caches.open(API_CACHE_NAME);
            await cache.put(event.request, responseToCache);
            // CLEANUP 8: Trim cache to max 50 entries to avoid unbounded disk use
            await trimCache(API_CACHE_NAME, API_CACHE_MAX);
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request)) // offline: serve stale
    );
    return;
  }

  // ── STANDARD ASSETS — Stale-While-Revalidate ─────────────────────────────
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) =>
              cache.put(event.request, responseToCache)
            );
          }
          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') return caches.match('/');
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// ── FIX 2: Background Sync handler ───────────────────────────────────────────
// Triggered automatically by the browser when connectivity is restored.
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-mutations') {
    event.waitUntil(flushMutationQueue());
  }
});

// ── FIX 2 FALLBACK: setInterval-based retry for browsers without Background Sync
// Triggered when a client window gains focus — a practical proxy for "user
// is back online" without relying on native Background Sync support.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'PAGE_FOCUS_RETRY') {
    flushMutationQueue().catch(console.error);
  }
  // CLEANUP 8: On logout, purge the sensitive API cache from disk.
  if (event.data?.type === 'PURGE_API_CACHE') {
    caches.delete(API_CACHE_NAME).then(() =>
      console.log('[SW] API cache purged after logout.')
    );
  }
});

// ── CLEANUP 8: Utility — trim a cache to at most `maxEntries` entries ────────
// Removes the oldest entries (FIFO) when the limit is exceeded.
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys  = await cache.keys();
  if (keys.length > maxEntries) {
    const excess = keys.slice(0, keys.length - maxEntries);
    await Promise.all(excess.map((key) => cache.delete(key)));
  }
}

// ── PUSH/NOTIFICATION handlers (unchanged from original) ─────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); }
  catch (e) { console.error('Push data is not JSON:', event.data.text()); return; }

  const options = {
    body   : data.body,
    icon   : data.icon  || '/icon-192.png',
    badge  : data.badge || '/icon-192.png',
    vibrate: [200, 100, 200],
    tag    : data.type  || 'fish-market',
    renotify: true,
    data   : { url: data.url || '/', type: data.type, timestamp: data.timestamp || Date.now() },
    actions: getActions(data.type),
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Fish Market', options)
  );
});

function getActions(type) {
  switch (type) {
    case 'report_ready':    return [{ action: 'view', title: '👁 View Report' }, { action: 'dismiss', title: '✕ Dismiss' }];
    case 'report_approved': return [{ action: 'view', title: '📄 View' }];
    case 'report_rejected': return [{ action: 'view', title: '🔍 See Reason' }];
    default: return [];
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin) {
          client.focus();
          if ('navigate' in client) return client.navigate(url);
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
