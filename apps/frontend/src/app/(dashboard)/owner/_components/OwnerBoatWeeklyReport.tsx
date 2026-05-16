import React, { useState, useEffect } from 'react';
import { fetchOwnerBoatWeeklyReport, fetchAllBoatsAdmin, AdminBoat } from '@/lib/api/adminApi';
import { useLanguage } from '@/contexts/LanguageContext';
import { T, Language } from '@/lib/i18n';
import { useToast } from '@/components/ui/Toast';
import { SharedBoatWeeklyReport } from '@/components/shared/SharedBoatWeeklyReport';

export function OwnerBoatWeeklyReport() {
    const { lang } = useLanguage();
    const t = T[lang as Language];
    const { toast } = useToast();
    const [boats, setBoats] = useState<AdminBoat[]>([]);

    useEffect(() => {
        fetchAllBoatsAdmin().then(res => {
            setBoats(res);
        }).catch(() => toast("Failed to load boats", "error"));
    }, [toast]);

    return (
        <SharedBoatWeeklyReport 
            role="owner"
            lang={lang}
            boats={boats}
            fetchReport={fetchOwnerBoatWeeklyReport}
            t={t}
        />
    );
}
