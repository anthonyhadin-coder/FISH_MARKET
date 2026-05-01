import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { offlineStorage, PendingSaleData } from './offlineStorage';

describe('offlineStorage robustness tests', () => {
    
    // Sample offline catch entry
    const mockSale: PendingSaleData = {
        type: 'sale',
        payload: {
            boatId: 1,
            fishName: 'Tuna',
            weight: 50,
            rate: 200,
        }
    };

    beforeEach(async () => {
        // Purge DB before each test to ensure a clean slate
        const sales = await offlineStorage.getPendingSales();
        for (const sale of sales) {
            if (sale.id) {
                await offlineStorage.removeSale(sale.id);
            }
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should add a pending sale and retrieve it', async () => {
        const id = await offlineStorage.addPendingSale(mockSale);
        expect(id).toBeGreaterThan(0);

        const sales = await offlineStorage.getPendingSales();
        expect(sales).toHaveLength(1);
        expect(sales[0].id).toBe(id);
        expect(sales[0].data).toEqual(mockSale);
        expect(sales[0].status).toBe('pending');
        expect(sales[0].tempId).toBeDefined();
    });

    it('should smoothly simulate status updates on severe network drop', async () => {
        // Agent adds sale while completely offline
        const id = await offlineStorage.addPendingSale(mockSale);

        // Background worker tries to sync but receives a network drop
        await offlineStorage.updateStatus(id, 'failed', 'Network Error: ERR_INTERNET_DISCONNECTED');

        const sales = await offlineStorage.getPendingSales();
        expect(sales[0].status).toBe('failed');
        expect(sales[0].error).toBe('Network Error: ERR_INTERNET_DISCONNECTED');
    });

    it('should simulate successful network recovery and queue purge', async () => {
        const id = await offlineStorage.addPendingSale(mockSale);

        // Pretend network came back and background worker began syncing
        await offlineStorage.updateStatus(id, 'syncing');

        // Target API returns 201 Created, so worker removes it from queue
        await offlineStorage.removeSale(id);

        const sales = await offlineStorage.getPendingSales();
        expect(sales).toHaveLength(0);
    });

    it('should handle simultaneous offline operations seamlessly', async () => {
        // Mocking a busy agent totally offline, capturing 5 catches very fast
        const promises = [];
        for (let i = 0; i < 5; i++) {
            promises.push(offlineStorage.addPendingSale({
                type: 'sale',
                payload: { fishName: `Fish ${i}`, weight: 10 }
            }));
        }

        // Write all 5 concurrently
        const results = await Promise.all(promises);
        
        // Assert we have 5 distinct keys seamlessly without locks
        expect(results).toHaveLength(5);
        
        const sales = await offlineStorage.getPendingSales();
        expect(sales).toHaveLength(5);
    });
});
