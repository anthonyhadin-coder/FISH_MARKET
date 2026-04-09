"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    TrendingUp, TrendingDown, DollarSign, PieChart, 
    ArrowUpRight, ArrowDownRight, Info, ChevronDown, 
    ChevronUp, Calendar, Filter, BarChart3, Activity
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { T_AGENT, G, GCard, Label, fmt } from "../SharedUI";
import { AgentBoatWeeklyReport } from './AgentBoatWeeklyReport';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from "@/lib/types";

interface ExpenseBreakdown {
    type: string;
    amount: number;
    notes?: string;
}

interface ReportItem {
    boat: string;
    s: number; // Sales
    d: number; // Deductions
    n: number; // Net
    expenses: ExpenseBreakdown[];
}

interface ReportsTabProps {
    lang: string;
    availBoats: { id: string | number; name: string }[];
    userRole?: string;
    commRate?: number;
}

const EXP_ICONS: Record<string, React.ReactNode> = {
    diesel: <Activity className="w-4 h-4" />,
    ice: <Info className="w-4 h-4" />,
    salt: <Info className="w-4 h-4" />,
    van: <Activity className="w-4 h-4" />,
    netGear: <Activity className="w-4 h-4" />,
    other: <Filter className="w-4 h-4" />,
};

const EXP_LABELS: Record<string, { en: string; ta: string }> = {
    diesel:  { en: 'Diesel',   ta: 'டீசல்' },
    ice:     { en: 'Ice',      ta: 'ஐஸ்' },
    salt:    { en: 'Salt',     ta: 'உப்பு' },
    van:     { en: 'Van',      ta: 'வேன்' },
    netGear: { en: 'Net/Gear', ta: 'வலை' },
    other:   { en: 'Other',    ta: 'மற்றவை' },
};

function TrendChart({ data, lang }: { data: Record<string, unknown>[], lang: string }) {
    if (!data || data.length === 0) return null;
    
    // Format dates for display
    const chartData = data.map(d => ({
        ...d,
        name: new Date(String(d.date)).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short' })
    }));

    return (
        <GCard className="h-[300px] mb-6 p-6" data-testid="analytics-chart">
            <h4 className="text-xs font-black text-ocean-700 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Activity className="w-4 h-4 text-ocean-500" />
                {lang === 'ta' ? "விற்பனை போக்கு" : "Sales Performance Trend"}
            </h4>
            <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={chartData}>
                    <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={G.accent} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={G.accent} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                        dy={10}
                    />
                    <YAxis 
                        hide 
                    />
                    <Tooltip 
                        contentStyle={{ 
                            borderRadius: '12px', 
                            border: 'none', 
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                            fontSize: '12px',
                            fontWeight: '800'
                        }}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="sales" 
                        stroke={G.accent} 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorSales)" 
                        isAnimationActive={typeof window !== 'undefined' && !(window as unknown as { __PLAYWRIGHT_TEST__?: boolean }).__PLAYWRIGHT_TEST__}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="expenses" 
                        stroke="#f43f5e" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorExp)" 
                        isAnimationActive={typeof window !== 'undefined' && !(window as unknown as { __PLAYWRIGHT_TEST__?: boolean }).__PLAYWRIGHT_TEST__}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </GCard>
    );
}

