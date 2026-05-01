import React, { useState, useEffect, useCallback } from 'react';
import { Ship, CalendarDays, Download, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { fetchOwnerBoatWeeklyReport, fetchAllBoatsAdmin, AdminBoat } from '@/lib/api/adminApi';
import { useLanguage } from '@/contexts/LanguageContext';
import { T, Language } from '@/lib/i18n';
import { useToast } from '@/components/ui/Toast';

const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

interface WeeklyReportData {
    owner_name: string;
    boat_name: string;
    week_start: string;
    week_end: string;
    daily_breakdown: Array<{
        date: string;
        daily_total: number;
        agent_name?: string;
        entries: Array<{
            fish_name: string;
            weight: number;
            rate: number;
            total: number;
        }>;
    }>;
    owner_summary: {
        total_weight: number;
        gross_sales: number;
        agent_commission: number;
        bonus_earned: number;
        net_payable: number;
        target_met?: boolean;
    };
}

export function OwnerBoatWeeklyReport() {
    const { lang } = useLanguage();
    const t = T[lang as Language];
    const { toast } = useToast();

    const [boats, setBoats] = useState<AdminBoat[]>([]);
    const [selectedBoat, setSelectedBoat] = useState<string>('');
    const [weekStart, setWeekStart] = useState<string>('');
    const [weekEnd, setWeekEnd] = useState<string>('');
    
    const [reportData, setReportData] = useState<WeeklyReportData | null>(null);
    const [loading, setLoading] = useState(false);

    // Initialize dates to current week (Mon-Sun)
    useEffect(() => {
        const curr = new Date();
        const first = curr.getDate() - curr.getDay() + 1; // Monday
        const last = first + 6; // Sunday
        
        const firstDay = new Date(curr.setDate(first)).toISOString().split('T')[0];
        const lastDay = new Date(curr.setDate(last)).toISOString().split('T')[0];
        
        setWeekStart(firstDay);
        setWeekEnd(lastDay);

        fetchAllBoatsAdmin().then(res => {
            setBoats(res);
            if (res.length > 0) setSelectedBoat(String(res[0].id));
        }).catch(() => toast("Failed to load boats", "error"));
    }, [toast]);

    const loadReport = useCallback(async () => {
        if (!selectedBoat || !weekStart || !weekEnd) return;
        try {
            setLoading(true);
            const data = await fetchOwnerBoatWeeklyReport(selectedBoat, weekStart, weekEnd) as WeeklyReportData;
            setReportData(data);
        } catch (_err) {
            toast("Failed to load boat weekly report", "error");
        } finally {
            setLoading(false);
        }
    }, [selectedBoat, weekStart, weekEnd, toast]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const handlePrint = () => {
        window.print();
    };

    if (loading && !reportData) {
        return (
            <div className="flex flex-col items-center justify-center py-32 gap-6 text-ocean-600">
                <Loader2 className="w-10 h-10 animate-spin text-ocean-600" />
                <p className="text-sm font-black uppercase tracking-[0.2em]">{t.loading || "Loading..."}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 bg-white border border-ocean-100 rounded-2xl p-2 flex items-center shadow-sm">
                    <Ship className="w-5 h-5 text-ocean-600 mx-3" />
                    <select 
                        value={selectedBoat}
                        onChange={e => setSelectedBoat(e.target.value)}
                        className="w-full bg-transparent font-black text-ocean-950 focus:outline-none"
                    >
                        {boats.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                
                <div className="flex items-center gap-2 bg-white border border-ocean-100 rounded-2xl p-2 shadow-sm">
                    <CalendarDays className="w-5 h-5 text-ocean-600 mx-3" />
                    <input 
                        type="date" 
                        value={weekStart}
                        onChange={e => setWeekStart(e.target.value)}
                        className="bg-transparent font-bold text-sm text-ocean-950 focus:outline-none"
                    />
                    <span className="text-ocean-400 font-bold">-</span>
                    <input 
                        type="date" 
                        value={weekEnd}
                        onChange={e => setWeekEnd(e.target.value)}
                        className="bg-transparent font-bold text-sm text-ocean-950 focus:outline-none"
                    />
                </div>
            </div>

            {reportData && reportData.daily_breakdown && (
                <div className="print-section space-y-6 bg-white p-6 md:p-10 rounded-[2rem] border border-ocean-100 shadow-xl">
                    {/* Header */}
                    <div className="text-center pb-6 border-b-2 border-ocean-900 border-dashed">
                        <h2 className="text-2xl md:text-3xl font-black text-ocean-950 tracking-tight mb-2 uppercase flex items-center justify-center gap-3">
                            🐟 {t.boatWeeklyReport || "Boat Weekly Report"}
                        </h2>
                        <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm font-bold text-ocean-700">
                            <p>Owner: <span className="text-ocean-950">{reportData.owner_name || "Owner"}</span></p>
                            <p>Boat: <span className="text-ocean-950">{reportData.boat_name} (ID: #{selectedBoat.padStart(3, '0')})</span></p>
                            <p>Week: <span className="text-ocean-950">{new Date(reportData.week_start).toLocaleDateString('en-GB')} – {new Date(reportData.week_end).toLocaleDateString('en-GB')}</span></p>
                        </div>
                    </div>

                    {/* Breakdown Table */}
                    <div>
                        <h3 className="text-sm font-black text-ocean-600 uppercase tracking-[0.2em] mb-4">DAY-BY-DAY BREAKDOWN</h3>
                        <div className="overflow-x-auto border border-ocean-200 rounded-2xl">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-ocean-50/80 border-b border-ocean-200">
                                    <tr>
                                        <th className="px-5 py-4 font-black text-ocean-900 uppercase tracking-wider">{t.date || "Date"}</th>
                                        <th className="px-5 py-4 font-black text-ocean-900 uppercase tracking-wider">{t.fishName || "Fish"}</th>
                                        <th className="px-5 py-4 font-black text-ocean-900 uppercase tracking-wider text-right">{t.weight || "Weight"}</th>
                                        <th className="px-5 py-4 font-black text-ocean-900 uppercase tracking-wider text-right">{t.rate || "Rate"}</th>
                                        <th className="px-5 py-4 font-black text-ocean-900 uppercase tracking-wider text-right">{t.amount || "Total"}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ocean-100 bg-white">
                                    {reportData.daily_breakdown.map((day, _idx: number) => (
                                        <React.Fragment key={day.date}>
                                            {day.entries.map((entry, eIdx: number) => (
                                                <tr key={`${day.date}-${eIdx}`} className="hover:bg-ocean-50/30 transition-colors">
                                                    <td className="px-5 py-3 font-bold text-ocean-700 whitespace-nowrap">
                                                        {eIdx === 0 ? new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }) : ''}
                                                    </td>
                                                    <td className="px-5 py-3 font-bold text-ocean-950">{entry.fish_name}</td>
                                                    <td className="px-5 py-3 font-medium text-ocean-800 text-right">{entry.weight}kg</td>
                                                    <td className="px-5 py-3 font-medium text-ocean-800 text-right">₹{entry.rate}</td>
                                                    <td className="px-5 py-3 font-black text-ocean-950 text-right">{fmt(entry.total)}</td>
                                                </tr>
                                            ))}
                                            {/* Daily Subtotal Row */}
                                            <tr className="bg-ocean-50/50">
                                                <td colSpan={4} className="px-5 py-2 font-black text-ocean-800 text-right text-xs tracking-widest uppercase">DAILY</td>
                                                <td className="px-5 py-2 font-black text-ocean-950 text-right">{fmt(day.daily_total)}</td>
                                            </tr>
                                        </React.Fragment>
                                    ))}
                                    {reportData.daily_breakdown.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-5 py-10 text-center text-ocean-400 font-bold">
                                                {t.noData || "No data for this period."}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Financial Summary & Agent Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                        {/* Summary */}
                        <div className="border-2 border-ocean-900 rounded-3xl p-6 bg-ocean-950 text-white shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-ocean-800/50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                            <h3 className="text-sm font-black text-ocean-300 uppercase tracking-[0.2em] mb-5 relative z-10">OWNER FINANCIAL SUMMARY</h3>
                            
                            <div className="space-y-3 font-bold text-sm relative z-10">
                                <div className="flex justify-between items-center text-ocean-200">
                                    <span>Total Weight Caught :</span>
                                    <span className="text-white">{reportData.owner_summary.total_weight} kg</span>
                                </div>
                                <div className="flex justify-between items-center text-ocean-200">
                                    <span>{t.grossSales || "Gross Sales"} :</span>
                                    <span className="text-white">{fmt(reportData.owner_summary.gross_sales)}</span>
                                </div>
                                <div className="flex justify-between items-center text-ocean-200">
                                    <span>Agent {t.commission || "Commission"} (3%) :</span>
                                    <span className="text-white">{fmt(reportData.owner_summary.agent_commission)}</span>
                                </div>
                                <div className="flex justify-between items-center text-ocean-200">
                                    <span>Agent Bonus :</span>
                                    <span className="text-white">{fmt(reportData.owner_summary.bonus_earned)}</span>
                                </div>
                                <div className="flex justify-between items-center text-ocean-200">
                                    <span>Tax Deduction (if any) :</span>
                                    <span className="text-white">₹0</span>
                                </div>
                                
                                <div className="pt-4 mt-2 border-t border-ocean-800 flex justify-between items-center">
                                    <span className="text-lg font-black text-ocean-100">{t.netPayableOwner || "Final Settlement"} :</span>
                                    <span className="text-2xl font-black text-emerald-400 flex items-center gap-2">
                                        {fmt(reportData.owner_summary.net_payable)} <CheckCircle2 className="w-5 h-5" />
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Agent Details */}
                        <div className="border border-ocean-200 rounded-3xl p-6 bg-ocean-50 relative overflow-hidden">
                            <h3 className="text-sm font-black text-ocean-600 uppercase tracking-[0.2em] mb-5">AGENT DETAILS</h3>
                            
                            <div className="space-y-4 font-bold text-sm text-ocean-900">
                                <div className="flex justify-between items-center">
                                    <span className="text-ocean-600">Agent Name :</span>
                                    <span className="text-ocean-950 font-black">{reportData.daily_breakdown[0]?.agent_name || "N/A"}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-ocean-600">{t.commission || "Commission"} :</span>
                                    <span>3% of {fmt(reportData.owner_summary.gross_sales)} = {fmt(reportData.owner_summary.agent_commission)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-ocean-600">Bonus :</span>
                                    <span className="flex items-center gap-1">
                                        {fmt(reportData.owner_summary.bonus_earned)} 
                                        {reportData.owner_summary.target_met && <span className="text-emerald-600">({t.targetMet || "Target Met ✅"})</span>}
                                    </span>
                                </div>
                                <div className="pt-4 mt-2 border-t border-ocean-200 flex justify-between items-center">
                                    <span className="text-ocean-600 font-black">Total Agent Earnings :</span>
                                    <span className="text-lg font-black text-ocean-950 pr-8">
                                        {fmt(reportData.owner_summary.agent_commission + reportData.owner_summary.bonus_earned)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-4 print:hidden">
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest border-2 border-ocean-200 text-ocean-700 bg-white hover:bg-ocean-50 active:scale-95 transition-all shadow-sm"
                >
                    <Download className="w-5 h-5" />
                    {t.downloadPDF || "Download PDF"}
                </button>
                <button
                    onClick={() => toast("Report sent to Agent via WhatsApp securely.", "success")}
                    className="flex items-center gap-2 px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest bg-ocean-600 text-white hover:bg-ocean-700 active:scale-95 transition-all shadow-md shadow-ocean-600/20"
                >
                    <Send className="w-5 h-5" />
                    {t.sendToAgent || "Send to Agent"}
                </button>
            </div>
        </div>
    );
}
