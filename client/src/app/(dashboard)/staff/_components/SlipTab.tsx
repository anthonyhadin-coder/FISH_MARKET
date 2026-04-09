"use client";
import React, { useState } from "react";
import { Printer, ArrowLeft, CheckCircle2, Send, Download, FileText } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { T_AGENT, G, EXP_KEYS, fmt, dispDate, SaleRow } from "../SharedUI";
import api from "@/lib/api";
import { useToast } from '@/components/ui/Toast';
import { SendToOwnerButton } from '@/components/shared/SendToOwnerButton';
import { Boat, Payment, ApiError } from "@/lib/types";

interface SlipTabProps {
    lang: string;
    rec: { exp: Record<string, string>; notes: Record<string, string>; rows: SaleRow[] };
    boat: Boat;
    user: { id: string; name: string; role: string } | null;
    dateKey: string;
    commRate: number;
    commission: number;
    expAmts: Record<string, number>;
    totalDed: number;
    netPay: number;
    payments: Payment[];
    totalPaid: number;
    remaining: number;
    settled: boolean;
    setTab: (tab: "entry" | "slip" | "reports") => void;
    dailySales: SaleRow[];
}

export function SlipTab({ lang, rec, boat, user, dateKey, commRate, commission, expAmts, totalDed, netPay, payments, totalPaid, remaining, settled, setTab, dailySales }: SlipTabProps) {
    const t = T_AGENT[lang as 'en' | 'ta'];
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [slipStatus, setSlipStatus] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState<string | null>(null);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const fetchStatus = async () => {
            if (!boat?.id || !dateKey) return;
            try {
                const res = await api.get(`/slips/status`, { params: { boatId: boat.id, date: dateKey } });
                if (res.data.exists) {
                    setSlipStatus(res.data.status);
                    setRejectReason(res.data.rejectReason);
                    if (res.data.status === 'sent' || res.data.status === 'read' || res.data.status === 'approved') {
                        setSent(true);
                    }
                }
            } catch (err) {
                console.error("Failed to check slip status", err);
            } finally {
                setCheckingStatus(false);
            }
        };
        fetchStatus();
    }, [boat?.id, dateKey]);

    const actualRec = {
        boat: boat?.name || t.fields.unknownBoat,
        agent: user?.name || t.fields.unknownAgent
    };

    const rowsToGroup = dailySales && dailySales.length > 0 ? dailySales : (rec.rows || []);
    const actualTotalSales = rowsToGroup.reduce((a, r) => a + Math.round((+r.weight||0)*(+r.rate||0)), 0);

    const handleSendToOwner = async () => {
        if (!boat?.id) return;
        setSending(true);
        try {
            const slipData = {
                sales: dailySales,
                commission,
                expAmts,
                totalDed,
                netPay,
                payments,
                totalPaid,
                remaining,
                settled
            };
            
            await api.post('/slips', {
                boatId: boat.id,
                date: dateKey,
                slipData
            });
            
            setSent(true);
            setSlipStatus("sent");
            toast(slipStatus === 'rejected' ? "Slip resent to owner" : "Slip sent to owner", "success");
        } catch (err: unknown) {
            const error = err as ApiError;
            toast(error.response?.data?.message || "Failed to send slip", "error");
        } finally {
            setSending(false);
        }
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        
        // Header
        doc.setFontSize(22);
        doc.setTextColor(8, 47, 73); // ocean-950
        doc.text(actualRec.agent + (lang === 'ta' ? ' Sea Foods' : ' Sea Foods'), pageWidth / 2, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105); // muted
        doc.text(t.slip.subtitle.toUpperCase(), pageWidth / 2, 28, { align: 'center' });
        
        // Meta info
        doc.setDrawColor(224, 242, 254);
        doc.line(20, 35, pageWidth - 20, 35);
        
        doc.setFontSize(10);
        doc.text("BOAT OWNER: " + actualRec.boat.toUpperCase(), 20, 45);
        doc.text("DATE: " + dispDate(dateKey), pageWidth - 20, 45, { align: 'right' });
        
        // Sales Table
        const tableBody = rowsToGroup.map((r, i) => [
            i + 1,
            r.fish + "\n" + (r.buyerName || r.buyer || '—'),
            r.weight + " kg",
            "@" + r.rate,
            Math.round(Number(r.weight) * Number(r.rate)).toLocaleString('en-IN')
        ]);
        
        autoTable(doc, {
            startY: 55,
            head: [['#', 'Fish / Buyer', 'Weight', 'Rate', 'Amount']],
            body: tableBody,
            styles: { fontSize: 9, font: 'helvetica' },
            headStyles: { fillColor: [8, 47, 73], textColor: [255, 255, 255] },
            alternateRowStyles: { fillColor: [248, 250, 252] }
        });
        
        const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
        
        // Totals
        doc.setFontSize(12);
        doc.text("TOTAL SALES: " + fmt(actualTotalSales), pageWidth - 20, finalY, { align: 'right' });
        
        // Deductions
        let dedY = finalY + 15;
        doc.setFontSize(10);
        doc.text("DEDUCTIONS:", 20, dedY);
        dedY += 7;
        doc.text("- Commission (" + commRate + "%):", 25, dedY);
        doc.text(fmt(commission), pageWidth - 20, dedY, { align: 'right' });
        
        EXP_KEYS.filter(k => expAmts[k] > 0).forEach(k => {
            dedY += 7;
            doc.text("- " + (t.expenses[k]) + ":", 25, dedY);
            doc.text(fmt(expAmts[k]), pageWidth - 20, dedY, { align: 'right' });
        });
        
        dedY += 10;
        doc.setDrawColor(244, 63, 94); // coral
        doc.line(pageWidth - 60, dedY - 5, pageWidth - 20, dedY - 5);
        doc.setFontSize(14);
        doc.setTextColor(244, 63, 94);
        doc.text("NET PAYABLE: " + fmt(netPay), pageWidth - 20, dedY, { align: 'right' });
        
        // Footer
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text("Generated by Fish Market Ledger System", pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
        
        doc.save(`Slip_${actualRec.boat}_${dateKey}.pdf`);
        toast("PDF Downloaded", "success");
    };

    return (
        <div className="max-w-xl mx-auto pb-20 space-y-4">
            {/* Status Banners */}
            {!checkingStatus && slipStatus && (
                <div className={`p-4 rounded-2xl border font-black flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 ${
                    slipStatus === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                    slipStatus === 'rejected' ? 'bg-coral-50 border-coral-200 text-coral-800' :
                    'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                    <div className="flex items-center gap-3">
                        {slipStatus === 'approved' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> :
                         slipStatus === 'rejected' ? <span className="text-xl">⚠️</span> :
                         <Send className="w-5 h-5 text-blue-600" />}
                        <div>
                            <div className="uppercase tracking-widest text-[10px] opacity-70">Current Status</div>
                            <div className="text-sm">
                                {slipStatus === 'approved' ? 'Owner Approved this Slip' :
                                 slipStatus === 'rejected' ? 'Owner Rejected this Slip' :
                                 'Awaiting Owner Review'}
                            </div>
                        </div>
                    </div>
                    {slipStatus === 'rejected' && rejectReason && (
                        <div className="text-xs max-w-[150px] text-right">
                            <span className="opacity-70">Reason:</span> {rejectReason}
                        </div>
                    )}
                </div>
            )}

            {/* Action Bar */}
            <div className="no-print flex items-center justify-between bg-white p-3 rounded-2xl border border-gray-100 shadow-sm sticky top-0 z-10 transition-all">
                <button 
                    onClick={() => setTab("entry")} 
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex gap-2">
                    <button 
                        onClick={handleDownloadPDF} 
                        data-testid="download-pdf-btn"
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
                    >
                        <FileText className="w-4 h-4" />
                        PDF
                    </button>
                    <button 
                        onClick={() => window.print()} 
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all"
                    >
                        <Printer className="w-4 h-4" />
                        {t.actions.print}
                    </button>
                    <button 
                        onClick={handleSendToOwner}
                        disabled={Boolean(sending || checkingStatus || (slipStatus && slipStatus !== 'rejected'))}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                            (slipStatus && slipStatus !== 'rejected') 
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-200 opacity-80" 
                                : "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none"
                        }`}
                    >
                        {sending ? <Download className="w-4 h-4 animate-bounce" /> : <Send className="w-4 h-4" />}
                        {slipStatus === 'approved' ? 'Approved ✅' : 
                         slipStatus === 'sent' || slipStatus === 'read' ? 'Sent 📤' : 
                         slipStatus === 'rejected' ? (sending ? "Sending..." : "Resend Slip") :
                         (sending ? "Sending..." : "Send Slip")}
                    </button>
                </div>
            </div>

            {/* The Slip */}
            <div id="slip-print" className="bg-white p-8 md:p-12 shadow-2xl rounded-3xl border border-ocean-100 text-ocean-950 font-mono relative overflow-hidden">
                {/* Visual Decorative Element */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-ocean-900" />
                
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="flex items-center justify-center mb-4">
                        <div className="w-12 h-12 bg-ocean-900 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg">
                            {actualRec.agent.charAt(0).toUpperCase()}
                        </div>
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter mb-1 text-ocean-950">{actualRec.agent} {lang === 'ta' ? 'சீ ஃபுட்ஸ்' : 'Sea Foods'}</h2>
                    <p className="text-[11px] font-black text-ocean-500 uppercase tracking-[0.2em]">{t.slip.subtitle}</p>
                </div>

                {/* Metadata */}
                <div className="flex justify-between items-end mb-8 pb-4 border-b border-ocean-100">
                    <div>
                        <p className="text-[10px] font-black text-ocean-500 uppercase tracking-widest mb-1">To Boat Owner</p>
                        <h4 className="text-xl font-black text-ocean-950 underline decoration-2 underline-offset-4 decoration-ocean-200">{actualRec.boat}</h4>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-ocean-500 uppercase tracking-widest mb-1">Settlement Date</p>
                        <p className="font-black text-ocean-950">{dispDate(dateKey)}</p>
                    </div>
                </div>

                {/* Sales Table */}
                <div className="mb-10">
                    <div className="grid grid-cols-12 gap-2 text-[11px] font-black text-ocean-700 uppercase tracking-widest mb-3 px-2">
                        <div className="col-span-1 text-center">#</div>
                        <div className="col-span-6">{t.fields.fish} / {t.fields.buyer}</div>
                        <div className="col-span-2 text-right">{t.fields.weight}</div>
                        <div className="col-span-3 text-right">{t.fields.amount}</div>
                    </div>
                    
                    <div className="space-y-1">
                        {rowsToGroup.map((r, i) => {
                            const amt = Math.round(Number(r.weight||0) * Number(r.rate||0));
                            return (
                                <div key={r.id || i} className="grid grid-cols-12 gap-2 text-xs py-2 px-2 items-start border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                    <div className="col-span-1 text-ocean-300 text-center font-black">{i+1}</div>
                                    <div className="col-span-6">
                                        <div className="font-black text-ocean-950">{r.fish}</div>
                                        <div className="text-[10px] text-ocean-500 font-bold uppercase">{r.buyerName || r.buyer || '—'} @ {r.rate}</div>
                                    </div>
                                    <div className="col-span-2 text-right font-black text-ocean-700">{r.weight}</div>
                                    <div className="col-span-3 text-right font-black text-ocean-950 tracking-tight">{amt.toLocaleString('en-IN')}</div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 flex justify-between items-center p-4 bg-ocean-50 rounded-2xl border border-ocean-100">
                        <span className="text-[11px] font-black text-ocean-600 uppercase tracking-widest">{t.summary.subTotal}</span>
                        <span className="text-xl font-black text-ocean-950">{fmt(actualTotalSales, t.fields.unitCurrency)}</span>
                    </div>
                </div>

                {/* Deductions Box */}
                <div className="bg-white border-2 border-dashed border-ocean-200 rounded-3xl p-6 mb-8 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <CheckCircle2 className="w-5 h-5 text-ocean-400" />
                        <span className="text-[11px] font-black text-ocean-700 uppercase tracking-widest">{t.slip.deductions}</span>
                    </div>
                    
                    <div className="space-y-4 font-black text-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-ocean-700 uppercase text-[10px] tracking-widest">{t.summary.commission} ({commRate}%)</span>
                            <span className="text-coral-600 text-lg">– {fmt(commission, t.fields.unitCurrency)}</span>
                        </div>

                        {EXP_KEYS.filter(k => expAmts[k] > 0).map(k => (
                            <div key={k} className="flex justify-between items-center">
                                <span className="text-ocean-700 uppercase text-[10px] tracking-widest">
                                    {lang === 'ta' && k === 'other' ? "மற்றவை" : t.expenses[k]}
                                    {rec.notes[k] ? ` (${rec.notes[k]})` : ""}
                                </span>
                                <span className="text-coral-600 text-lg">– {fmt(expAmts[k], t.fields.unitCurrency)}</span>
                            </div>
                        ))}

                        <div className="pt-4 mt-4 border-t border-ocean-100 flex justify-between items-center">
                            <span className="font-black uppercase tracking-widest text-[11px] text-ocean-950">{t.summary.totalDed}</span>
                            <span className="font-black text-coral-600 text-xl tracking-tight">– {fmt(totalDed, t.fields.unitCurrency)}</span>
                        </div>
                    </div>
                </div>

                {/* Final Total (Big Bold) */}
                <div className="bg-ocean-950 rounded-3xl p-8 mb-8 text-white flex flex-col items-center shadow-2xl">
                    <p className="text-[11px] font-black text-ocean-400 uppercase tracking-[0.3em] mb-4 text-center">{t.summary.netPayable}</p>
                    <h3 className="text-5xl font-black tracking-tighter leading-none">{fmt(netPay, t.fields.unitCurrency)}</h3>
                </div>

                {/* Payments & Remaining */}
                {payments.length > 0 && (
                    <div className="space-y-6">
                        <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100/50">
                            <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">💳 {t.slip.paymentsMade}</div>
                            <div className="space-y-3 text-xs">
                                {payments.map((p, i) => (
                                    <div key={p.id || i} className="flex justify-between items-center font-bold text-blue-700">
                                        <div className="flex flex-col">
                                            <span>{p.note || 'Cash Settlement'}</span>
                                            <span className="text-[9px] opacity-60 uppercase">{new Date(p.date || p.time || 0).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <span className="text-sm font-black">– {fmt(p.amount || p.amt, t.fields.unitCurrency)}</span>
                                    </div>
                                ))}
                                <div className="pt-3 mt-3 border-t border-blue-200 flex justify-between items-center text-sm font-black text-blue-800">
                                    <span className="text-[10px] uppercase tracking-widest">{t.slip.totalPaid}</span>
                                    <span>– {fmt(totalPaid, t.fields.unitCurrency)}</span>
                                </div>
                            </div>
                        </div>

                        <div className={`p-6 rounded-3xl border-2 flex justify-between items-center ${
                            settled ? "bg-green-50 border-green-500/20 text-green-700" : "bg-coral-50 border-coral-500/20 text-coral-700"
                        }`}>
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-widest mb-0.5">{t.summary.remaining}</h4>
                                {settled && <div className="text-[10px] font-bold flex items-center gap-1">✅ {t.summary.settled}</div>}
                            </div>
                            <span className="text-3xl font-black tracking-tight">{fmt(Math.max(0, remaining), t.fields.unitCurrency)}</span>
                        </div>
                    </div>
                )}

                {/* Footer Seal */}
                <div className="mt-16 text-center opacity-40 select-none pointer-events-none">
                    <div className="w-20 h-20 border-4 border-ocean-900 rounded-full mx-auto flex items-center justify-center -rotate-12 mb-4">
                        <div className="text-[9px] font-black uppercase leading-tight text-ocean-900">
                            DIGITAL<br/>SETTLED<br/>{new Date().getFullYear()}
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-ocean-600">
                        <span>{t.slip.generatedBy}: {actualRec.agent}</span>
                        <span>CERTIFIED DIGITAL SLIP</span>
                    </div>
                </div>
            </div>

            {/* Send to Owner (Structured Report) */}
            {actualTotalSales > 0 && (
                <div className="no-print mt-4 space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                        {lang === 'ta' ? '📊 அதிகாரப்பூர்வ அறிக்கை' : '📊 Formal Catch Report'}
                    </p>
                    <SendToOwnerButton
                        boatId={Number(boat.id)}
                        boatName={boat.name}
                        reportDate={dateKey}
                        lang={lang as 'en' | 'ta'}
                    />
                </div>
            )}
        </div>
    );
}
