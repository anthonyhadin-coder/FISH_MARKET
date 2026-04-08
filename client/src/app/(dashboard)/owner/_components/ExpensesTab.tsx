"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { 
    TrendingDown, AlertCircle, Loader2, 
    CalendarDays, Ship
} from 'lucide-react';
import { fetchAdminReport, AdminReport, BoatReport } from '@/lib/api/adminApi';


const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

interface ExpensesTabProps {
    date: string;
    setDate: (date: string) => void;
}

export function ExpensesTab({ date, setDate }: ExpensesTabProps) {
    // const { lang } = useLanguage();

    const [report, setReport] = useState<AdminReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            setLoading(true); setError('');
            const data = await fetchAdminReport(date);
            setReport(data);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message || 'Failed to load report');
        } finally { setLoading(false); }
    }, [date]);

    useEffect(() => { load(); }, [load]);

    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 glass rounded-2xl px-5 py-3 border border-white/5">
                        <CalendarDays className="w-5 h-5 text-ocean-600" />
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="bg-transparent text-white font-bold text-sm focus:outline-none cursor-pointer [color-scheme:dark]"
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-3 bg-coral-500/10 border border-coral-500/20 text-coral-400 rounded-2xl px-6 py-4 mb-8">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{error}</span>
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-6 text-ocean-600">
                    <Loader2 className="w-10 h-10 animate-spin text-ocean-500" />
                    <p className="text-lg font-medium tracking-wide">Analysing Market Expenses...</p>
                </div>
            ) : (
                <div className="space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="md:col-span-2 bg-ocean-900/20 border-white/5">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-coral-500/10 flex items-center justify-center">
                                    <TrendingDown className="w-6 h-6 text-coral-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Full Market Expenses</h3>
                                    <p className="text-sm text-ocean-600">Aggregated operating costs across all active boats.</p>
                                </div>
                            </div>
                            <div className="flex items-end justify-between border-t border-white/5 pt-6">
                                <span className="text-ocean-700 text-xs font-black uppercase tracking-[0.2em]">Total Market Spend</span>
                                <span className="text-4xl font-black text-coral-400">{fmt(report?.summary.totalExpenses || 0)}</span>
                            </div>
                        </Card>

                        <Card className="bg-ocean-900/20 border-white/5 flex flex-col justify-center">
                            <p className="text-ocean-700 text-[10px] font-black uppercase tracking-widest mb-1">Active Fleet</p>
                            <p className="text-3xl font-black text-white">{report?.boats.length || 0} Boats</p>
                            <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-ocean-500 w-2/3" />
                            </div>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-sm font-black text-ocean-700 uppercase tracking-[0.2em]">Expense Breakdown by Boat</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {report?.boats.map((b: BoatReport, i: number) => (
                                <Card key={b.boatId} delay={i * 0.05} className="hover:border-white/10 transition-colors">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-ocean-600/20 flex items-center justify-center">
                                                <Ship className="w-4 h-4 text-ocean-600" />
                                            </div>
                                            <span className="font-bold text-white text-sm">{b.boatName}</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-coral-400 bg-coral-400/10 px-2 py-1 rounded-full">{fmt(b.totalExpenses)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-ocean-700 font-bold uppercase tracking-widest">
                                        <span>Agent: {b.agentName}</span>
                                        <span className="text-ocean-600">{(b.totalExpenses / (report.summary.totalExpenses || 1) * 100).toFixed(0)}% share</span>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
