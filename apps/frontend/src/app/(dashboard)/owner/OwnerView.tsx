"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { T } from '@/lib/i18n';
import { useToast } from '@/components/ui/Toast';
import { DashboardLayout } from '@/components/shared/DashboardLayout';
import { 
    BarChart3, Ship, History, Users, Mail
} from 'lucide-react';

import { OverviewTab } from './_components/OverviewTab';
import { BoatsTab } from './_components/BoatsTab';
import { SalariesTab } from './_components/SalariesTab';
import { BoatReportsTab } from './_components/BoatReportsTab';
import { SlipsTab } from './_components/SlipsTab';
import { OwnerReportsInbox } from '@/components/shared/OwnerReportsInbox';
import api from '@/lib/api';

export type OwnerTab = "overview" | "boats" | "salaries" | "reports" | "slips";

export default function OwnerView() {
    const { lang } = useLanguage();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setTimeout(() => setMounted(true), 0);
    }, []);
    
    const t = T[mounted ? lang : 'en'];
    
    const [tab, setTab] = useState<OwnerTab>("overview");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [unreadSlips, setUnreadSlips] = useState(0);
    const { toast } = useToast();

    React.useEffect(() => {
        const fetchUnread = async () => {
            try {
                const res = await api.get('/slips/unread-count');
                setUnreadSlips(res.data.count || 0);
            } catch (err: unknown) {
                const e = err as { response?: { status?: number } };
                // If it's a 403/401, don't toast every 30s as the interceptor handles it
                if (e.response?.status !== 401 && e.response?.status !== 403) {
                    toast("Failed to update unread notifications", "error");
                }
            }
        };
        fetchUnread();
        const intv = setInterval(fetchUnread, 30000); // 30s poll
        return () => clearInterval(intv);
    }, [toast]);

    const ownerLinks = [
        { href: '#overview', onClick: () => setTab("overview"), icon: BarChart3, label: t.performance, active: tab === "overview" },
        { href: '#boats',    onClick: () => setTab("boats"),    icon: Ship,        label: t.myBoats,     active: tab === "boats" },
        { 
            href: '#slips',    
            onClick: () => setTab("slips"),    
            icon: () => <div className="relative"><Mail className="w-5 h-5"/>{unreadSlips > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-white">{unreadSlips}</span>}</div>,
            label: lang === "ta" ? "ரசீதுகள்" : "Slips",     
            active: tab === "slips" 
        },
        { href: '#salaries', onClick: () => setTab("salaries"), icon: Users,       label: lang === "ta" ? "சம்பளம்" : "Salaries", active: tab === "salaries" },
        { href: '#reports',  onClick: () => setTab("reports"),  icon: History,     label: lang === "ta" ? "அறிக்கை" : "Reports",  active: tab === "reports" },
    ];

    const renderTab = () => {
        switch (tab) {
            case "overview": return <OverviewTab date={date} setDate={setDate} setTab={setTab} />;
            case "boats":    return <BoatsTab />;
            case "slips":    return <SlipsTab />;
            case "salaries": return <SalariesTab />;
            case "reports":  return (
                <div className="space-y-6">
                    <OwnerReportsInbox lang={lang as 'en' | 'ta'} />
                    <BoatReportsTab />
                </div>
            );
            default:         return <OverviewTab date={date} setDate={setDate} setTab={setTab} />;
        }
    };

    const tabTitles: Record<OwnerTab, string> = {
        overview: t.performance,
        boats: t.myBoats,
        salaries: t.salaries,
        reports: t.reports,
        slips: lang === "ta" ? "ரசீதுகள்" : "Slips"
    };

    return (
        <div className="owner-theme min-h-screen">
        <DashboardLayout 
            title={tabTitles[tab]} 
            roleLinks={ownerLinks}
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {renderTab()}
                </motion.div>
            </AnimatePresence>
        </DashboardLayout>
        </div>
    );
}
