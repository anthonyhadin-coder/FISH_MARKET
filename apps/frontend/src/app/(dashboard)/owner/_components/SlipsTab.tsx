"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Mail, RefreshCw, CheckCircle, Clock, ChevronDown, ChevronUp, Download } from 'lucide-react';
import api from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { T, Language } from '@/lib/i18n';
import { SaleRow, Payment } from '@/app/(dashboard)/agent/SharedUI';
import { useToast } from '@/components/ui/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import { generateBoatSlipPDF } from '@/lib/pdfService';
import { X } from 'lucide-react';
import { ApiError } from '@fishmarket/shared-types';

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const dispDate = (d: string) => {
    try {
        const date = new Date(d);
        if (isNaN(date.getTime())) return d;
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return d;
    }
};

interface SlipData {
    id: number;
    boat_id: number;
    agent_id: number;
    boatName: string;
    agentName: string;
    date: string;
    status: 'sent' | 'read' | 'approved' | 'rejected';
    sent_at: string;
    read_at?: string;
    reject_reason?: string;
    slip_data: {
        sales: SaleRow[];
        commission: number;
        expAmts: Record<string, number>;
        totalDed: number;
        netPay: number;
        payments: Payment[];
        totalPaid: number;
        remaining: number;
        settled: boolean;
    };
}

