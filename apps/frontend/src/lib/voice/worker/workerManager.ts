/**
 * workerManager.ts — Singleton NLP Worker Manager
 *
 * Manages the lifecycle of a single NLP Web Worker instance:
 *   - Lazy creation (worker is spawned on first use)
 *   - Request/response correlation by requestId
 *   - Per-request timeouts (default 3 000 ms)
 *   - Automatic restart on worker crash
 *   - Sync-parser fallback when workers are not supported
 *   - Cancellation via the CANCEL message
 *
 * Usage:
 *   const results = await nlpWorkerManager.parse(transcript, lang, opts);
 *
 * The manager is a plain object singleton — it survives React
 * renders without being re-created.
 */

import type {
  ParseRequest,
  WorkerResponse,
} from '../types/workerProtocol';
import { parseVoiceInput } from '../voiceParser';
import type { ParsedVoiceResult } from '../voiceParser';

// ── Types ─────────────────────────────────────────────────────────

interface PendingRequest {
  resolve: (results: ParsedVoiceResult[]) => void;
  reject: (reason: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
  onTelemetry?: (t: WorkerTelemetryPayload) => void;
}

export interface WorkerTelemetryPayload {
  requestId: string;
  totalDurationMs: number;
  fuzzyMatchDurationMs: number;
  tamilParserDurationMs: number;
  transcriptLength: number;
  resultCount: number;
  topConfidence: number;
  failedParse: boolean;
  wasCancelled: boolean;
  usedFallback: boolean;
}

export interface ParseOptions {
  fishList?: string[];
  buyerList?: string[];
  timeoutMs?: number;
  onTelemetry?: (t: WorkerTelemetryPayload) => void;
}

// ── Worker support detection ──────────────────────────────────────

function workersSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof Worker !== 'undefined'
  );
}

// ── Singleton manager ─────────────────────────────────────────────

class NlpWorkerManager {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingRequest>();
  private ready = false;
  private restartCount = 0;
  private readonly MAX_RESTARTS = 3;
  private readonly DEFAULT_TIMEOUT_MS = 3_000;

  // ── Lazy worker initialisation ─────────────────────────────────
  private initWorker(): void {
    if (!workersSupported()) return;

    // Next.js ≥13: use new Worker(new URL(...), { type: 'module' })
    // to get bundled + tree-shaken worker code.
    this.worker = new Worker(
      new URL('./nlpWorker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleMessage(event.data);
    };

    this.worker.onerror = (err: ErrorEvent) => {
      console.error('[NlpWorker] Crashed:', err.message);
      this.handleWorkerCrash();
    };
  }

  // ── Message handler ────────────────────────────────────────────
  private handleMessage(msg: WorkerResponse): void {
    if (msg.type === 'WORKER_READY') {
      this.ready = true;
      return;
    }

    const { requestId } = msg;
    const pending = this.pending.get(requestId);
    if (!pending) return; // already timed out or cancelled

    clearTimeout(pending.timeoutId);
    this.pending.delete(requestId);

    if (msg.type === 'PARSE_SUCCESS') {
      pending.onTelemetry?.({
        requestId,
        ...msg.telemetry,
        usedFallback: false,
      });
      pending.resolve(msg.results);
    } else {
      // PARSE_ERROR — includes cancellations
      pending.onTelemetry?.({
        requestId,
        ...msg.telemetry,
        usedFallback: false,
      });
      pending.reject(new Error(msg.error));
    }
  }

  // ── Worker crash recovery ──────────────────────────────────────
  private handleWorkerCrash(): void {
    this.ready = false;
    this.worker = null;

    // Reject all in-flight requests
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Worker crashed'));
      this.pending.delete(id);
    }

    if (this.restartCount < this.MAX_RESTARTS) {
      this.restartCount++;
      this.initWorker();
    } else {
      console.error('[NlpWorker] Max restarts reached — falling back to sync parser permanently.');
    }
  }

  // ── Sync fallback ──────────────────────────────────────────────
  private syncFallback(
    transcript: string,
    lang: 'ta' | 'en',
    options: ParseOptions,
  ): ParsedVoiceResult[] {
    const t0 = performance.now();
    const results = parseVoiceInput(transcript, lang, {
      fishList: options.fishList,
      buyerList: options.buyerList,
    });
    const durationMs = performance.now() - t0;

    options.onTelemetry?.({
      requestId: 'sync-fallback',
      totalDurationMs: durationMs,
      fuzzyMatchDurationMs: durationMs * 0.4,
      tamilParserDurationMs: durationMs * 0.2,
      transcriptLength: transcript.length,
      resultCount: results.length,
      topConfidence: results.find(r => r.type === 'SALE')?.confidence?.total ?? 0,
      failedParse: results.filter(r => r.type === 'SALE').length === 0,
      wasCancelled: false,
      usedFallback: true,
    });

    return results;
  }

  // ── Public API ─────────────────────────────────────────────────

  /** Parse a transcript asynchronously via the worker. */
  async parse(
    transcript: string,
    lang: 'ta' | 'en',
    options: ParseOptions = {},
  ): Promise<ParsedVoiceResult[]> {
    // If workers aren't supported or we've exceeded restart limit → sync
    if (!workersSupported() || this.restartCount >= this.MAX_RESTARTS) {
      return this.syncFallback(transcript, lang, options);
    }

    // Lazy init on first call
    if (!this.worker) {
      this.initWorker();
    }

    const requestId = crypto.randomUUID();
    const timeoutMs = options.timeoutMs ?? this.DEFAULT_TIMEOUT_MS;

    return new Promise<ParsedVoiceResult[]>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pending.has(requestId)) {
          this.pending.delete(requestId);
          // Ask the worker to discard any result it was computing
          this.worker?.postMessage({ type: 'CANCEL', requestId });
          // Fall back to sync so the UI still gets a result
          resolve(this.syncFallback(transcript, lang, { ...options, onTelemetry: options.onTelemetry }));
        }
      }, timeoutMs);

      this.pending.set(requestId, {
        resolve,
        reject,
        timeoutId,
        onTelemetry: options.onTelemetry,
      });

      const request: ParseRequest = {
        type: 'PARSE',
        requestId,
        transcript,
        lang,
        options: {
          fishList: options.fishList,
          buyerList: options.buyerList,
        },
      };

      this.worker!.postMessage(request);
    });
  }

  /** Cancel an in-flight request by ID (best-effort). */
  cancel(requestId: string): void {
    const pending = this.pending.get(requestId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      this.pending.delete(requestId);
      this.worker?.postMessage({ type: 'CANCEL', requestId });
      pending.reject(new Error('cancelled'));
    }
  }

  /** Terminate the worker (e.g. on page unload or test teardown). */
  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.pending.clear();
  }
}

// ── Singleton export ──────────────────────────────────────────────
export const nlpWorkerManager = new NlpWorkerManager();

// Terminate cleanly when the page is unloaded (prevents zombie workers)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => nlpWorkerManager.terminate());
}
