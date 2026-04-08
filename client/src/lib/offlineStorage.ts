/**
 * Lightweight IndexedDB wrapper for handling offline sales entries.
 */


export type PendingSaleData =
    | { type: 'sale'; payload: Record<string, unknown> }
    | { type: 'payment'; payload: Record<string, unknown> }
    | { type: 'update-sale'; id: string | number; payload: Record<string, unknown> }
    | { type: 'delete-sale'; id: string | number }
    | { type: 'delete-payment'; id: string | number }
    | { type: 'buyer'; payload: Record<string, unknown> }
    | { type: 'buyer-payment'; buyerId: string | number; amount: number }
    | { type: 'add-boat'; payload: Record<string, unknown> };

export interface PendingSale {
    id?: number;
    tempId: string;
    data: PendingSaleData;
    timestamp: number;
    status: 'pending' | 'syncing' | 'failed';
    error?: string;
}

const DB_NAME = 'FishMarketOffline';
const STORE_NAME = 'pendingSales';
const VERSION = 1;

class OfflineStorage {
    private db: IDBDatabase | null = null;

    private async getDB(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, VERSION);

            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = (event: Event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                resolve(this.db!);
            };

            request.onerror = (event: Event) => reject((event.target as IDBOpenDBRequest).error);
        });
    }

    async addPendingSale(data: PendingSaleData): Promise<number> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const pendingSale: PendingSale = {
                tempId: Math.random().toString(36).substring(7),
                data,
                timestamp: Date.now(),
                status: 'pending'
            };
            const request = store.add(pendingSale);
            request.onsuccess = () => resolve(request.result as number);
            request.onerror = () => reject(request.error);
        });
    }

    async getPendingSales(): Promise<PendingSale[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async removeSale(id: number): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async updateStatus(id: number, status: PendingSale['status'], error?: string): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const getReq = store.get(id);

            getReq.onsuccess = () => {
                const data = getReq.result;
                if (data) {
                    data.status = status;
                    if (error) data.error = error;
                    store.put(data);
                }
                resolve();
            };
            getReq.onerror = () => reject(getReq.error);
        });
    }
}

export const offlineStorage = new OfflineStorage();
