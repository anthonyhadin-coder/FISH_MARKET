"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.push('/login');
            } else if (user.role !== 'owner' && user.role !== 'admin') {
                router.push(user.role === 'agent' ? '/agent' : '/');
            } else {
                setIsAuthorized(true);
            }
        }
    }, [user, isLoading, router]);

    if (isLoading || !isAuthorized) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50/50 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-ocean-600" />
                <p className="text-xs font-black uppercase tracking-[0.2em] text-ocean-900">Checking Access...</p>
            </div>
        );
    }

    return <>{children}</>;
}
