"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import {
    TrendingUp, TrendingDown, PiggyBank,
    Loader2, CalendarDays, ArrowRight, Ship, Users
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import api from '@/lib/api';
import { fetchAdminReport, AdminReport, fetchFleetWeeklyReport, BoatHistory } from '@/lib/api/adminApi';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/Button';
import { OwnerTab } from '../OwnerView';
import { useToast } from '@/components/ui/Toast';
import { T } from '@/lib/i18n';

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

interface OverviewTabProps {
    date: string;
    setDate: (date: string) => void;
    setTab: (tab: OwnerTab) => void;
}

export function OverviewTab({ date, setDate, setTab }: OverviewTabProps) {
    const { lang } = useLanguage();

    const [report, setReport] = useState<AdminReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [salariesTotal, setSalariesTotal] = useState(0);
    const [history, setHistory] = useState<BoatHistory[]>([]);
    const { toast } = useToast();

    useEffect(() => { setMounted(true); }, []);

    const load = useCallback(async () => {

        try {
            setLoading(true);
            const [data, sal, hist] = await Promise.all([
                fetchAdminReport(date),
                api.get('/salaries/summary'),
                fetchFleetWeeklyReport()
            ]);
            setReport(data);
            setSalariesTotal(sal.data.totalSalaries || 0);
            setHistory(hist);
        } catch (err: unknown) {
            const e = err as { errorKey?: string; response?: { data?: { message?: string } } };
            const msg = (e.errorKey && T[lang][e.errorKey]) || e.response?.data?.message || T[lang].serverError;
            toast(msg, 'error');
        } finally { setLoading(false); }
    }, [date, toast]);

    useEffect(() => { load(); }, [load]);

    const netProfit = (report?.summary.totalProfit || 0) - salariesTotal;
    const metrics = [
        { label: lang === "ta" ? "மொத்த விற்பனை" : "Total Sales", value: report?.summary.totalSales || 0, icon: TrendingUp, color: 'text-ocean-600', bg: 'bg-ocean-50' },
        { label: lang === "ta" ? "சந்தை செலவுகள்" : "Market Expenses", value: report?.summary.totalExpenses || 0, icon: TrendingDown, color: 'text-coral-600', bg: 'bg-coral-50' },
        { label: lang === "ta" ? "பணியாளர் சம்பளம்" : "Staff Salary", value: salariesTotal, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: lang === "ta" ? "நிகர லாபம்" : "Net Profit", value: netProfit, icon: PiggyBank, color: netProfit < 0 ? 'text-coral-600' : 'text-emerald-600', bg: netProfit < 0 ? 'bg-coral-50' : 'bg-emerald-50' },
    ];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-32 gap-6 text-ocean-600">
                <Loader2 className="w-10 h-10 animate-spin text-ocean-600" />
                <p className="text-sm font-black uppercase tracking-[0.2em]">Calculating Performance...</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
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

                <div className="flex items-center gap-3">
                    <Button onClick={() => setTab("boats")} variant="outline" className="text-xs font-black uppercase tracking-widest gap-2 bg-white border-ocean-100 text-ocean-900 hover:bg-ocean-50 rounded-2xl px-6 py-6 border">
                        <Ship className="w-4 h-4 text-ocean-600" /> Manage Boats
                    </Button>
                </div>
            </div>

            <div className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {metrics.map((m, i) => (
                        <Card key={m.label} delay={i * 0.1} className="border-ocean-50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all rounded-[2rem] p-6">
                            <div className="flex items-start justify-between mb-6">
                                <div className={`w-14 h-14 rounded-2xl ${m.bg} flex items-center justify-center shadow-sm`}>
                                    <m.icon className={`w-7 h-7 ${m.color}`} />
                                </div>
                                <span className="text-[10px] font-black text-ocean-500 uppercase tracking-widest leading-none pt-2">Today</span>
                            </div>
                            <p className="text-[10px] font-black text-ocean-600 uppercase tracking-[0.2em] mb-2">{m.label}</p>
                            <p className={`text-3xl font-black tracking-tight tabular-nums ${m.color === 'text-ocean-600' ? 'text-ocean-950' : m.color}`}>{fmt(m.value)}</p>
                        </Card>
                    ))}
                </div>

                {report && report.boats && report.boats.length > 0 && (
                    <Card className="rounded-[2rem] border-ocean-100 bg-white p-6 md:p-10 shadow-sm hover:shadow-xl transition-all">
                        <h3 className="text-xl font-black text-ocean-950 mb-8 flex items-center gap-3">
                            {lang === "ta" ? "இன்றைய படகு செயல்திறன்" : "Today's Boat Performance"}
                        </h3>
                        <div className="h-[350px] w-full">
                            {mounted && (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={report.boats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E0F2FE" />
                                        <XAxis dataKey="boatName" axisLine={false} tickLine={false} tick={{ fill: '#082F49', fontSize: 12, fontWeight: 700 }} dy={10} />
                                        <YAxis hide={false} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={(value) => `₹${value.toLocaleString()}`} />
                                        <Tooltip
                                            cursor={{ fill: '#F0F9FF' }}
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)', fontWeight: 700 }}

                                            formatter={(value: unknown) => [`₹${Number(value || 0).toLocaleString()}`, '']}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 700, color: '#082F49' }} iconType="circle" />
                                        <Bar dataKey="totalSales" name={lang === "ta" ? "விற்பனை" : "Sales"} fill="#0EA5E9" radius={[6, 6, 0, 0]} maxBarSize={50} />
                                        <Bar dataKey="totalExpenses" name={lang === "ta" ? "செலவுகள்" : "Expenses"} fill="#F43F5E" radius={[6, 6, 0, 0]} maxBarSize={50} />
                                        <Bar dataKey="profit" name={lang === "ta" ? "லாபம்" : "Profit"} fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={50} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                    <div onClick={() => setTab("salaries")} className="group cursor-pointer">
                        <Card className="rounded-[2.5rem] border-ocean-100 bg-white p-10 hover:shadow-2xl hover:shadow-ocean-900/10 transition-all border-2 relative overflow-hidden h-full">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-ocean-50 rounded-bl-[5rem] -mr-10 -mt-10 group-hover:bg-ocean-100 transition-colors" />
                            <h3 className="text-3xl font-black text-ocean-950 mb-4 flex items-center justify-between relative z-10">
                                {lang === "ta" ? "பணியாளர் சம்பளம்" : "Staff Salaries"}
                                <ArrowRight className="w-8 h-8 text-ocean-600 group-hover:text-ocean-900 group-hover:translate-x-2 transition-all" />
                            </h3>
                            <p className="text-ocean-700 font-bold text-lg leading-relaxed relative z-10">Manage your staff payroll and track payments from net profits efficiently.</p>
                            <div className="mt-8 flex items-center gap-2 text-ocean-600 group-hover:text-ocean-950 transition-colors relative z-10">
                                <span className="text-xs font-black uppercase tracking-widest">Open Payroll Manager</span>
                            </div>
                        </Card>
                    </div>
                    <div onClick={() => setTab("boats")} className="group cursor-pointer">
                        <Card className="rounded-[2.5rem] border-ocean-100 bg-white p-10 hover:shadow-2xl hover:shadow-ocean-900/10 transition-all border-2 relative overflow-hidden h-full">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[5rem] -mr-10 -mt-10 group-hover:bg-indigo-100 transition-colors" />
                            <h3 className="text-3xl font-black text-ocean-950 mb-4 flex items-center justify-between relative z-10">
                                {lang === "ta" ? "எனது படகுகள்" : "My Boats"}
                                <ArrowRight className="w-8 h-8 text-indigo-600 group-hover:text-ocean-900 group-hover:translate-x-2 transition-all" />
                            </h3>
                            <p className="text-ocean-700 font-bold text-lg leading-relaxed relative z-10">Monitor your entire fleet and view detailed assignments for each boat.</p>
                            <div className="mt-8 flex items-center gap-2 text-indigo-600 group-hover:text-ocean-950 transition-colors relative z-10">
                                <span className="text-xs font-black uppercase tracking-widest">Manage Fleet</span>
                            </div>
                        </Card>
                    </div>
                </div>

                <Card className="rounded-[2rem] border-ocean-100 bg-white p-6 md:p-10 shadow-sm hover:shadow-xl transition-all">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black text-ocean-950 flex items-center gap-3">
                            {lang === "ta" ? "விற்பனை போக்கு (7 நாட்கள்)" : "Sales Trends (Last 7 Days)"}
                        </h3>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-ocean-500" />
                            <span className="text-[10px] font-black text-ocean-500 uppercase tracking-widest">{lang === 'ta' ? 'விற்பனை' : 'Sales'}</span>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        {mounted && (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }}
                                        tickFormatter={(val) => {
                                            const d = new Date(val);
                                            return d.toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', { weekday: 'short' });
                                        }}
                                    />
                                    <YAxis hide axisLine={false} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)', fontWeight: 700 }}
                                        labelFormatter={(val) => new Date(val).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', { day: 'numeric', month: 'short' })}
                                        formatter={(value: unknown) => [`₹${Number(value).toLocaleString()}`, lang === 'ta' ? 'விற்பனை' : 'Sales']}
                                    />
                                    <Area type="monotone" dataKey="sales" stroke="#0EA5E9" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