export function SlipsTab() {
    const { lang } = useLanguage();
    const t = T[lang as Language];
    const [slips, setSlips] = useState<SlipData[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const { toast } = useToast();

    const fetchSlips = useCallback(async () => {
        try {
            const res = await api.get('/slips');
            setSlips(res.data || []);
        } catch (err: unknown) {
            const error = err as ApiError;
            toast(error.response?.data?.message || "Failed to fetch slips", "error");
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchSlips();
        // Polling every 30 seconds
        const interval = setInterval(fetchSlips, 30000);
        return () => clearInterval(interval);
    }, [fetchSlips]);

    const handleExpand = async (slip: SlipData) => {
        const isCurrentlyExpanded = expandedId === slip.id;
        setExpandedId(isCurrentlyExpanded ? null : slip.id);

        if (!isCurrentlyExpanded && slip.status === 'sent') {
            try {
                // Mark as read immediately in UI
                setSlips(prev => prev.map(s => s.id === slip.id ? { ...s, status: 'read' } : s));
                // Call API to persist
                await api.patch(`/slips/${slip.id}/read`);
                // No need to refetch full list, local state is updated
            } catch {
                toast("Failed to mark slip as read", "error");
            }
        }
    };

    const handleApprove = async (e: React.MouseEvent, slip: SlipData) => {
        e.stopPropagation();
        if (submitting) return;
        setSubmitting(true);
        try {
            await api.patch(`/slips/${slip.id}/approve`);
            setSlips(prev => prev.map(s => s.id === slip.id ? { ...s, status: 'approved' } : s));
            toast("Slip Approved!", "success");
            
            // Auto generate PDF
            generateBoatSlipPDF({
                boatName: slip.boatName,
                agentName: slip.agentName,
                date: slip.date,
                sales: slip.slip_data.sales.map(s => ({
                    fishName: s.fishName || '—',
                    weight: Number(s.weight),
                    rate: Number(s.rate),
                    amount: Number(s.weight) * Number(s.rate)
                })),
                commission: slip.slip_data.commission,
                expAmts: slip.slip_data.expAmts,
                totalDed: slip.slip_data.totalDed,
                netPay: slip.slip_data.netPay,
                payments: slip.slip_data.payments,
                totalPaid: slip.slip_data.totalPaid,
                remaining: slip.slip_data.remaining,
                settled: slip.slip_data.settled
            }, lang as 'ta' | 'en');

        } catch (err: unknown) {
            const error = err as ApiError;
            toast(error.response?.data?.message || "Failed to approve slip", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleReject = async (e: React.MouseEvent, slipId: number) => {
        e.stopPropagation();
        if (!rejectReason.trim()) {
            toast("Please enter a reason for rejection", "error");
            return;
        }
        if (submitting) return;
        setSubmitting(true);
        try {
            await api.patch(`/slips/${slipId}/reject`, { reason: rejectReason });
            setSlips(prev => prev.map(s => s.id === slipId ? { ...s, status: 'rejected', reject_reason: rejectReason } : s));
            setRejectingId(null);
            setRejectReason("");
            toast("Slip Rejected", "error");
        } catch (err: unknown) {
            const error = err as ApiError;
            toast(error.response?.data?.message || "Failed to reject slip", "error");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-ocean-600">
                <RefreshCw className="w-8 h-8 animate-spin" />
                <span className="font-bold tracking-widest uppercase text-xs">Loading Inbox...</span>
            </div>
        );
    }

    if (slips.length === 0) {
        return (
            <div className="p-16 text-center border-2 border-dashed border-ocean-100 rounded-[2rem] bg-white flex flex-col items-center shadow-sm">
                <div className="w-20 h-20 bg-ocean-50 rounded-3xl flex items-center justify-center shadow-inner mb-6 border border-ocean-100">
                    <Mail className="w-10 h-10 text-ocean-600" />
                </div>
                <h3 className="text-ocean-950 font-black text-xl tracking-tight">Your Inbox is Empty</h3>
                <p className="text-ocean-700 mt-2 max-w-sm font-medium">When agents send daily boat slips, they will appear here instantly with full breakdown.</p>
                <button 
                    onClick={fetchSlips} 
                    className="mt-8 group flex items-center gap-2 px-6 py-3 bg-ocean-600 text-white rounded-2xl font-black text-sm hover:bg-ocean-700 shadow-xl shadow-ocean-600/20 transition-all active:scale-95"
                >
                    <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" /> 
                    Refresh Inbox
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center px-1 mb-6">
                <div>
                    <h2 className="text-3xl font-black text-ocean-950 tracking-tight italic uppercase flex items-center gap-3">
                        <Mail className="w-6 h-6 text-ocean-600" /> {t.inbox || (lang === "ta" ? "ரசீதுகள்" : "Inbox")}
                        <span className="text-[10px] font-black text-ocean-600 ml-1 border border-ocean-100 px-3 py-1 rounded-full">{slips.length}</span>
                    </h2>
                </div>
                <button onClick={fetchSlips} className="p-3 text-ocean-600 hover:text-ocean-900 hover:bg-ocean-50 rounded-2xl transition-all border border-transparent hover:border-ocean-100 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"><RefreshCw className="w-4 h-4" /> Refresh</button>
            </div>

            {slips.map(slip => {
                const isUnread = slip.status === 'sent';
                const isExpanded = expandedId === slip.id;
                
                return (
                    <Card key={slip.id} className={`overflow-hidden transition-all duration-500 rounded-[2.5rem] border ${isUnread ? 'bg-gradient-to-br from-ocean-50/50 to-white border-ocean-200 shadow-2xl shadow-ocean-500/10' : 'bg-white border-ocean-50 shadow-sm hover:shadow-xl hover:shadow-ocean-900/5'}`}>
                        {/* Header (Summary) */}
                        <div 
                            onClick={() => handleExpand(slip)}
                            className="p-7 cursor-pointer flex items-center justify-between group relative"
                        >
                            {isUnread && <div className="absolute top-0 right-0 w-24 h-24 bg-ocean-100/30 rounded-bl-[4rem] -mr-8 -mt-8" />}
                            <div className="flex items-center gap-6 relative z-10">
                                <div className={`w-3.5 h-3.5 rounded-full transition-all duration-700 ${isUnread ? 'bg-ocean-600 ring-[8px] ring-ocean-100 animate-pulse' : 'bg-ocean-100'}`} />
                                <div>
                                    <div className="flex items-center gap-4">
                                        <h3 className={`text-xl font-black tracking-tight ${isUnread ? 'text-ocean-950' : 'text-ocean-900'}`}>{slip.boatName}</h3>
                                        <span className="text-[11px] px-3.5 py-1.5 rounded-xl bg-gray-50 text-ocean-600 font-black tracking-widest uppercase border border-ocean-100 shadow-sm">{dispDate(slip.date)}</span>
                                    </div>
                                    <div className="text-[10px] text-ocean-600 mt-2 flex items-center gap-2 font-black uppercase tracking-[0.15em]">
                                        <span className="text-ocean-600 italic bg-ocean-50 px-2 py-0.5 rounded-lg">{slip.agentName}</span>
                                        <span className="opacity-30">•</span>
                                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-ocean-600" /> {new Date(slip.sent_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-8 relative z-10">
                                <div className="text-right">
                                    <div className="text-[10px] text-ocean-600 font-black uppercase tracking-[0.2em] mb-1.5">Net Payable</div>
                                    <div className={`text-3xl font-black tabular-nums tracking-tighter leading-none ${isUnread ? 'text-ocean-600' : 'text-ocean-950'}`}>{fmt(slip.slip_data.netPay)}</div>
                                </div>
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${isExpanded ? 'bg-ocean-600 text-white shadow-xl shadow-ocean-600/30' : 'bg-ocean-50 text-ocean-400 group-hover:bg-ocean-100 group-hover:text-ocean-600'}`}>
                                    {isExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                                </div>
                            </div>
                        </div>

                        {/* Expanded Content (Full Slip) */}
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden bg-white border-t border-ocean-50"
                                >
                                    <div className="p-10 border-t border-ocean-50 bg-gray-50/30">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                            {/* Left Column: Totals & Deductions */}
                                            <div className="space-y-6">
                                                <h4 className="text-[10px] font-black text-ocean-600 uppercase tracking-[0.2em] mb-4 border-b border-ocean-100 pb-3 flex items-center justify-between">Financial Breakdown</h4>
                                                <div className="space-y-4">
                                                    {/* Sales Total */}
                                                    <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-ocean-50 shadow-sm">
                                                        <span className="font-black text-ocean-950 text-xs uppercase tracking-tight">Gross Sales</span>
                                                        <span className="font-black text-ocean-950 text-lg tabular-nums tracking-tighter">{fmt((slip.slip_data.sales || []).reduce((sum, r) => sum + (Number(r.weight) * Number(r.rate)), 0))}</span>
                                                    </div>
                                                    
                                                    {/* Deductions breakdown */}
                                                    <div className="p-6 bg-white rounded-[2rem] border border-ocean-100 shadow-sm space-y-4">
                                                        <div className="text-[10px] font-black text-coral-600 tracking-[0.2em] uppercase mb-4">Deductions Applied</div>
                                                        <div className="flex justify-between items-center text-ocean-900">
                                                            <span className="text-xs font-bold">Market Commission</span>
                                                            <span className="font-black tabular-nums text-coral-600">– {fmt(slip.slip_data.commission)}</span>
                                                        </div>
                                                        {Object.entries(slip.slip_data.expAmts || {}).filter((entry) => entry[1] > 0).map(([k, v]) => (
                                                            <div key={k} className="flex justify-between items-center text-ocean-900">
                                                                <span className="text-xs font-bold capitalize">{k.replace('_',' ')}</span>
                                                                <span className="font-black tabular-nums text-coral-600">– {fmt(v)}</span>
                                                            </div>
                                                        ))}
                                                        <div className="flex justify-between items-center text-coral-600 font-black pt-4 border-t border-ocean-50 mt-4">
                                                            <span className="text-xs uppercase tracking-widest">Total Expenses</span>
                                                            <span className="text-xl tracking-tighter">– {fmt(slip.slip_data.totalDed)}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Final Net */}
                                                    <div className="flex justify-between items-center p-6 bg-ocean-600 text-white rounded-[2rem] shadow-xl shadow-ocean-600/20">
                                                        <span className="font-black text-xs uppercase tracking-widest text-ocean-100">Net Final Payable</span>
                                                        <span className="font-black text-2xl tabular-nums tracking-tighter">{fmt(slip.slip_data.netPay)}</span>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="mt-8">
                                                        {slip.status === 'approved' && (
                                                            <div className="w-full text-center py-4 bg-emerald-50 border border-emerald-200 text-emerald-700 font-black rounded-2xl flex items-center justify-center gap-2">
                                                                <CheckCircle className="w-5 h-5" /> 
                                                                Slip Approved
                                                            </div>
                                                        )}

                                                        {slip.status === 'rejected' && (
                                                            <div className="w-full text-center py-4 bg-coral-50 border border-coral-200 text-coral-700 font-black rounded-2xl flex flex-col items-center justify-center gap-1">
                                                                <div className="flex flex-row items-center gap-2">
                                                                    <X className="w-5 h-5" /> 
                                                                    Slip Rejected
                                                                </div>
                                                                <span className="text-xs font-medium opacity-80 mt-1">Reason: {slip.reject_reason}</span>
                                                            </div>
                                                        )}

                                                        {(slip.status === 'sent' || slip.status === 'read') && !rejectingId && (
                                                            <div className="flex gap-4">
                                                                <button 
                                                                    disabled={submitting}
                                                                    onClick={(e) => setRejectingId(slip.id)}
                                                                    className="flex-1 py-4 bg-white border-2 border-coral-200 text-coral-600 font-black rounded-2xl hover:bg-coral-50 transition-all disabled:opacity-50"
                                                                >
                                                                    Reject ❌
                                                                </button>
                                                                <button 
                                                                    disabled={submitting}
                                                                    onClick={(e) => handleApprove(e, slip)}
                                                                    className="flex-[2] py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                                >
                                                                    {submitting ? "Appving..." : "Approve Slip ✅"}
                                                                </button>
                                                            </div>
                                                        )}

                                                        {rejectingId === slip.id && (
                                                            <div className="p-4 bg-coral-50 rounded-2xl border border-coral-200 shadow-inner flex flex-col gap-3">
                                                                <label className="text-xs font-black text-coral-800 uppercase tracking-widest">Reason for Rejection</label>
                                                                <input 
                                                                    autoFocus
                                                                    className="w-full px-4 py-3 rounded-xl border border-coral-200 text-sm focus:outline-none focus:ring-2 focus:ring-coral-400"
                                                                    placeholder="e.g., Commission is incorrect"
                                                                    value={rejectReason}
                                                                    onChange={(e) => setRejectReason(e.target.value)}
                                                                />
                                                                <div className="flex gap-2">
                                                                    <button 
                                                                        disabled={submitting}
                                                                        onClick={() => { setRejectingId(null); setRejectReason(""); }}
                                                                        className="flex-1 py-3 bg-white text-coral-600 font-bold rounded-xl text-sm hover:bg-coral-100 disabled:opacity-50"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                    <button 
                                                                        disabled={submitting}
                                                                        onClick={(e) => handleReject(e, slip.id)}
                                                                        className="flex-[2] py-3 bg-coral-600 text-white font-black rounded-xl text-sm shadow-md hover:bg-coral-700 transition-all disabled:opacity-50"
                                                                    >
                                                                        {submitting ? "Rejecting..." : "Confirm Reject"}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            generateBoatSlipPDF({
                                                                boatName: slip.boatName,
                                                                agentName: slip.agentName,
                                                                date: slip.date,
                                                                sales: slip.slip_data.sales.map(s => ({
                                                                    fishName: s.fishName || '—',
                                                                    weight: Number(s.weight),
                                                                    rate: Number(s.rate),
                                                                    amount: Number(s.weight) * Number(s.rate)
                                                                })),
                                                                commission: slip.slip_data.commission,
                                                                expAmts: slip.slip_data.expAmts,
                                                                totalDed: slip.slip_data.totalDed,
                                                                netPay: slip.slip_data.netPay,
                                                                payments: slip.slip_data.payments,
                                                                totalPaid: slip.slip_data.totalPaid,
                                                                remaining: slip.slip_data.remaining,
                                                                settled: slip.slip_data.settled
                                                            }, lang as 'ta' | 'en');
                                                        }}
                                                        className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-ocean-100 text-ocean-600 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-ocean-50 hover:border-ocean-300 hover:shadow-lg transition-all"
                                                    >
                                                        <Download className="w-4 h-4" /> {t.download || "Download PDF"}
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {/* Right Column: Payments & Status */}
                                            <div className="space-y-6">
                                                <h4 className="text-[10px] font-black text-ocean-600 uppercase tracking-[0.2em] mb-4 border-b border-ocean-100 pb-3">Settlement History</h4>
                                                <div className="space-y-4">
                                                    {(slip.slip_data.payments || []).length > 0 ? (
                                                        <div className="space-y-3">
                                                            {slip.slip_data.payments.map((p, i) => (
                                                                <div key={i} className="flex justify-between items-center text-emerald-950 bg-emerald-50 px-5 py-4 rounded-2xl border border-emerald-100 shadow-sm">
                                                                    <span className="flex items-center gap-3 text-xs font-black uppercase tracking-tight">
                                                                        <CheckCircle className="w-5 h-5 text-emerald-600" /> 
                                                                        {p.note || 'Cash Settlement'}
                                                                    </span>
                                                                    <span className="font-black tabular-nums text-lg tracking-tighter">{fmt(p.amount || p.amt || 0)}</span>
                                                                </div>
                                                            ))}
                                                            <div className="flex justify-between text-ocean-400 px-2 pt-2 text-[10px] font-black uppercase tracking-widest">
                                                                <span>Total Received Today</span>
                                                                <span className="text-ocean-900">{fmt(slip.slip_data.totalPaid)}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-gray-50 border border-dashed border-ocean-100 rounded-2xl p-8 text-center">
                                                            <p className="text-ocean-300 text-[10px] font-black uppercase tracking-[0.2em]">No payments recorded for this slip</p>
                                                        </div>
                                                    )}
                                                    
                                                    <div className={`mt-6 p-8 rounded-[2rem] border-2 flex justify-between items-center transition-all ${slip.slip_data.settled ? 'border-emerald-100 bg-emerald-50 shadow-lg shadow-emerald-500/5' : 'border-amber-100 bg-amber-50 shadow-lg shadow-amber-500/5'}`}>
                                                        <div>
                                                            <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${slip.slip_data.settled ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                                Current Balance
                                                            </div>
                                                            {slip.slip_data.settled && <div className="text-[10px] text-emerald-600/60 font-black uppercase tracking-widest mt-1.5 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Fully Settled</div>}
                                                        </div>
                                                        <span className={`text-3xl font-black tabular-nums tracking-tighter ${slip.slip_data.settled ? 'text-emerald-950' : 'text-amber-900'}`}>
                                                            {fmt(Math.max(0, slip.slip_data.remaining))}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                            </motion.div>
                        )}
                        </AnimatePresence>
                    </Card>
                );
            })}
        </div>
    );
}
