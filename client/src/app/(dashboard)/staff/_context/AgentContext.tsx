import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { offlineStorage } from '@/lib/offlineStorage';

export interface Boat {
    id: number;
    name: string;
    owner_id: number;
    agent_id: number;
    ownerPhone?: string;
}

export interface DailyReport {
    date: string;
    totalSales: number;
    totalExpenses: number;
    expenseBreakdown?: { type: string; total: number; notes?: string }[];
    boatPayments: number;
    cashWithAgent: number;
    boatProfit: number;
}

interface AgentContextType {
    boats: Boat[];
    selectedBoat: Boat | null;
    setSelectedBoat: (boat: Boat | null) => void;
    buyers: any[];
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
    const { user } = useAuth();
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

    const [buyers, setBuyers] = useState<any[]>([]);

    const fetchBoats = useCallback(async () => {
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
            const error = err as { response?: { data?: { message?: string } } };
            setError(error.response?.data?.message || 'Failed to fetch boats');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchBuyers = useCallback(async () => {
        try {
            const res = await api.get('/buyers');
            setBuyers(res.data);
        } catch (err) {
            console.error("Failed to fetch buyers", err);
        }
    }, []);

    const refreshDailyReport = useCallback(async () => {
        if (!selectedBoat) return;
        try {
            const res = await api.get(`/reports/daily?boatId=${selectedBoat.id}`);
            setDailyReport(res.data);
            setError(null);
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            setError(error.response?.data?.message || 'Failed to fetch daily report');
        }
    }, [selectedBoat]);

    const syncOfflineData = useCallback(async () => {
        if (!navigator.onLine || isSyncing) return;
        const pending = await offlineStorage.getPendingSales();
        if (pending.length === 0) {
            setPendingCount(0);
            return;
        }

        setIsSyncing(true);
        // Global Sync
        
        for (const item of pending) {
            try {
                await offlineStorage.updateStatus(item.id!, 'syncing');
                // Mapping payload types to API endpoints
                const data = item.data as any;
                const { type, payload } = data;
                const id = data.id || data.buyerId;

                if (type === 'sale') await api.post('/sales', payload);
                else if (type === 'payment') await api.post('/boat-payments', payload);
                else if (type === 'update-sale') await api.patch(`/sales/${id}`, payload);
                else if (type === 'delete-sale') await api.delete(`/sales/${id}`);
                else if (type === 'delete-payment') await api.delete(`/boat-payments/${id}`);
                else if (type === 'buyer') await api.post('/buyers', payload);
                else if (type === 'buyer-payment') await api.post(`/buyers/${id}/payments`, { amount: (item.data as any).amount });
                else if (type === 'add-boat') await api.post('/boats', payload);
                
                await offlineStorage.removeSale(item.id!);
            } catch (err) {
                console.error("Global sync failed for item", item.id, err);
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
            fetchBoats();
            fetchBuyers();
        }
    }, [user, fetchBoats, fetchBuyers]);

    useEffect(() => {
        if (selectedBoat) {
            refreshDailyReport();
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
