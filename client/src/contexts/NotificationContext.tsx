import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAgent } from '@/app/(dashboard)/staff/_context/AgentContext';
import { useToast } from '@/components/ui/Toast';
import api from '@/lib/api';
import { AppNotification } from '@/lib/types';

interface NotificationContextType {
    notifications: AppNotification[];
    addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
    markAsRead: (id: string) => void;
    clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const { isSyncing, pendingCount, dailyReport, selectedBoat } = useAgent();
    const { toast } = useToast();
    const [lastPending, setLastPending] = useState(0);

    const fetchApiNotifications = useCallback(async () => {
        try {
            const res = await api.get('/notifications');
            const data = res.data;
            
            if (data && data.notifications && Array.isArray(data.notifications)) {
                // Map backend to local format with explicit types
                const apiNotifs: AppNotification[] = data.notifications.map((n: {
                    id: number | string;
                    title: string;
                    message?: string;
                    body?: string;
                    type?: string;
                    timestamp?: string;
                    created_at?: string;
                    read?: boolean;
                    is_read?: boolean;
                }) => ({
                    id: String(n.id),
                    title: n.title,
                    message: n.message || n.body || '',
                    type: (n.type as AppNotification['type']) || 'info',
                    timestamp: new Date(n.timestamp || n.created_at || Date.now()).getTime(),
                    read: Boolean(n.read || n.is_read)
                }));
                
                // Merge with existing local-only notifications (sync, targets)
                setNotifications(prev => {
                    const localOnly = prev.filter(p => p.id.toString().startsWith('loc_'));
                    // Sort descending by timestamp
                    const merged = [...apiNotifs, ...localOnly].sort((a, b) => b.timestamp - a.timestamp);
                    // Check for new API notifications to trigger toasts
                    apiNotifs.forEach((an: AppNotification) => {
                        const existing = prev.find(p => p.id === an.id);
                        if (!existing && !an.read) {
                            // @ts-expect-error - AppNotification type is compatible with Toast variant
                            toast(an.message, an.type);
                        }
                    });
                    return merged.slice(0, 50);
                });
            }
        } catch (err: unknown) {
            console.error("Failed to fetch notifications", err instanceof Error ? err.message : err);
        }
    }, [toast]);

    useEffect(() => {
        let cancelled = false;
        
        const fetch = async () => {
            if (!cancelled) await fetchApiNotifications();
        };

        fetch();
        const interval = setInterval(fetch, 30000); // poll every 30s
        
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [fetchApiNotifications]);

    const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
        const id = 'loc_' + Math.random().toString(36).substr(2, 9);
        const newN: AppNotification = { ...n, id, timestamp: Date.now(), read: false };
        setNotifications(prev => [newN, ...prev].slice(0, 50));
        // @ts-expect-error - AppNotification type is compatible with Toast variant
        toast(n.message, n.type);
    }, [toast]);

    const markAsRead = async (id: string | number) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        if (!String(id).startsWith('loc_')) {
            try {
                await api.patch(`/notifications/${id}/read`);
            } catch {
                // Ignore background task failure
            }
        }
    };

    const clearAll = async () => {
        setNotifications(prev => prev.filter(n => n.read === false)); // Or clear totally locally
        try {
            await api.patch('/notifications/read-all');
            void fetchApiNotifications();
        } catch {
            // Background task failure ignore
        }
    };

    // Monitor Sync Status
    useEffect(() => {
        if (lastPending > 0 && pendingCount === 0 && !isSyncing) {
            // Defer notification to avoid cascading render error
            setTimeout(() => {
                addNotification({
                    title: 'Sync Complete',
                    message: 'All offline data has been successfully synchronized.',
                    type: 'success'
                });
            }, 0);
        }
        if (pendingCount !== lastPending) {
            setTimeout(() => setLastPending(pendingCount), 0);
        }
    }, [pendingCount, isSyncing, lastPending, addNotification]);

    // Monitor Catch Targets
    useEffect(() => {
        if (dailyReport && selectedBoat) {
            const target = 100000; 
            if (dailyReport.totalSales >= target) {
                 const key = `notif_target_${selectedBoat.id}_${new Date().toDateString()}`;
                 if (!localStorage.getItem(key)) {
                    // Use a microtask to avoid synchronous render warning
                    Promise.resolve().then(() => {
                        addNotification({
                            title: 'Target Met! 🎯',
                            message: `Boat ${selectedBoat.name} has reached its daily catch target of ${target}!`,
                            type: 'info'
                        });
                    });
                    localStorage.setItem(key, 'true');
                 }
            }
        }
    }, [dailyReport, selectedBoat, addNotification]);

    return (
        <NotificationContext.Provider value={{ notifications, addNotification, markAsRead, clearAll }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotifications must be used within NotificationProvider');
    return context;
};
