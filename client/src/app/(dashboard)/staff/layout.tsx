"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { AgentProvider } from './_context/AgentContext';
import { NotificationProvider } from '@/contexts/NotificationContext';

export default function AgentLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    const isAuthorized = !isLoading && user && (user.role === 'agent' || user.role === 'admin');

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.push('/login');
            } else if (user.role !== 'agent' && user.role !== 'admin') {
                router.push(user.role === 'owner' ? '/owner' : '/');
            }
        }
    }, [user, isLoading, router]);

    if (isLoading || !isAuthorized) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50/50 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-ocean-600" />
                <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean-900">Verifying Agent Session...</p>
            </div>
        );
    }

    return (
        <AgentProvider>
            <NotificationProvider>
                {children}
            </NotificationProvider>
        </AgentProvider>
    );
}
