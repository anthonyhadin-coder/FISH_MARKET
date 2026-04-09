import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import {
    Ship, Loader2, CalendarDays, FileText, 
    TrendingUp, TrendingDown, DollarSign, BarChart2, Table as TableIcon
} from 'lucide-react';
import { 
    fetchAdminReport, AdminReport, BoatReport, 
    fetchFleetWeeklyReport, fetchBoatMonthlyReport, fetchAllBoatsAdmin, 
    BoatHistory, AdminBoat, BoatReportResponse 
} from '@/lib/api/adminApi';
import { useLanguage } from '@/contexts/LanguageContext';
import { T, Language } from '@/lib/i18n';
import { useToast } from '@/components/ui/Toast';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { OwnerBoatWeeklyReport } from './OwnerBoatWeeklyReport';

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

interface ReportsTabProps {
    date: string;
    setDate: (date: string) => void;
}

export function ReportsTab({ date, setDate }: ReportsTabProps) {
    const { lang } = useLanguage();
    const t = T[lang as Language];

    const [report, setReport] = useState<AdminReport | null>(null);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    // Analytics State
    const [viewMode, setViewMode] = useState<'daily' | 'analytics' | 'weekly'>('daily');
    const [fleetData, setFleetData] = useState<BoatHistory[]>([]);
    const [boats, setBoats] = useState<AdminBoat[]>([]);
    const [selectedBoat, setSelectedBoat] = useState<string>('');
    const [boatMonthlyData, setBoatMonthlyData] = useState<BoatReportResponse | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    // Load Daily Report
    const loadDaily = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchAdminReport(date);
            setReport(data);
        } catch (err: unknown) {
            toast('Failed to load daily report', 'error');
        } finally { setLoading(false); }
    }, [date, toast]);

    // Load Analytics
    const loadAnalytics = useCallback(async () => {
        try {
            setAnalyticsLoading(true);
            const fleet = await fetchFleetWeeklyReport();
            setFleetData(fleet);
            
            const boatsList = await fetchAllBoatsAdmin();
            setBoats(boatsList);
            if (boatsList.length > 0 && !selectedBoat) {
                setSelectedBoat(String(boatsList[0].id));
            }
        } catch (err: unknown) {
            toast('Failed to load analytics', 'error');
        } finally {
            setAnalyticsLoading(false);
        }
    }, [toast, selectedBoat]);

    // Load Specific Boat Month
    useEffect(() => {
        if (viewMode === 'analytics' && selectedBoat) {
            const today = new Date();
            // Defaulting to current year/month for quick drilldown
            fetchBoatMonthlyReport(selectedBoat, String(today.getFullYear()), String(today.getMonth() + 1))
                .then(setBoatMonthlyData)
                .catch(() => toast("Failed to load boat specific data", "error"));
        }
    }, [selectedBoat, viewMode, toast]);

    useEffect(() => { 
        if (viewMode === 'daily') loadDaily(); 
        else if (viewMode === 'analytics') loadAnalytics();
    }, [viewMode, loadDaily, loadAnalytics]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 gap-6 text-ocean-600">
                <Loader2 className="w-10 h-10 animate-spin text-ocean-600" />
                <p className="text-sm font-black uppercase tracking-[0.2em]">Generating Fleet Reports...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Top Toggle & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4">
                <div className="flex items-center bg-ocean-50/50 p-1.5 rounded-2xl border border-ocean-100/50 w-full md:w-auto shadow-inner">
                    <button 
                        onClick={() => setViewMode('daily')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                            viewMode === 'daily' 
                            ? 'bg-white text-ocean-900 shadow-md border border-ocean-100' 
                            : 'text-ocean-600 hover:text-ocean-800'
                        }`}
                    >
                        <TableIcon className="w-4 h-4" /> {t.daily || "Daily Tables"}
                    </button>
                    <button 
                        onClick={() => setViewMode('analytics')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                            viewMode === 'analytics' 
                            ? 'bg-white text-ocean-900 shadow-md border border-ocean-100' 
                            : 'text-ocean-600 hover:text-ocean-800'
                        }`}
                    >
                        <BarChart2 className="w-4 h-4" /> {t.analytics || "Fleet Analytics"}
                    </button>
                    <button 
                        onClick={() => setViewMode('weekly')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                            viewMode === 'weekly' 
                            ? 'bg-white text-ocean-900 shadow-md border border-ocean-100' 
                            : 'text-ocean-600 hover:text-ocean-800'
                        }`}
                    >
                        <FileText className="w-4 h-4" /> {t.boatWeeklyReport || "Weekly Report"}
                    </button>
                </div>

                {viewMode === 'daily' && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 bg-white border border-ocean-100 rounded-2xl px-5 py-2.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                            <CalendarDays className="w-5 h-5 text-ocean-600" />
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="bg-transparent text-ocean-950 font-black text-sm focus:outline-none cursor-pointer"
                            />
                        </div>
                    </div>
                )}
            </div>

            <AnimatePresence mode="wait">
            {viewMode === 'weekly' ? (
                <motion.div
                    key="weekly"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                >
                    <OwnerBoatWeeklyReport />
                </motion.div>
            ) : viewMode === 'daily' ? (
                <motion.div 
                    key="daily"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-12"
                >
                <Card className="overflow-hidden p-0 border-ocean-50 shadow-sm rounded-[2rem] bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-ocean-50 bg-gray-50/50">
                                    <th className="px-8 py-5 text-[10px] font-black text-ocean-600 uppercase tracking-widest">{t.boat}</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-ocean-600 uppercase tracking-widest">{t.agent}</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-ocean-600 uppercase tracking-widest text-right">{t.totalSales}</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-ocean-600 uppercase tracking-widest text-right">{t.expenses}</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-ocean-600 uppercase tracking-widest text-right">{t.netPayable}</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-ocean-600 uppercase tracking-widest text-right">Paid</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ocean-50/50">
                                {report?.boats.map((b: BoatReport, i: number) => (
                                    <motion.tr 
                                        key={b.boatId}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="hover:bg-ocean-50/20 transition-colors"
                                    >
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-ocean-50 border border-ocean-100 flex items-center justify-center">
                                                    <Ship className="w-5 h-5 text-ocean-600" />
                                                </div>
                                                <span className="font-black text-ocean-950 tracking-tight">{b.boatName}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-sm font-bold text-ocean-700 bg-gray-50 px-3 py-1 rounded-lg border border-ocean-50">{b.agentName}</span>
                                        </td>
                                        <td className="px-8 py-6 font-black text-ocean-950 text-right tabular-nums">{fmt(b.totalSales)}</td>
                                        <td className="px-8 py-6 font-bold text-coral-600 text-right tabular-nums">{fmt(b.totalExpenses)}</td>
                                        <td className="px-8 py-6 font-black text-ocean-950 text-right tabular-nums">{fmt(b.profit)}</td>
                                        <td className="px-8 py-6 text-right">
                                            <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                                                b.totalPayments >= b.profit && b.profit > 0 
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm' 
                                                : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                            }`}>
                                                {fmt(b.totalPayments)}
                                            </span>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                    {report?.boats.length === 0 && (
                        <div className="text-center py-32 bg-white rounded-[2.5rem] border-2 border-dashed border-ocean-50">
                            <div className="w-20 h-20 bg-ocean-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <FileText className="w-10 h-10 text-ocean-500" />
                            </div>
                            <p className="font-black text-ocean-950 text-xl tracking-tight">No records found.</p>
                            <p className="text-sm mt-2 max-w-xs mx-auto font-medium text-ocean-600">There is no fleet activity recorded for the selected date range.</p>
                        </div>
                    )}
                </motion.div>
            ) : (
                <motion.div 
                    key="analytics"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-8"
                >
                    {analyticsLoading ? (
                        <div className="flex flex-col items-center py-20 gap-4 text-ocean-600">
                            <Loader2 className="w-8 h-8 animate-spin" />
                            <span className="text-xs font-black uppercase tracking-widest">Crunching Numbers...</span>
                        </div>
                    ) : (
                        <>
                            {/* KPI Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card className="p-6 rounded-[2rem] border-emerald-100 bg-gradient-to-br from-emerald-50 to-white shadow-sm flex items-center gap-6">
                                    <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                                        <TrendingUp className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">7-Day Gross Revenue</p>
                                        <p className="text-3xl font-black text-emerald-950 tabular-nums tracking-tighter">
                                            {fmt(fleetData.reduce((sum, d) => sum + d.sales, 0))}
                                        </p>
                                    </div>
                                </Card>

                                <Card className="p-6 rounded-[2rem] border-coral-100 bg-gradient-to-br from-coral-50 to-white shadow-sm flex items-center gap-6">
                                    <div className="w-14 h-14 bg-coral-100 text-coral-600 rounded-2xl flex items-center justify-center">
                                        <TrendingDown className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-coral-600 mb-1">7-Day Operating Exp</p>
                                        <p className="text-3xl font-black text-coral-950 tabular-nums tracking-tighter">
                                            {fmt(fleetData.reduce((sum, d) => sum + d.expenses, 0))}
                                        </p>
                                    </div>
                                </Card>

                                <Card className="p-6 rounded-[2rem] border-ocean-100 bg-gradient-to-br from-ocean-50 to-white shadow-xl shadow-ocean-500/10 flex items-center gap-6 relative overflow-hidden">
                                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-ocean-600/5 rounded-full blur-2xl" />
                                    <div className="w-14 h-14 bg-ocean-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-ocean-600/30">
                                        <DollarSign className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-ocean-600 mb-1">7-Day Net Fleet Profit</p>
                                        <p className="text-4xl font-black text-ocean-950 tabular-nums tracking-tighter">
                                            {fmt(fleetData.reduce((sum, d) => sum + d.profit, 0))}
                                        </p>
                                    </div>
                                </Card>
                            </div>

                            {/* Fleet Overview Chart */}
                            <Card className="p-8 rounded-[2rem] bg-white border-ocean-100 shadow-sm">
                                <h3 className="text-sm font-black text-ocean-950 uppercase tracking-widest mb-8 flex items-center gap-2">
                                    <Ship className="w-5 h-5 text-ocean-400" />
                                    Fleet Financial Trend (Last 7 Days)
                                </h3>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={fleetData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                </linearGradient>
                                                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis 
                                                dataKey="date" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} 
                                                tickFormatter={(v: string) => new Date(v).toLocaleDateString('en-IN', { weekday: 'short' })}
                                            />
                                            <YAxis 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                tickFormatter={(v: number) => `₹${v / 1000}k`}
                                            />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                labelStyle={{ fontWeight: 900, color: '#0f172a', marginBottom: '8px' }}
                                                formatter={(value: unknown) => [`₹${Number(value || 0).toLocaleString('en-IN')}`, '']}
                                            />
                                            <Area type="monotone" dataKey="sales" name="Gross Sales" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                                            <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            {/* Individual Boat Performance */}
                            <Card className="p-8 rounded-[2rem] bg-white border-ocean-100 shadow-sm">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                                    <h3 className="text-sm font-black text-ocean-950 uppercase tracking-widest flex items-center gap-2">
                                        <BarChart2 className="w-5 h-5 text-ocean-400" />
                                        Monthly Boat Drilldown
                                    </h3>
                                    
                                    <select 
                                        className="bg-gray-50 border border-ocean-100 text-ocean-900 font-bold text-sm rounded-xl px-4 py-2 focus:ring-2 focus:ring-ocean-500 outline-none cursor-pointer"
                                        value={selectedBoat}
                                        onChange={(e) => setSelectedBoat(e.target.value)}
                                    >
                                        <option value="" disabled>Select a Boat</option>
                                        {boats.map(b => (
                                            <option key={b.id} value={String(b.id)}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {boatMonthlyData && boatMonthlyData.history.length > 0 ? (
                                    <div className="h-[250px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={boatMonthlyData.history} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                <XAxis 
                                                    dataKey="date" 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                    tickFormatter={(v: string) => new Date(v).getDate().toString()}
                                                />
                                                <YAxis 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                    tickFormatter={(v: number) => `₹${v / 1000}k`}
                                                />
                                                <Tooltip 
                                                    cursor={{ fill: '#f8fafc' }}
                                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                    labelStyle={{ fontWeight: 900, color: '#0f172a', marginBottom: '8px' }}
                                                    formatter={(value: unknown) => [`₹${Number(value || 0).toLocaleString('en-IN')}`, '']}
                                                />
                                                <Bar dataKey="profit" name="Net Profit" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="text-center py-16">
                                        <span className="text-xs font-black uppercase tracking-widest text-ocean-400">No data for this month</span>
                                    </div>
                                )}
                            </Card>
                        </>
                    )}
                </motion.div>
            )}
            </AnimatePresence>
        </div>
    );
}
