import { useState, useEffect } from 'react';
import api from '../lib/api';

export function usePushNotifications() {
    const [permission, setPermission] = useState<NotificationPermission>(
        typeof window !== 'undefined' ? Notification.permission : 'default'
    );
    const [subscribed, setSubscribed] = useState(false);
    const [loading, setLoading] = useState(false);

    /**
     * Helper: Convert VAPID key
     */
    function urlBase64ToUint8Array(base64String: string): Uint8Array {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    /**
     * Subscribe to push notifications
     */
    const subscribe = async () => {
        setLoading(true);
        try {
            // 1. Request permission
            const perm = await Notification.requestPermission();
            setPermission(perm);

            if (perm !== 'granted') {
                throw new Error('Notification permission denied');
            }

            // 2. Get service worker registration
            const registration = await navigator.serviceWorker.ready;

            // 3. Subscribe to push
            const vapidPublicKey = (import.meta as any).env.VITE_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) {
                throw new Error('VITE_VAPID_PUBLIC_KEY is not defined');
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as any
            });

            // 4. Save to backend
            const subJSON = subscription.toJSON();
            await api.post('/notifications/subscribe', {
                endpoint: subJSON.endpoint,
                keys: subJSON.keys,
                device_info: navigator.userAgent
            });

            setSubscribed(true);
            // Push notifications enabled
        } catch (err) {
            console.error('Push subscription failed:', err);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Unsubscribe
     */
    const unsubscribe = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // Remove from backend first
                await api.post('/notifications/unsubscribe', {
                    endpoint: subscription.endpoint
                });
                
                // Then unsubscribe browser
                await subscription.unsubscribe();
                setSubscribed(false);
                // Push notifications disabled
            }
        } catch (err) {
            console.error('Push unsubscription failed:', err);
        }
    };

    /**
     * Check existing subscription on mount
     */
    useEffect(() => {
        const check = async () => {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                setSubscribed(!!subscription);
            }
        };
        check();
    }, []);

    return {
        permission,
        subscribed,
        loading,
        subscribe,
        unsubscribe
    };
}
