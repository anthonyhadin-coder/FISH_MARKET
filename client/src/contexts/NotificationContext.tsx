"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAgent } from '@/app/(dashboard)/staff/_context/AgentContext';
import { useToast } from '@/components/ui/Toast';

import api from '@/lib/api';

interface AppNotification {
    id: string | number;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    timestamp: number;
    read: boolean;
}

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
                // Map backend to local format
                const apiNotifs = data.notifications.map((n: any) => ({
                    id: String(n.id),
                    title: n.title,
                    message: n.message || n.body, // handle both client/server naming
                    type: n.type || 'info',
                    timestamp: new Date(n.timestamp || n.created_at).getTime(),
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
                            toast(an.message, an.type as any);
                        }
                    });
                    return merged.slice(0, 50);
                });
            }
        } catch (err) {
            console.error("Failed to fetch notifications");
        }
    }, [toast]);

    useEffect(() => {
        fetchApiNotifications();
        const interval = setInterval(fetchApiNotifications, 30000); // poll every 30s
        return () => clearInterval(interval);
    }, [fetchApiNotifications]);

    const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
        const id = 'loc_' + Math.random().toString(36).substr(2, 9);
        const newN: AppNotification = { ...n, id, timestamp: Date.now(), read: false };
        setNotifications(prev => [newN, ...prev].slice(0, 50));
        toast(n.message, n.type as any);
    }, [toast]);

    const markAsRead = async (id: string | number) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        if (!String(id).startsWith('loc_')) {
            try {
                await api.patch(`/notifications/${id}/read`);
            } catch (err) {}
        }
    };

    const clearAll = async () => {
        setNotifications(prev => prev.filter(n => n.read === false)); // Or clear totally locally
        try {
            await api.patch('/notifications/read-all');
            fetchApiNotifications();
        } catch (err) {}
    };

    // Monitor Sync Status
    useEffect(() => {
        if (lastPending > 0 && pendingCount === 0 && !isSyncing) {
            addNotification({
                title: 'Sync Complete',
                message: 'All offline data has been successfully synchronized.',
                type: 'success'
            });
        }
        setLastPending(pendingCount);
    }, [pendingCount, isSyncing, lastPending, addNotification]);

    // Monitor Catch Targets (Mock logic for now as targets aren't defined in DB yet)
    useEffect(() => {
        if (dailyReport && selectedBoat) {
            // Assume a target of 100,000 for demonstration if not set
            const target = 100000; 
            if (dailyReport.totalSales >= target) {
                 // Check if we already notified for this boat today
                 const key = `notif_target_${selectedBoat.id}_${new Date().toDateString()}`;
                 if (!localStorage.getItem(key)) {
                    addNotification({
                        title: 'Target Met! 🎯',
                        message: `Boat ${selectedBoat.name} has reached its daily catch target of ${target}!`,
                        type: 'info'
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
