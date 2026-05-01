"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
    Ship, TrendingUp, TrendingDown, Banknote, CalendarDays, Loader2, History, X,
    ArrowUpRight, ArrowDownRight, Activity
} from 'lucide-react';
import api from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { T, Language } from '@/lib/i18n';
import { useToast } from '@/components/ui/Toast';
import { 
    fetchAllBoatsAdmin, AdminBoat, fetchBoatMonthlyReport, 
    fetchBoatYearlyReport, BoatHistory, fetchBoatWeeklyReport 
} from '@/lib/api/adminApi';
import { groupByFish, SaleRow } from '@/app/(dashboard)/agent/SharedUI';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// ─── Chart Component ────────────────────────────────────────────────────────

const ReportChart = ({ data, period, lang }: { data: BoatHistory[], period: string, lang: string }) => {
    const chartData = [...data].reverse().map(h => ({
        name: period === 'yearly' 
            ? new Date(2000, (h.month || 1) - 1).toLocaleString(lang, { month: 'short' })
            : new Date(h.date || '').toLocaleDateString(lang, { month: 'short', day: 'numeric' }),
        sales: h.sales,
        expenses: h.expenses,
        profit: h.profit
    }));

    return (
        <div className="h-[320px] w-full mt-8">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--ocean-600)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--ocean-600)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--ocean-400)' }}
                        dy={10}
                    />
                    <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--ocean-400)' }}
                        tickFormatter={(val) => `₹${val/1000}k`}
                    />
                    <Tooltip 
                        contentStyle={{ 
                            borderRadius: '1.5rem', 
                            border: 'none', 
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                            fontSize: '12px',
                            fontWeight: 'bold'
                        }} 
                    />
                    <Area 
                        type="monotone" 
                        dataKey="sales" 
                        stroke="var(--ocean-600)" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorSales)" 
                        name="Sales"
                    />
                    <Area 
                        type="monotone" 
                        dataKey="profit" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorProfit)" 
                        name="Profit"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export function BoatReportsTab() {
    const { lang } = useLanguage();
    const t = T[lang as Language];

    const [boats, setBoats] = useState<AdminBoat[]>([]);
    const [selectedBoat, setSelectedBoat] = useState<string>('');
    const [report, setReport] = useState<{ boatName: string; history: BoatHistory[] } | null>(null);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());

    // Detailed Slip State
    const [showModal, setShowModal] = useState(false);
    const [detailsDate, setDetailsDate] = useState('');
    const [detailedSales, setDetailedSales] = useState<SaleRow[]>([]);
    const [detailedExpenses, setDetailedExpenses] = useState<{ expense_type: string; note?: string; amount: number }[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        fetchAllBoatsAdmin().then(setBoats).catch(() => toast("Failed to load boats", "error"));
    }, [toast]);

    const loadReport = useCallback(async (boatId: string) => {
        if (!boatId) return;
        try {
            setLoading(true);
            let data;
            if (period === 'weekly') {
                data = await fetchBoatWeeklyReport(boatId);
            } else if (period === 'monthly') {
                data = await fetchBoatMonthlyReport(boatId, selectedYear, selectedMonth);
            } else {
                data = await fetchBoatYearlyReport(boatId, selectedYear);
            }
            setReport(data);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            toast(err.response?.data?.message || "Failed to load report", "error");
        } finally {
            setLoading(false);
        }
    }, [period, selectedYear, selectedMonth, toast]);

    useEffect(() => {
        if (selectedBoat) loadReport(selectedBoat);
    }, [selectedBoat, loadReport]);

    const handlePrint = () => {
        window.print();
    };

    const fetchDetails = async (date: string) => {
        if (!selectedBoat || !date) return;
        try {
            setLoadingDetails(true);
            setDetailsDate(date);
            setShowModal(true);
            const [salesRes, expRes] = await Promise.all([
                api.get('/sales/history', { params: { boatId: selectedBoat, date } }),
                api.get('/expenses', { params: { boatId: selectedBoat, date } })
            ]);
            setDetailedSales(salesRes.data);
            setDetailedExpenses(expRes.data);
        } catch (e: unknown) {
            console.error("Failed to fetch details", e);
        } finally {
            setLoadingDetails(false);
        }
    };

    return (
        <div className="space-y-8 pb-20 print:p-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
                <div className="flex items-center gap-6">
                    <div>
                        <h2 className="text-3xl font-black text-ocean-950 tracking-tight italic uppercase">{t.reports}</h2>
                        <p className="text-ocean-600 text-[10px] font-black uppercase tracking-[0.2em] mt-1">{t.performanceSummary}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 bg-gray-50 border border-ocean-100 rounded-2xl p-1.5 shadow-sm">
                        {(['weekly', 'monthly', 'yearly'] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    period === p ? 'bg-ocean-600 text-white shadow-xl shadow-ocean-600/20' : 'text-ocean-600 hover:text-ocean-900'
                                }`}
                            >
                                {t[p]}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-4 bg-white border border-ocean-100 rounded-2xl px-5 py-3 shadow-sm hover:shadow-md transition-all">
                        <Ship className="w-5 h-5 text-ocean-600" />
                        <select 
                            value={selectedBoat} 
                            onChange={e => setSelectedBoat(e.target.value)}
                            className="bg-transparent text-ocean-950 font-black text-sm focus:outline-none cursor-pointer pr-4"
                        >
                            <option value="">{t.selectBoat}</option>
                            {boats.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    {period !== 'weekly' && (
                        <div className="flex items-center gap-4 bg-white border border-ocean-100 rounded-2xl px-5 py-3 shadow-sm">
                            <CalendarDays className="w-5 h-5 text-ocean-600" />
                            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="bg-transparent text-ocean-950 font-black text-sm focus:outline-none cursor-pointer">
                                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            {period === 'monthly' && (
                                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent text-ocean-950 font-black text-sm focus:outline-none cursor-pointer">
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                        <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString(lang, { month: 'long' })}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {report && (
                <div className="flex justify-end print:hidden">
                    <Button variant="ghost" onClick={handlePrint} className="flex items-center gap-2 group text-ocean-600 hover:text-ocean-900 font-black text-[10px] uppercase tracking-widest px-6 py-4 rounded-xl hover:bg-ocean-50 transition-all">
                        <History className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                        {t.printReport}
                    </Button>
                </div>
            )}


            {!selectedBoat && !loading && (
                <div className="space-y-12">
                    <div className="flex items-center gap-4 border-b border-ocean-100 pb-6 mb-8">
                        <TrendingUp className="w-8 h-8 text-ocean-600" />
                        <div>
                            <h3 className="text-2xl font-black text-ocean-950 uppercase tracking-tighter italic">Fleet Performance</h3>
                            <p className="text-[10px] text-ocean-400 font-black uppercase tracking-[0.2em] mt-1">Aggregated Data Across All Owned Boats</p>
                        </div>
                    </div>
                    
                    {/* Placeholder for Fleet Data Summary or Chart */}
                    <div className="py-12 flex flex-col items-center justify-center text-center print:hidden bg-gray-50/50 rounded-[3rem] border-2 border-dashed border-ocean-100">
                        <Activity className="w-16 h-16 text-ocean-300 mb-6 animate-pulse" />
                        <p className="text-ocean-700 font-black text-lg uppercase tracking-widest max-w-sm mb-6">{t.selectBoat} to see detailed financial breakdown</p>
                        <select 
                            value={selectedBoat} 
                            onChange={e => setSelectedBoat(e.target.value)}
                            className="bg-white border-2 border-ocean-200 px-8 py-4 rounded-2xl text-ocean-950 font-black text-sm focus:outline-none cursor-pointer shadow-lg hover:border-ocean-400 transition-all"
                        >
                            <option value="">{t.selectBoat}</option>
                            {boats.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-6 text-ocean-600 print:hidden">
                    <Loader2 className="w-12 h-12 animate-spin text-ocean-600" />
                    <p className="font-black uppercase tracking-[0.2em] text-[10px]">{t.loading} Summary...</p>
                </div>
            ) : report && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
                    {/* Summary Header for Print */}
                    <div className="hidden print:block text-center mb-12 border-b-2 border-ocean-900 pb-8">
                        <div className="text-4xl font-black text-ocean-900 uppercase tracking-tighter mb-2">{t.appName}</div>
                        <h2 className="text-xl font-bold text-ocean-600 uppercase tracking-widest">
                            {report.boatName} — {period === 'weekly' ? t.weekly : period === 'monthly' ? `${selectedMonth}/${selectedYear}` : selectedYear} {t.reportTab}
                        </h2>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <Card className="bg-white border-ocean-50 p-8 print:border-ocean-100 print:bg-transparent shadow-sm rounded-[2.5rem] relative overflow-hidden group hover:shadow-xl hover:shadow-ocean-950/5 transition-all duration-500">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/50 rounded-bl-[5rem] -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-700" />
                            <div className="flex items-center gap-4 mb-6 relative z-10">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center print:hidden">
                                    <TrendingUp className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-ocean-400 uppercase tracking-[0.2em]">{t.totalSales}</span>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">+12.4%</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-4xl font-black text-ocean-950 tabular-nums tracking-tighter print:text-ocean-900 relative z-10">{fmt(report.history.reduce((a, b) => a + b.sales, 0))}</p>
                        </Card>

                        <Card className="bg-white border-ocean-50 p-8 print:border-ocean-100 print:bg-transparent shadow-sm rounded-[2.5rem] relative overflow-hidden group hover:shadow-xl hover:shadow-ocean-950/5 transition-all duration-500">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-coral-50/50 rounded-bl-[5rem] -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-700" />
                            <div className="flex items-center gap-4 mb-6 relative z-10">
                                <div className="w-12 h-12 rounded-2xl bg-coral-50 border border-coral-100 flex items-center justify-center print:hidden">
                                    <TrendingDown className="w-6 h-6 text-coral-600" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-ocean-400 uppercase tracking-[0.2em]">{t.expenses}</span>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <Activity className="w-3 h-3 text-coral-400" />
                                        <span className="text-[10px] font-bold text-coral-500 uppercase tracking-widest">Normal</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-4xl font-black text-ocean-950 tabular-nums tracking-tighter print:text-ocean-900 relative z-10">{fmt(report.history.reduce((a, b) => a + b.expenses, 0))}</p>
                        </Card>

                        <Card className="bg-ocean-600 border-ocean-700 p-8 shadow-2xl shadow-ocean-600/30 rounded-[2.5rem] relative overflow-hidden group transition-all duration-500 print:border-ocean-900 print:bg-ocean-50 print:shadow-none">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-bl-[6rem] -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-700" />
                            <div className="flex items-center gap-4 mb-6 relative z-10">
                                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center print:hidden">
                                    <Banknote className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-white/60 print:text-ocean-700 uppercase tracking-[0.2em]">{t.netProfit}</span>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest print:text-emerald-600">On Track</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-4xl font-black text-white print:text-ocean-950 tabular-nums tracking-tighter relative z-10">{fmt(report.history.reduce((a, b) => a + b.profit, 0))}</p>
                        </Card>
                    </div>

                    {/* Visual Chart Section */}
                    <Card className="bg-white border-ocean-50 p-10 rounded-[3rem] shadow-xl shadow-ocean-950/5 print:hidden">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <h3 className="text-sm font-black text-ocean-950 uppercase tracking-[0.2em]">{t.performanceTrend}</h3>
                                <p className="text-[10px] text-ocean-400 font-bold uppercase tracking-widest mt-1">Daily Profit & Sales Volatility</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-ocean-600" />
                                    <span className="text-[10px] font-black text-ocean-400 uppercase tracking-widest">Sales</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-[10px] font-black text-ocean-400 uppercase tracking-widest">Profit</span>
                                </div>
                            </div>
                        </div>
                        <ReportChart data={report.history} period={period} lang={lang} />
                    </Card>

                    {/* History Table */}
                    <Card className="p-0 overflow-hidden border-ocean-100 bg-white shadow-xl shadow-ocean-950/5 rounded-[2.5rem] print:border-ocean-200 print:bg-transparent print:shadow-none">
                        <div className="px-10 py-8 border-b border-ocean-50 flex items-center justify-between print:border-ocean-200 bg-gray-50/30">
                            <h3 className="text-xs font-black text-ocean-950 print:text-ocean-900 uppercase tracking-[0.2em] flex items-center gap-3">
                                <CalendarDays className="w-5 h-5 text-ocean-600 print:hidden" /> {t.dailyHistory}
                            </h3>
                            <span className="text-[10px] font-black text-ocean-600 uppercase tracking-widest border border-ocean-100 px-4 py-1.5 rounded-full print:text-ocean-400">
                                {period === 'weekly' ? t.lastSevenDays : period === 'monthly' ? t.monthly : t.yearly}
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50/50 print:bg-ocean-50">
                                        <th className="px-10 py-5 text-[10px] font-black text-ocean-600 uppercase tracking-widest">{period === 'yearly' ? t.monthly : t.date}</th>
                                        <th className="px-10 py-5 text-[10px] font-black text-ocean-600 uppercase tracking-widest">{t.totalSales}</th>
                                        <th className="px-10 py-5 text-[10px] font-black text-ocean-600 uppercase tracking-widest">{t.expenses}</th>
                                        <th className="px-10 py-5 text-[10px] font-black text-ocean-600 uppercase tracking-widest text-right">{t.netPayable}</th>
                                        {period !== 'yearly' && <th className="px-10 py-5 text-[10px] font-black text-ocean-600 uppercase tracking-widest text-right print:hidden">Action</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ocean-50 print:divide-ocean-100">
                                    {report.history.map((h, i) => (
                                        <tr key={h.date || h.month || i} className="hover:bg-ocean-50/30 transition-colors group print:hover:bg-transparent">
                                            <td className="px-10 py-6">
                                                <span className="font-black text-ocean-950 print:text-ocean-900 block tracking-tight">
                                                    {period === 'yearly' 
                                                        ? new Date(2000, h.month! - 1).toLocaleString(lang, { month: 'long' })
                                                        : new Date(h.date!).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                </span>
                                                {h.date && <span className="text-[10px] font-black text-ocean-500 print:text-ocean-400 uppercase tracking-widest">{h.date}</span>}
                                            </td>
                                            <td className="px-10 py-6 font-black text-ocean-950 tabular-nums print:text-ocean-900">{fmt(h.sales)}</td>
                                            <td className="px-10 py-6 font-bold text-coral-600 tabular-nums print:text-coral-600">{fmt(h.expenses)}</td>
                                            <td className="px-10 py-6 text-right tabular-nums">
                                                <span className={`font-black text-xl tracking-tighter ${h.profit >=0 ? 'text-emerald-600 print:text-green-600' : 'text-coral-600 print:text-coral-600'}`}>
                                                    {fmt(h.profit)}
                                                </span>
                                            </td>
                                            {period !== 'yearly' && (
                                                <td className="px-10 py-6 text-right print:hidden">
                                                    <button 
                                                        onClick={() => fetchDetails(h.date!)}
                                                        className="px-5 py-2.5 rounded-xl bg-ocean-50 text-ocean-600 border border-ocean-100 hover:bg-ocean-600 hover:text-white hover:border-ocean-600 hover:shadow-lg hover:shadow-ocean-600/20 text-[10px] font-black uppercase tracking-widest transition-all scale-95 opacity-0 group-hover:opacity-100 group-hover:scale-100"
                                                    >
                                                        {t.viewDetails}
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Print Footer */}
                    <div className="hidden print:block text-center mt-20 text-[10px] font-bold text-ocean-400 uppercase tracking-widest border-t border-ocean-100 pt-8">
                        {t.generatedBy} {t.appName} — {new Date().toLocaleString()}
                    </div>
                </motion.div>
            )}

            {/* Detailed Slip Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-12">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-ocean-950/20 backdrop-blur-md" />
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} 
                            className="relative w-full max-w-3xl bg-white border border-ocean-100 rounded-[3rem] shadow-2xl overflow-hidden">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-ocean-50 rounded-bl-[8rem] -mr-12 -mt-12" />
                            <div className="px-10 py-10 border-b border-ocean-50 flex items-center justify-between relative z-10">
                                <div>
                                    <h3 className="text-3xl font-black text-ocean-950 uppercase tracking-tighter italic">{t.boatSlip}</h3>
                                    <p className="text-ocean-600 text-[10px] font-black uppercase tracking-[0.2em] mt-2 bg-ocean-50 px-4 py-1.5 rounded-full inline-block border border-ocean-100">
                                        {new Date(detailsDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="w-12 h-12 rounded-full bg-ocean-50 flex items-center justify-center hover:bg-ocean-100 transition-colors text-ocean-600 hover:text-ocean-900 border border-ocean-100">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-10 max-h-[75vh] overflow-y-auto space-y-12 relative z-10">
                                {loadingDetails ? (
                                    <div className="flex flex-col items-center justify-center py-24 gap-6">
                                        <Loader2 className="w-12 h-12 animate-spin text-ocean-600" />
                                        <p className="font-black text-[10px] text-ocean-400 uppercase tracking-widest">Compiling Data...</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Sales Table */}
                                        <div className="space-y-8">
                                            <h4 className="text-[10px] font-black text-ocean-300 uppercase tracking-[0.3em] ml-1">{t.totalSales} Summary</h4>
                                            {Object.entries(groupByFish(detailedSales)).map(([fishName, fRows]) => {
                                                const fTotal = fRows.reduce((a, r) => a + Math.round((+r.weight||0)*(+r.rate||0)), 0);
                                                const fKg = fRows.reduce((a, r) => a + Number(r.weight||0), 0);
                                                return (
                                                    <div key={fishName} className="border border-ocean-100 rounded-[2rem] overflow-hidden bg-white shadow-sm">
                                                        <div className="px-8 py-5 bg-gray-50 flex justify-between items-center border-b border-ocean-100">
                                                            <span className="font-black text-ocean-950 uppercase tracking-widest text-sm flex items-center gap-2">🐟 {fishName}</span>
                                                            <span className="font-black text-ocean-950 tabular-nums">{fKg}kg · {fmt(fTotal)}</span>
                                                        </div>
                                                        <table className="w-full text-left text-xs">
                                                            <thead>
                                                                <tr className="bg-white">
                                                                    <th className="px-8 py-4 font-black text-ocean-400 uppercase tracking-widest">{t.buyer}</th>
                                                                    <th className="px-8 py-4 font-black text-ocean-400 uppercase tracking-widest text-right">{t.weight}</th>
                                                                    <th className="px-8 py-4 font-black text-ocean-400 uppercase tracking-widest text-right">{t.rate}</th>
                                                                    <th className="px-8 py-4 font-black text-ocean-400 uppercase tracking-widest text-right">{t.amount}</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-ocean-50">
                                                                {fRows.map((r, i) => (
                                                                    <tr key={i} className="hover:bg-ocean-50 transition-colors">
                                                                        <td className="px-8 py-4 font-black text-ocean-950">{r.buyerName || r.buyer || "—"}</td>
                                                                        <td className="px-8 py-4 text-right text-ocean-400 font-bold tabular-nums">{r.weight} kg</td>
                                                                        <td className="px-8 py-4 text-right text-ocean-400 font-bold tabular-nums">₹{r.rate}</td>
                                                                        <td className="px-8 py-4 text-right font-black text-emerald-600 tabular-nums text-sm">{fmt(Math.round(Number(r.weight) * Number(r.rate)))}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                );
                                            })}
                                            {detailedSales.length === 0 && (
                                                <div className="text-center py-10 bg-gray-50 rounded-3xl border border-dashed border-ocean-100">
                                                    <p className="text-ocean-500 font-black uppercase tracking-widest text-[10px]">{t.noData}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Expenses Breakdown */}
                                        <div className="space-y-8">
                                            <h4 className="text-[10px] font-black text-ocean-300 uppercase tracking-[0.3em] ml-1">{t.expenses} Breakdown</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                                {detailedExpenses.map((e, i) => (
                                                    <div key={i} className="flex items-center justify-between p-6 rounded-3xl bg-white border border-ocean-100 shadow-sm hover:shadow-md transition-shadow">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-2xl bg-coral-50 border border-coral-50 flex items-center justify-center text-xl">
                                                                {e.expense_type === 'diesel' ? '⛽' : e.expense_type === 'ice' ? '🧊' : e.expense_type === 'netGear' ? '🕸️' : '📦'}
                                                            </div>
                                                            <div>
                                                                <p className="text-ocean-950 font-black text-xs uppercase tracking-tight">{t[e.expense_type] || e.expense_type}</p>
                                                                {e.note && <p className="text-[10px] text-ocean-400 font-bold mt-1 leading-tight">{e.note}</p>}
                                                            </div>
                                                        </div>
                                                        <span className="font-black text-coral-600 tabular-nums text-lg tracking-tighter">{fmt(e.amount)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {detailedExpenses.length === 0 && (
                                                <div className="text-center py-10 bg-gray-50 rounded-3xl border border-dashed border-ocean-100">
                                                    <p className="text-ocean-300 font-black uppercase tracking-widest text-[10px]">{t.noData}</p>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
