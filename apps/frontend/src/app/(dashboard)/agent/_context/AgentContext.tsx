import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { offlineStorage } from '@/lib/offlineStorage';
import { Boat, DailyReport, Buyer, ApiError } from '@fishmarket/shared-types';

interface AgentContextType {
    boats: Boat[];
    selectedBoat: Boat | null;
    setSelectedBoat: (boat: Boat | null) => void;
    buyers: Buyer[];
    dailyReport: DailyReport | null;
    refreshDailyReport: () => Promise<void>;
    refreshBoats: () => Promise<void>;
    refreshBuyers: () => Promise<void>;
    isLoading: boolean;
    isOnline: boolean;
    isSyncing: boolean;
    pendingCount: number;
    syncOfflineData: () => Promise<void>;
    error: string | null;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export const AgentProvider = ({ children }: { children: React.ReactNode }) => {
    const { user, isLoading: authLoading } = useAuth();
    const [boats, setBoats] = useState<Boat[]>([]);
    const [selectedBoat, setSelectedBoat] = useState<Boat | null>(null);
    const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const selectedBoatRef = useRef(selectedBoat);
    useEffect(() => { selectedBoatRef.current = selectedBoat; }, [selectedBoat]);

    const [buyers, setBuyers] = useState<Buyer[]>([]);

    const fetchBoats = useCallback(async () => {
        if (!user || authLoading) return;
        setIsLoading(true);
        try {
            const res = await api.get('/boats');
            setBoats(res.data);
            if (res.data.length > 0 && !selectedBoatRef.current) {
                const cachedBoatId = localStorage.getItem('selectedBoatId');
                const cachedBoat = cachedBoatId ? res.data.find((b: Boat) => b.id.toString() === cachedBoatId) : null;
                setSelectedBoat(cachedBoat || res.data[0]);
            }
        } catch (err: unknown) {
            const error = err as ApiError;
            if (error.response?.status !== 401) {
                setError(error.response?.data?.message || 'Failed to fetch boats');
            }
        } finally {
            setIsLoading(false);
        }
    }, [user, authLoading]);

    const fetchBuyers = useCallback(async () => {
        if (!user || authLoading) return;
        try {
            const res = await api.get('/buyers');
            setBuyers(res.data);
        } catch (err: unknown) {
            if (err?.response?.status !== 401) {
                console.error("Failed to fetch buyers", err instanceof Error ? err.message : err);
            }
        }
    }, [user, authLoading]);

    const refreshDailyReport = useCallback(async () => {
        if (!selectedBoat || !user || authLoading) return;
        try {
            const res = await api.get(`/reports/daily?boatId=${selectedBoat.id}`);
            setDailyReport(res.data);
            setError(null);
        } catch (err: unknown) {
            const error = err as ApiError;
            if (error.response?.status !== 401) {
                setError(error.response?.data?.message || 'Failed to fetch daily report');
            }
        }
    }, [selectedBoat, user, authLoading]);

    const syncOfflineData = useCallback(async () => {
        if (!navigator.onLine || isSyncing) return;
        const pending = await offlineStorage.getPendingSales();
        if (pending.length === 0) {
            setPendingCount(0);
            return;
        }

        setIsSyncing(true);
        
        for (const item of pending) {
            try {
                await offlineStorage.updateStatus(item.id!, 'syncing');
                // Use record type for generic payload mapping
                const data = (item.data || {}) as Record<string, unknown>;
                const type = data.type as string;
                const payload = data.payload as unknown; // payload can be many shapes
                const id = (data.id || data.buyerId) as string | number;

                if (type === 'sale') await api.post('/sales', payload);
                else if (type === 'payment') await api.post('/boat-payments', payload);
                else if (type === 'update-sale') await api.patch(`/sales/${id}`, payload);
                else if (type === 'delete-sale') await api.delete(`/sales/${id}`);
                else if (type === 'delete-payment') await api.delete(`/boat-payments/${id}`);
                else if (type === 'buyer') await api.post('/buyers', payload);
                else if (type === 'buyer-payment') await api.post(`/buyers/${id}/payments`, { amount: data.amount });
                else if (type === 'add-boat') await api.post('/boats', payload);
                
                await offlineStorage.removeSale(item.id!);
            } catch (err) {
                console.error("Global sync failed for item", item.id, err instanceof Error ? err.message : err);
                await offlineStorage.updateStatus(item.id!, 'failed', "Sync error");
            }
        }
        
        const remaining = await offlineStorage.getPendingSales();
        setPendingCount(remaining.length);
        setIsSyncing(false);
        
        if (remaining.length === 0) {
            void fetchBoats();
            void refreshDailyReport();
        }
    }, [fetchBoats, refreshDailyReport, isSyncing]);

    useEffect(() => {
        const handleOnline = () => { setIsOnline(true); void syncOfflineData(); };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        // Initial check
        offlineStorage.getPendingSales().then(p => setPendingCount(p.length));
        if (navigator.onLine) {
            setTimeout(() => { void syncOfflineData(); }, 1000);
        }

        const interval = setInterval(() => {
            offlineStorage.getPendingSales().then(p => setPendingCount(p.length));
        }, 5000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, [syncOfflineData]);

    useEffect(() => {
        if (user && user.role === 'agent') {
            void fetchBoats();
            void fetchBuyers();
        }
    }, [user, fetchBoats, fetchBuyers]);

    useEffect(() => {
        if (selectedBoat) {
            void refreshDailyReport();
        } else {
            setDailyReport(null);
        }
    }, [selectedBoat, refreshDailyReport]);

    // Keep localStorage in sync
    useEffect(() => {
        if (selectedBoat) {
            localStorage.setItem('selectedBoatId', selectedBoat.id.toString());
        }
    }, [selectedBoat]);

    return (
        <AgentContext.Provider 
            value={{ 
                boats, 
                selectedBoat, 
                setSelectedBoat, 
                buyers,
                dailyReport, 
                refreshDailyReport,
                refreshBoats: fetchBoats,
                refreshBuyers: fetchBuyers,
                isLoading, 
                isOnline,
                isSyncing,
                pendingCount,
                syncOfflineData,
                error 
            }}
        >
            {children}
        </AgentContext.Provider>
    );
};

export const useAgent = () => {
    const context = useContext(AgentContext);
    if (context === undefined) {
        throw new Error('useAgent must be used within an AgentProvider');
    }
    return context;
};
