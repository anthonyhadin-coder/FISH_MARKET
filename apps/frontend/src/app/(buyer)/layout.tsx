'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading, logout } = useAuth();
    const router = useRouter();

    React.useEffect(() => {
        if (!isLoading && (!user || user.role !== 'buyer')) {
            router.replace('/login');
        }
    }, [user, isLoading, router]);

    if (isLoading || !user) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-ocean-200 border-t-ocean-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-100 p-4 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <h1 className="text-xl font-black text-ocean-950 flex items-center gap-2">
                        🐟 Marketplace
                    </h1>
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-bold text-gray-500">{user.name}</span>
                        <button 
                            onClick={logout}
                            className="text-xs font-black text-coral-500 uppercase tracking-widest hover:text-coral-600 transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>
            <main className="max-w-7xl mx-auto p-4 md:p-8">
                {children}
            </main>
        </div>
    );
}
