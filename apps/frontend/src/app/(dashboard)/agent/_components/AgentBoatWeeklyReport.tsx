import React from 'react';
import { fetchAgentBoatWeeklyReport } from '@/lib/api/adminApi';
import { T_AGENT } from '../SharedUI';
import { SharedBoatWeeklyReport } from '@/components/shared/SharedBoatWeeklyReport';

interface AgentBoatWeeklyReportProps {
    lang: string;
    availBoats: { id: string | number; name: string }[];
}

export function AgentBoatWeeklyReport({ lang, availBoats }: AgentBoatWeeklyReportProps) {
    const t = T_AGENT[lang as 'en' | 'ta'];

    return (
        <SharedBoatWeeklyReport 
            role="agent"
            lang={lang}
            boats={availBoats}
            fetchReport={fetchAgentBoatWeeklyReport}
            t={t}
        />
    );
}