export function ReportsTab({ lang, availBoats, commRate = 8 }: ReportsTabProps) {
    const t = T_AGENT[lang as 'en' | 'ta'];
    const [rptMode, setRpm] = useState<"daily" | "weekly" | "boatWeekly">("daily");
    const [reportsData, setReportsData] = useState<ReportItem[]>([]);
    const [trendData, setTrendData] = useState<Record<string, unknown>[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedBoat, setExpandedBoat] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchReports = React.useCallback(async () => {
        if (rptMode === 'boatWeekly') return; // Specific tab handles its own fetching
        setIsLoading(true);
        try {
            const date = new Date().toISOString().split('T')[0];
            const endpoint = rptMode === "weekly" ? "/reports/weekly" : "/reports/daily";
            const results = await Promise.all(availBoats.map(async (b: { id: number | string; name: string }) => {
                const res = await api.get(`${endpoint}?boatId=${b.id}&date=${date}`);
                const rate = commRate / 100;
                const sales = res.data.totalSales || 0;
                const expenses = res.data.totalExpenses || 0;
                const comm = Math.round(sales * rate);
                const breakdown: ExpenseBreakdown[] = res.data.expenseBreakdown || [];
                return { 
                    boat: b.name, 
                    s: sales, 
                    d: expenses + comm,
                    n: sales - expenses - comm,
                    expenses: breakdown
                };
            }));
            
            setReportsData(results.filter(x => x.s > 0 || x.d > 0));

            // Fetch Trend Data
            const trendRes = await api.get('/reports/trends?days=14');
            setTrendData(trendRes.data);
        } catch (err: unknown) {
            const error = err as ApiError;
            toast(error.response?.data?.message || "Failed to fetch reports", "error");
            setReportsData([]);
        } finally {
            setIsLoading(false);
        }
    }, [rptMode, availBoats, toast, commRate]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const grand = { s: 0, d: 0, n: 0 };
    reportsData.forEach(r => {
        grand.s += r.s;
        grand.d += r.d;
        grand.n += r.n;
    });

    const profitMargin = grand.s > 0 ? Math.round((grand.n / grand.s) * 100) : 0;

    const grandExpByType: Record<string, number> = {};
    reportsData.forEach(r => {
        r.expenses.forEach(e => {
            grandExpByType[e.type] = (grandExpByType[e.type] || 0) + Number(e.amount);
        });
    });

    const maxSales = Math.max(...reportsData.map(r => r.s), 1);

    return (
        <div className="space-y-6">
            {/* Range Selector */}
            <div className="flex bg-gray-100 p-1 rounded-xl w-full max-w-lg mx-auto md:mx-0">
                {[["daily", t.reports.today], ["weekly", t.reports.week], ["boatWeekly", t.reports.boatWeeklyReport]].map(([m, label]) => (
                    <button 
                        key={m} 
                        onClick={() => setRpm(m as "daily" | "weekly" | "boatWeekly")} 
                        className={`flex-1 flex px-2 items-center justify-center gap-1 md:gap-2 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all ${
                            rptMode === m ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"
                        }`}
                    >
                        {m === 'daily' ? <Calendar className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
                        <span className="truncate">{label}</span>
                    </button>
                ))}
            </div>

            {rptMode === 'boatWeekly' ? (
                <AgentBoatWeeklyReport lang={lang} availBoats={availBoats} />
            ) : (
                <>
                    {/* Trend Chart */}
            <TrendChart data={trendData} lang={lang} />
            
            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GCard className="relative overflow-hidden group border-ocean-100">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <TrendingUp className="w-16 h-16 text-emerald-500" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[11px] font-black text-ocean-700 uppercase tracking-widest mb-1">{t.reports.totalSales}</p>
                        <h3 className="text-2xl font-black text-ocean-950">{fmt(grand.s, t.fields.unitCurrency)}</h3>
                        <div className="mt-2 flex items-center gap-1 text-[11px] font-black text-emerald-600">
                            <ArrowUpRight className="w-3 h-3" />
                            <span>{profitMargin}% PROFITABLE</span>
                        </div>
                    </div>
                </GCard>

                <GCard className="relative overflow-hidden group border-ocean-100">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <TrendingDown className="w-16 h-16 text-coral-500" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[11px] font-black text-ocean-700 uppercase tracking-widest mb-1">{t.reports.totalDed}</p>
                        <h3 className="text-2xl font-black text-ocean-950">{fmt(grand.d, t.fields.unitCurrency)}</h3>
                        <div className="mt-2 text-[11px] font-black text-coral-600 uppercase tracking-widest">
                            {Math.round((grand.d / (grand.s || 1)) * 100)}% OF GROSS
                        </div>
                    </div>
                </GCard>

                <GCard className="relative overflow-hidden group bg-black">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <DollarSign className="w-16 h-16 text-white" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[11px] font-black text-ocean-400 uppercase tracking-widest mb-1">{t.reports.net}</p>
                        <h3 className="text-2xl font-black text-white">{fmt(grand.n, t.fields.unitCurrency)}</h3>
                        <div className="mt-2 flex items-center gap-1">
                            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${profitMargin}%` }} />
                            </div>
                        </div>
                    </div>
                </GCard>
            </div>

            {/* Global Expense Breakdown */}
            {Object.keys(grandExpByType).length > 0 && (
                <GCard className="border-dashed border-gray-200 bg-gray-50/30">
                    <div className="flex items-center gap-2 mb-4">
                        <PieChart className="w-4 h-4 text-ocean-600" />
                        <p className="text-xs font-bold text-ocean-950 uppercase tracking-widest">
                            {lang === 'ta' ? "செலவு விவரம்" : "Network-wide Expenses"}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {Object.entries(grandExpByType).map(([type, amount]) => (
                            <div key={type} className="bg-white p-3 rounded-xl border border-ocean-100 flex flex-col gap-1 shadow-sm">
                                <div className="flex items-center gap-2 text-ocean-400">
                                    {EXP_ICONS[type] || <Filter className="w-3 h-3" />}
                                    <span className="text-[10px] font-black uppercase tracking-wider">
                                        {EXP_LABELS[type]?.[lang as 'en' | 'ta'] || type}
                                    </span>
                                </div>
                                <p className="text-sm font-black text-ocean-950">{fmt(amount, t.fields.unitCurrency)}</p>
                            </div>
                        ))}
                    </div>
                </GCard>
            )}

            {/* Per-Boat Breakdown */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                    <BarChart3 className="w-4 h-4 text-ocean-600" />
                    <p className="text-xs font-bold text-ocean-950 uppercase tracking-widest">{t.reports.boat} Breakdown</p>
                </div>

                {isLoading ? (
                    <div className="py-20 text-center animate-pulse text-gray-400 font-bold">{t.reports.loading}</div>
                ) : reportsData.length === 0 ? (
                    <GCard className="py-20 text-center">
                        <BarChart3 className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-400 font-bold">{t.reports.noData}</p>
                    </GCard>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {reportsData.map((r) => (
                            <GCard 
                                key={r.boat} 
                                className={`overflow-hidden transition-all duration-300 ${expandedBoat === r.boat ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                            >
                                <div 
                                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                                    onClick={() => r.expenses.length > 0 && setExpandedBoat(expandedBoat === r.boat ? null : r.boat)}
                                >
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-lg font-black text-ocean-950 leading-none flex items-center gap-2">
                                                🚢 {r.boat}
                                                {expandedBoat === r.boat ? <ChevronUp className="w-4 h-4 text-ocean-600" /> : <ChevronDown className="w-4 h-4 text-ocean-300" />}
                                            </h4>
                                            <span className="text-lg font-black text-ocean-900">{fmt(r.n, t.fields.unitCurrency)}</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(r.s / maxSales) * 100}%` }}
                                                className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                                            />
                                        </div>
                                        <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                                            <span className="text-ocean-500">Sales: {fmt(r.s, t.fields.unitCurrency)}</span>
                                            <span className="text-coral-600">Exp: {fmt(r.d, t.fields.unitCurrency)}</span>
                                        </div>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {expandedBoat === r.boat && (
                                        <motion.div 
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="pt-6 mt-6 border-t border-gray-100">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    {r.expenses.map((e) => (
                                                        <div key={e.type} className="bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                                                            <div className="flex items-center gap-2 text-ocean-500 mb-1">
                                                                {EXP_ICONS[e.type] || <Filter className="w-3 h-3" />}
                                                                <span className="text-[9px] font-black uppercase tracking-wider">
                                                                    {EXP_LABELS[e.type]?.[lang as 'en' | 'ta'] || e.type}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm font-black text-ocean-950">{fmt(e.amount, t.fields.unitCurrency)}</p>
                                                            {e.notes && <p className="text-[10px] text-ocean-400 mt-0.5 mt italic">{e.notes}</p>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </GCard>
                        ))}
                    </div>
                )}
            </div>
            </>
            )}
        </div>
    );
}
