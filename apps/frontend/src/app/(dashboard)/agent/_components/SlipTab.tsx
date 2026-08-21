"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Printer, ArrowLeft, CheckCircle2, Send, Download, FileText, Users, Calendar } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { T_AGENT, EXP_KEYS, fmt, dispDate, SaleRow } from "@/components/shared/agentShared";
import api from "@/lib/api";
import { useToast } from '@fishmarket/ui';
import { SendToOwnerButton } from '@/components/shared/SendToOwnerButton';
import { Boat, Payment, ApiError } from '@fishmarket/shared-types';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

type SlipMode = 'boat' | 'buyer' | 'weekly';

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

interface DayBreakdown {
    date: string;
    salesTotal: number;
    advancesPaid: number;
}

interface WeeklyData {
    boat_name: string;
    start_date: string;
    end_date: string;
    daily_breakdown: DayBreakdown[];
    agent_summary: {
        total_sales: number;
        total_advances: number;
        commission_rate: number;
        balance: number;
    };
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const NRM_HEADER_STYLE: React.CSSProperties = {
    textAlign: 'center',
    borderBottom: '2px solid #000',
    paddingBottom: 12,
    marginBottom: 12,
};

const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });

const toKey = (d: Date) => d.toISOString().split('T')[0];

// ─────────────────────────────────────────────────────────────────
// NRM LETTERHEAD — used in all slip types
// ─────────────────────────────────────────────────────────────────

const NRMHeader: React.FC<{ agentName: string; slipNo?: string; date: string; toName: string; lang: string }> = ({
    agentName, slipNo, date, toName, lang
}) => (
    <div style={NRM_HEADER_STYLE}>
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 10, color: '#555', textAlign: 'left', lineHeight: 1.4 }}>
                <div>8056742243</div>
                <div>8124968255</div>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1 }}>
                    🐟 {agentName} Sea Foods
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#444', marginTop: 2 }}>
                    {lang === 'ta' ? 'ரோஸ்மாநகர் & மூக்கையூர்' : 'Rosamandagal & Mukkayur'}
                </div>
            </div>
            <div style={{ width: 70 }} />
        </div>

        {/* Slip # and Date row */}
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #ccc',
            borderBottom: '1px solid #ccc',
            padding: '4px 0',
            marginTop: 6,
        }}>
            {slipNo && (
                <span style={{ fontWeight: 900, fontSize: 16 }}>#{slipNo}</span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700 }}>
                Date: {formatDate(date)}
            </span>
        </div>

        {/* To: */}
        <div style={{ marginTop: 6, fontSize: 13, display: 'flex', gap: 8 }}>
            <span style={{ fontWeight: 700 }}>To:</span>
            <span style={{ fontWeight: 900, textDecoration: 'underline', flex: 1 }}>{toName}</span>
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────
// PHYSICAL-FORMAT TABLE — matches NRM slip column order
// Rate (விலை) | Fish (விவரம்) | Weight (எடை) | Amount (ரூபாய்)
// ─────────────────────────────────────────────────────────────────

const SlipTable: React.FC<{ rows: SaleRow[]; lang: string }> = ({ rows, lang }) => {
    const total = rows.reduce((s, r) => s + Math.round(Number(r.weight) * Number(r.rate)), 0);
    return (
        <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
            fontFamily: 'monospace',
        }}>
            <thead>
                <tr style={{ borderBottom: '1.5px solid #000' }}>
                    <th style={{ textAlign: 'left',  padding: '3px 4px', fontSize: 11, fontWeight: 900 }}>
                        {lang === 'ta' ? 'விலை' : 'Rate'}
                    </th>
                    <th style={{ textAlign: 'left',  padding: '3px 4px', fontSize: 11, fontWeight: 900, minWidth: 80 }}>
                        {lang === 'ta' ? 'விவரம்' : 'Fish'}
                    </th>
                    <th style={{ textAlign: 'right', padding: '3px 4px', fontSize: 11, fontWeight: 900 }}>
                        {lang === 'ta' ? 'எடை' : 'Wt.'}
                    </th>
                    <th style={{ textAlign: 'right', padding: '3px 4px', fontSize: 11, fontWeight: 900 }}>
                        {lang === 'ta' ? 'ரூபாய்' : 'Amount'}
                    </th>
                </tr>
            </thead>
            <tbody>
                {rows.map((r, i) => (
                    <tr key={r.id || i} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '3px 4px', fontWeight: 700 }}>{r.rate}</td>
                        <td style={{ padding: '3px 4px' }}>{r.fish || r.fishName}</td>
                        <td style={{ padding: '3px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {Number(r.weight).toFixed(3)}
                        </td>
                        <td style={{ padding: '3px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                            {Math.round(Number(r.weight) * Number(r.rate)).toLocaleString('en-IN')}
                        </td>
                    </tr>
                ))}
            </tbody>
            <tfoot>
                <tr style={{ borderTop: '1.5px solid #000', background: '#f9f9f9' }}>
                    <td colSpan={3} style={{ padding: '4px 4px', fontWeight: 900, fontSize: 12 }}>
                        {lang === 'ta' ? 'மொத்தம்' : 'Total'}
                    </td>
                    <td style={{ padding: '4px 4px', textAlign: 'right', fontWeight: 900, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                        {total.toLocaleString('en-IN')}
                    </td>
                </tr>
            </tfoot>
        </table>
    );
};

// ─────────────────────────────────────────────────────────────────
// VIEW 1: BOAT OWNER SLIP  (buyer names REMOVED)
// ─────────────────────────────────────────────────────────────────

const BoatOwnerSlip: React.FC<{
    lang: string;
    agentName: string;
    boatName: string;
    dateKey: string;
    rows: SaleRow[];
    commRate: number;
    commission: number;
    expAmts: Record<string, number>;
    rec: { notes: Record<string, string> };
    totalDed: number;
    netPay: number;
    payments: Payment[];
    totalPaid: number;
    remaining: number;
    settled: boolean;
    t: typeof T_AGENT['en'];
}> = ({ lang, agentName, boatName, dateKey, rows, commRate, commission, expAmts, rec, totalDed, netPay, payments, totalPaid, remaining, settled, t }) => {
    const totalSales = rows.reduce((s, r) => s + Math.round(Number(r.weight) * Number(r.rate)), 0);

    return (
        <div id="slip-print" style={{
            background: '#fff',
            color: '#000',
            fontFamily: '"Courier New", monospace',
            maxWidth: 420,
            margin: '0 auto',
            padding: '20px 18px',
            border: '1.5px solid #222',
            borderRadius: 4,
        }}>
            <NRMHeader agentName={agentName} date={dateKey} toName={boatName} lang={lang} />

            {/* Sales table — NO buyer column */}
            <SlipTable rows={rows} lang={lang} />

            {/* Deductions */}
            <div style={{ marginTop: 14, borderTop: '1px dashed #aaa', paddingTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700 }}>
                        {lang === 'ta' ? 'ஆயம்' : 'Commission'} ({commRate}%):
                    </span>
                    <span style={{ fontWeight: 700 }}>– {commission.toLocaleString('en-IN')}</span>
                </div>
                {EXP_KEYS.filter(k => expAmts[k] > 0).map(k => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>{t.expenses[k]}{rec.notes[k] ? ` (${rec.notes[k]})` : ''}</span>
                        <span>– {expAmts[k].toLocaleString('en-IN')}</span>
                    </div>
                ))}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderTop: '1px solid #000',
                    marginTop: 6,
                    paddingTop: 6,
                    fontWeight: 900,
                    fontSize: 13,
                }}>
                    <span>{lang === 'ta' ? 'மொத்த கழிவு' : 'Total Deductions'}:</span>
                    <span>– {totalDed.toLocaleString('en-IN')}</span>
                </div>
            </div>

            {/* Net payable */}
            <div style={{
                marginTop: 10,
                padding: '10px 12px',
                background: '#000',
                color: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderRadius: 4,
            }}>
                <span style={{ fontWeight: 900, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {lang === 'ta' ? 'நிகர செலுத்த வேண்டியது' : 'Net Payable'}
                </span>
                <span style={{ fontWeight: 900, fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>
                    ₹{netPay.toLocaleString('en-IN')}
                </span>
            </div>

            {/* Payments / Advances */}
            {payments.length > 0 && (
                <div style={{ marginTop: 12, fontSize: 12 }}>
                    <div style={{ fontWeight: 800, marginBottom: 4 }}>
                        {lang === 'ta' ? '💳 பற்று (முன்பணம்)' : '💳 Advances Paid'}
                    </div>
                    {payments.map((p, i) => (
                        <div key={p.id || i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{p.note || (lang === 'ta' ? 'பணம்' : 'Cash')}</span>
                            <span>– {Number(p.amount || p.amt).toLocaleString('en-IN')}</span>
                        </div>
                    ))}
                    <div style={{ borderTop: '1px solid #000', marginTop: 4, paddingTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
                        <span>{lang === 'ta' ? 'மொத்தம் கொடுத்தது' : 'Total Paid'}:</span>
                        <span>– {totalPaid.toLocaleString('en-IN')}</span>
                    </div>
                </div>
            )}

            {/* Remaining balance */}
            {payments.length > 0 && (
                <div style={{
                    marginTop: 10,
                    padding: '8px 12px',
                    background: settled ? '#dcfce7' : '#fef9c3',
                    border: `1.5px solid ${settled ? '#16a34a' : '#ca8a04'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderRadius: 4,
                }}>
                    <span style={{ fontWeight: 900, fontSize: 12 }}>
                        {lang === 'ta' ? 'இருப்பு (Balance)' : 'Balance Due'}:
                        {settled && ' ✅'}
                    </span>
                    <span style={{ fontWeight: 900, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
                        ₹{Math.max(0, remaining).toLocaleString('en-IN')}
                    </span>
                </div>
            )}

            {/* Gross total (small, at bottom) */}
            <div style={{ marginTop: 14, borderTop: '1px dashed #ccc', paddingTop: 8, fontSize: 11, color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                <span>{lang === 'ta' ? 'மீன் மொத்தம்' : 'Gross Fish Sales'}:</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>₹{totalSales.toLocaleString('en-IN')}</span>
            </div>
            
            {/* Footer */}
            <div style={{ marginTop: 24, textAlign: 'center', color: '#666', borderTop: '1px solid #ddd', paddingTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700 }}>
                    {lang === 'ta' ? 'நன்றி, மீண்டும் வருக!' : 'Thank you, visit again!'}
                </div>
                <div style={{ fontSize: 9, marginTop: 4 }}>
                    NRM Sea Foods — {lang === 'ta' ? 'எண்ணிம ரசீது' : 'Digital Settled'} © {new Date(dateKey).getFullYear()}
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────
// VIEW 2: BUYER SLIPS  (one per buyer, WITH buyer name as "To:")
// ─────────────────────────────────────────────────────────────────

const BuyerSlipsView: React.FC<{
    lang: string;
    agentName: string;
    dateKey: string;
    rows: SaleRow[];
}> = ({ lang, agentName, dateKey, rows }) => {
    // Group rows by buyer name
    const byBuyer: Record<string, SaleRow[]> = {};
    rows.forEach(r => {
        const buyer = r.buyerName || r.buyer || (lang === 'ta' ? 'பெயர் இல்லை' : 'No Name');
        if (!byBuyer[buyer]) byBuyer[buyer] = [];
        byBuyer[buyer].push(r);
    });

    const buyers = Object.keys(byBuyer);

    if (buyers.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8', fontWeight: 700 }}>
                🐟 {lang === 'ta' ? 'இன்று விற்பனை பதிவுகள் இல்லை' : 'No sales entries for today'}
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {buyers.map(buyer => {
                const buyerRows = byBuyer[buyer];
                const buyerTotal = buyerRows.reduce((s, r) => s + Math.round(Number(r.weight) * Number(r.rate)), 0);
                return (
                    <div
                        key={buyer}
                        className="buyer-slip-block"
                        data-buyer={buyer}
                        style={{
                            background: '#fff',
                            color: '#000',
                            fontFamily: '"Courier New", monospace',
                            maxWidth: 420,
                            margin: '0 auto',
                            width: '100%',
                            padding: '18px 16px',
                            border: '1.5px solid #222',
                            borderRadius: 4,
                            pageBreakAfter: 'always',
                        }}
                    >
                        <NRMHeader
                            agentName={agentName}
                            date={dateKey}
                            toName={buyer}
                            lang={lang}
                        />
                        <SlipTable rows={buyerRows} lang={lang} />

                        {/* Outstanding balance section */}
                        {buyerRows.some(r => Number(r.amountPaid || 0) > 0) && (() => {
                            const totalPaid = buyerRows.reduce((s, r) => s + Number(r.amountPaid || 0), 0);
                            const balance = buyerTotal - totalPaid;
                            return (
                                <div style={{ marginTop: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                                        <span>{lang === 'ta' ? 'கொடுத்தது' : 'Paid'}:</span>
                                        <span>– {totalPaid.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        borderTop: '1.5px solid #000',
                                        paddingTop: 4,
                                        fontSize: 14,
                                        fontWeight: 900,
                                        color: balance > 0 ? '#dc2626' : '#16a34a',
                                    }}>
                                        <span>{lang === 'ta' ? 'பாக்கி (பை)' : 'Balance (பை)'}:</span>
                                        <span>₹{Math.max(0, balance).toLocaleString('en-IN')}</span>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Print single buyer button (no-print class hides in print) */}
                        <div className="no-print" style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => {
                                    // BUG-003 FIX: Escaped buyer name to safely select the correct data-buyer element
                                    const slipElement = document.querySelector(`.buyer-slip-block[data-buyer="${CSS.escape(buyer)}"]`);
                                    if (!slipElement) return;

                                    const printContent = slipElement.innerHTML;
                                    const originalContent = document.body.innerHTML;
                                    document.body.innerHTML = printContent;
                                    window.print();
                                    document.body.innerHTML = originalContent;
                                    window.location.reload();
                                }}
                                style={{
                                    background: '#1e293b',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 8,
                                    padding: '6px 14px',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}
                            >
                                🖨 {lang === 'ta' ? 'இச்சீட்டை அச்சிடு' : 'Print This Slip'}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────
// VIEW 3: WEEKLY SETTLEMENT SLIP (Slip #641 style)
// ─────────────────────────────────────────────────────────────────

const WeeklySettlementSlip: React.FC<{
    lang: string;
    agentName: string;
    boat: Boat;
}> = ({ lang, agentName, boat }) => {
    const { toast } = useToast();
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);

    const [weekStart, setWeekStart] = useState(monday.toISOString().split('T')[0]);
    const [weekEnd,   setWeekEnd]   = useState(today.toISOString().split('T')[0]);
    const [data,      setData]      = useState<WeeklyData | null>(null);
    const [loading,   setLoading]   = useState(false);

    // BUG-007 FIX: Use single /range endpoint instead of looping API calls
    const fetchWeekly = useCallback(async () => {
        if (!boat) return;
        setLoading(true);
        try {
            const start = new Date(weekStart);
            const end = new Date(weekEnd);
            const daysCount = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            
            if (daysCount > 31) {
                toast(lang === 'ta' ? "31 நாட்களுக்கு மேல் தேர்ந்தெடுக்க முடியாது" : "Cannot select more than 31 days", "error");
                setLoading(false);
                return;
            }

            let totalSalesAll = 0;
            const breakdowns: DayBreakdown[] = [];
            
            // Loop for sales data
            for (let i = 0; i < daysCount; i++) {
                const d = new Date(start);
                d.setDate(d.getDate() + i);
                const dStr = toKey(d);
                try {
                    const res = await api.get(`/sales/history?boatId=${boat.id}&date=${dStr}`);
                    const daySales = res.data || [];
                    const salesTotal = daySales.reduce((s: number, r: any) => s + Math.round(Number(r.weight || 0) * Number(r.rate || 0)), 0);
                    
                    totalSalesAll += salesTotal;
                    
                    breakdowns.push({
                        date: dStr,
                        salesTotal,
                        advancesPaid: 0 
                    });
                } catch {
                    // skip day on error
                }
            }

            // Fetch all payments in date range in ONE request
            let totalAdv = 0;
            try {
                const payRes = await api.get(`/boat-payments/range?boatId=${boat.id}&startDate=${weekStart}&endDate=${weekEnd}`);
                const paymentsByDate = payRes.data || {};
                
                breakdowns.forEach(bd => {
                    const amt = paymentsByDate[bd.date] || 0;
                    bd.advancesPaid = amt;
                    totalAdv += amt;
                });
            } catch (err) {
                console.error("Failed to fetch payments range", err);
            }

            const ruleRes = await api.get('/reports/commission-rule');
            const rate = Number(ruleRes.data?.commission_rate ?? 2); 

            setData({
                boat_name: boat.name,
                start_date: weekStart,
                end_date: weekEnd,
                agent_summary: {
                    total_sales: totalSalesAll,
                    total_advances: totalAdv,
                    commission_rate: rate,
                    balance: totalSalesAll - totalAdv - Math.round(totalSalesAll * (rate / 100))
                },
                daily_breakdown: breakdowns
            });
        } catch (err: unknown) {
            const error = err as ApiError;
            console.error(error);
            toast(lang === 'ta' ? 'தரவுகளை எடுக்க முடியவில்லை' : 'Failed to fetch data', 'error');
        } finally {
            setLoading(false);
        }
    // BUG-022 FIX: Remove toast from dependencies to prevent infinite re-renders
    }, [boat, weekStart, weekEnd, lang]);

    useEffect(() => { fetchWeekly(); }, [fetchWeekly]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Date range picker */}
            <div className="no-print" style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                padding: '14px 18px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                alignItems: 'flex-end',
            }}>
                <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        {lang === 'ta' ? 'தொடக்க தேதி' : 'From'}
                    </div>
                    <input
                        type="date"
                        value={weekStart}
                        onChange={e => setWeekStart(e.target.value)}
                        style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 10px', fontSize: 13, fontWeight: 700 }}
                    />
                </div>
                <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        {lang === 'ta' ? 'கடைசி தேதி' : 'To'}
                    </div>
                    <input
                        type="date"
                        value={weekEnd}
                        onChange={e => setWeekEnd(e.target.value)}
                        style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 10px', fontSize: 13, fontWeight: 700 }}
                    />
                </div>
                <button
                    onClick={fetchWeekly}
                    disabled={loading}
                    style={{
                        background: '#0f172a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        padding: '9px 20px',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                        opacity: loading ? 0.6 : 1,
                    }}
                >
                    {loading ? '⏳ ...' : '🔍 ' + (lang === 'ta' ? 'கொண்டு வா' : 'Fetch')}
                </button>
            </div>

            {/* The weekly settlement slip */}
            {data && (
                <div id="weekly-slip-print" style={{
                    background: '#fff',
                    color: '#000',
                    fontFamily: '"Courier New", monospace',
                    maxWidth: 480,
                    margin: '0 auto',
                    width: '100%',
                    padding: '20px 18px',
                    border: '1.5px solid #222',
                    borderRadius: 4,
                }}>
                    <NRMHeader
                        agentName={agentName}
                        date={data.end_date}
                        toName={data.boat_name}
                        lang={lang}
                    />

                    {/* Per-day breakdown table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 14 }}>
                        <thead>
                            <tr style={{ borderBottom: '1.5px solid #000' }}>
                                <th style={{ textAlign: 'left', padding: '3px 4px', fontSize: 11 }}>
                                    {lang === 'ta' ? 'தேதி' : 'Date'}
                                </th>
                                <th style={{ textAlign: 'right', padding: '3px 4px', fontSize: 11 }}>
                                    {lang === 'ta' ? 'மீன் வரவு' : 'Fish Income'}
                                </th>
                                <th style={{ textAlign: 'right', padding: '3px 4px', fontSize: 11 }}>
                                    {lang === 'ta' ? 'பற்று (முன்பணம்)' : 'Advances Paid'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data.daily_breakdown || []).map((day: DayBreakdown) => (
                                <tr key={day.date} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '4px 4px', fontWeight: 700 }}>
                                        {formatDate(day.date)}
                                    </td>
                                    <td style={{ padding: '4px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                        {Math.round(day.salesTotal).toLocaleString('en-IN')}
                                    </td>
                                    <td style={{ padding: '4px 4px', textAlign: 'right', color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                                        {day.advancesPaid > 0 ? `– ${day.advancesPaid.toLocaleString('en-IN')}` : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {/* Weekly Totals Footer */}
                        <tfoot>
                            <tr style={{ background: '#f8fafc', borderTop: '2px solid #000' }}>
                                <td style={{ padding: '6px 4px', fontWeight: 900, fontSize: 12 }}>
                                    {lang === 'ta' ? 'வாரம் மொத்தம்' : 'Week Total'}
                                </td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 900, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                                    ₹{data.agent_summary.total_sales.toLocaleString('en-IN')}
                                </td>
                                <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 900, fontSize: 13, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                                    – {data.agent_summary.total_advances.toLocaleString('en-IN')}
                                </td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Deductions & Final Settlement */}
                    <div style={{ borderTop: '1px dashed #aaa', paddingTop: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                            <span style={{ fontWeight: 700 }}>
                                {lang === 'ta' ? 'ஆயம்' : 'Commission'} ({data.agent_summary.commission_rate}%):
                            </span>
                            <span style={{ fontWeight: 700, color: '#dc2626' }}>
                                – {Math.round(data.agent_summary.total_sales * (data.agent_summary.commission_rate / 100)).toLocaleString('en-IN')}
                            </span>
                        </div>
                        {/* Final இருப்பு */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            borderTop: '1.5px solid #000',
                            marginTop: 8,
                            paddingTop: 8,
                            fontSize: 16,
                            fontWeight: 900,
                            background: data.agent_summary.balance > 0 ? '#fef9c3' : '#dcfce7',
                            padding: '8px 10px',
                            borderRadius: 4,
                        }}>
                            <span>{lang === 'ta' ? 'இருப்பு (செலுத்த வேண்டியது)' : 'இருப்பு — Amount Due'}:</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                ₹{Math.max(0, data.agent_summary.balance).toLocaleString('en-IN')}
                            </span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ marginTop: 24, textAlign: 'center', color: '#666', borderTop: '1px solid #ddd', paddingTop: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700 }}>
                            NRM Sea Foods — {lang === 'ta' ? 'வாராந்திர பில்' : 'Weekly Bill'} © {new Date(data.end_date).getFullYear()}
                        </div>
                    </div>
                </div>
            )}

            {!data && !loading && (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontWeight: 700 }}>
                    {lang === 'ta' ? 'தேதி வரம்பைத் தேர்ந்தெடுத்து கொண்டு வாருங்கள்' : 'Select a date range and click Fetch'}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────
// MAIN SLIP TAB
// ─────────────────────────────────────────────────────────────────

export function SlipTab({
    lang, rec, boat, user, dateKey, commRate, commission, expAmts,
    totalDed, netPay, payments, totalPaid, remaining, settled,
    setTab, dailySales
}: SlipTabProps) {
    const t = T_AGENT[lang as 'en' | 'ta'];
    const [mode,         setMode]         = useState<SlipMode>('boat');
    const [sending,      setSending]      = useState(false);
    const [_sent,        setSent]         = useState(false);
    const [slipStatus,   setSlipStatus]   = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState<string | null>(null);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const { toast } = useToast();

    const agentName  = user?.name || t.fields.unknownAgent;
    const boatName   = boat?.name || t.fields.unknownBoat;
    const rowsToUse  = dailySales && dailySales.length > 0 ? dailySales : (rec.rows || []);
    const totalSales = rowsToUse.reduce((a, r) => a + Math.round(Number(r.weight || 0) * Number(r.rate || 0)), 0);

    React.useEffect(() => {
        const fetchStatus = async () => {
            if (!boat?.id || !dateKey) return;
            try {
                const res = await api.get(`/slips/status`, { params: { boatId: boat.id, date: dateKey } });
                if (res.data.exists) {
                    setSlipStatus(res.data.status);
                    setRejectReason(res.data.rejectReason);
                    if (['sent', 'read', 'approved'].includes(res.data.status)) setSent(true);
                }
            } catch (err) {
                console.error("Failed to check slip status", err);
            } finally {
                setCheckingStatus(false);
            }
        };
        fetchStatus();
    }, [boat?.id, dateKey]);

    const handleSendToOwner = async () => {
        if (!boat?.id) return;
        setSending(true);
        try {
            // NOTE: backend sendToOwner snapshots fish_name, weight, rate only — buyer_name intentionally excluded
            await api.post('/slips', {
                boatId: boat.id,
                date: dateKey,
                slipData: { sales: dailySales, commission, expAmts, totalDed, netPay, payments, totalPaid, remaining, settled }
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

    const handleDownloadPDF = async () => {
        if (isGeneratingPdf) return;
        setIsGeneratingPdf(true);
        await new Promise(r => setTimeout(r, 50));
        try {
            const doc = new jsPDF();
            const pw = doc.internal.pageSize.getWidth();
            const slipNo = `SLP-${dateKey.replace(/-/g, '')}-${boat?.id || '00'}`;

            doc.setFontSize(20);
            doc.text(agentName + ' Sea Foods', pw / 2, 20, { align: 'center' });
            doc.setFontSize(10);
            doc.text(t.slip.subtitle.toUpperCase(), pw / 2, 28, { align: 'center' });
            doc.line(20, 33, pw - 20, 33);
            doc.setFontSize(10);
            doc.text("BOAT: " + boatName.toUpperCase(), 20, 42);
            doc.text("DATE: " + dispDate(dateKey), pw - 20, 42, { align: 'right' });
            doc.text("SLIP NO: " + slipNo, 20, 48);

            // Table — Rate | Fish | Buyer | Weight | Amount
            autoTable(doc, {
                startY: 55,
                head: [['Rate', 'Fish', 'Buyer', 'Weight (kg)', 'Amount (₹)']],
                body: rowsToUse.map(r => [
                    r.rate,
                    r.fish || r.fishName || '',
                    r.buyer || '—',
                    Number(r.weight).toFixed(3),
                    Math.round(Number(r.weight) * Number(r.rate)).toLocaleString('en-IN')
                ]),
                styles: { fontSize: 9 },
                headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
                alternateRowStyles: { fillColor: [248, 250, 252] }
            });

            const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
            
            doc.setFontSize(10);
            let currentY = finalY;
            doc.text("Commission (" + commRate + "%): – " + fmt(commission), pw - 20, currentY, { align: 'right' });
            currentY += 6;
            
            if (totalDed - commission > 0) {
                doc.text("Other Expenses: – " + fmt(totalDed - commission), pw - 20, currentY, { align: 'right' });
                currentY += 6;
            }
            
            doc.setFontSize(11);
            doc.text("Total Deductions: – " + fmt(totalDed), pw - 20, currentY, { align: 'right' });
            currentY += 10;

            doc.setFontSize(14);
            doc.setTextColor(220, 38, 38);
            doc.text("NET PAYABLE: " + fmt(netPay), pw - 20, currentY, { align: 'right' });
            doc.save(`Slip_${boatName}_${dateKey}.pdf`);
            toast("PDF Downloaded", "success");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto pb-24 space-y-4">

            {/* Status banner */}
            {!checkingStatus && slipStatus && (
                <div className={`p-4 rounded-2xl border font-black flex items-center justify-between shadow-sm ${
                    slipStatus === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                    slipStatus === 'rejected' ? 'bg-red-50 border-red-200 text-red-800' :
                    'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                    <div className="flex items-center gap-3">
                        {slipStatus === 'approved' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> :
                         slipStatus === 'rejected' ? <span className="text-xl">⚠️</span> :
                         <Send className="w-5 h-5 text-blue-600" />}
                        <div>
                            <div className="uppercase tracking-widest text-[10px] opacity-70">Status</div>
                            <div className="text-sm">
                                {slipStatus === 'approved' ? 'Owner Approved' :
                                 slipStatus === 'rejected' ? 'Owner Rejected' : 'Awaiting Owner Review'}
                            </div>
                        </div>
                    </div>
                    {slipStatus === 'rejected' && rejectReason && (
                        <div className="text-xs max-w-[150px] text-right"><span className="opacity-70">Reason:</span> {rejectReason}</div>
                    )}
                </div>
            )}

            {/* ── Mode selector ───────────────────────────────────────── */}
            <div className="no-print flex bg-gray-100 p-1 rounded-2xl">
                {([
                    { id: 'boat',   icon: <FileText className="w-4 h-4" />,    label: lang === 'ta' ? '🚢 படகு சீட்டு' : '🚢 Boat Slip' },
                    { id: 'buyer',  icon: <Users className="w-4 h-4" />,       label: lang === 'ta' ? '👥 வாங்குபவர் சீட்டு' : '👥 Buyer Slips' },
                    { id: 'weekly', icon: <Calendar className="w-4 h-4" />,    label: lang === 'ta' ? '📅 வார கணக்கு' : '📅 Weekly' },
                ] as const).map(m => (
                    <button
                        key={m.id}
                        onClick={() => setMode(m.id as SlipMode)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
                            mode === m.id ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'
                        }`}
                    >
                        {m.icon}
                        <span className="truncate">{m.label}</span>
                    </button>
                ))}
            </div>

            {/* ── Action bar (boat slip only) ──────────────────────────── */}
            {mode === 'boat' && (
                <div className="no-print flex items-center justify-between bg-white p-3 rounded-2xl border border-gray-100 shadow-sm sticky top-0 z-10">
                    <button onClick={() => setTab("entry")} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex gap-2">
                        <button onClick={handleDownloadPDF} disabled={isGeneratingPdf}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all disabled:opacity-50">
                            <FileText className="w-4 h-4" />
                            {isGeneratingPdf ? '...' : 'PDF'}
                        </button>
                        <button onClick={() => window.print()}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all">
                            <Printer className="w-4 h-4" />
                            {t.actions.print}
                        </button>
                        <button
                            onClick={handleSendToOwner}
                            disabled={Boolean(sending || checkingStatus || (slipStatus && slipStatus !== 'rejected'))}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                                (slipStatus && slipStatus !== 'rejected')
                                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200 opacity-80"
                                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:bg-gray-100 disabled:text-gray-400"
                            }`}
                        >
                            {sending ? <Download className="w-4 h-4 animate-bounce" /> : <Send className="w-4 h-4" />}
                            {slipStatus === 'approved' ? 'Approved ✅' :
                             slipStatus === 'sent' || slipStatus === 'read' ? 'Sent 📤' :
                             slipStatus === 'rejected' ? (sending ? "Sending..." : "Resend Slip") :
                             (sending ? "Sending..." : "Send to Owner")}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Buyer slips action bar ──────────────────────────────── */}
            {mode === 'buyer' && (
                <div className="no-print flex items-center justify-between bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-sm font-black text-gray-600">
                        {lang === 'ta'
                            ? `${Object.keys(rowsToUse.reduce((a: Record<string,boolean>, r) => { a[r.buyerName || r.buyer || '—'] = true; return a; }, {})).length} வாங்குபவர்கள்`
                            : `${Object.keys(rowsToUse.reduce((a: Record<string,boolean>, r) => { a[r.buyerName || r.buyer || '—'] = true; return a; }, {})).length} Buyers`}
                    </span>
                    <button onClick={() => window.print()}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all">
                        <Printer className="w-4 h-4" />
                        {lang === 'ta' ? 'அனைத்தையும் அச்சிடு' : 'Print All Buyer Slips'}
                    </button>
                </div>
            )}

            {/* ── Weekly action bar ───────────────────────────────────── */}
            {mode === 'weekly' && (
                <div className="no-print flex items-center justify-end bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                    <button onClick={() => {
                        const el = document.getElementById('weekly-slip-print');
                        if (el) window.print();
                    }}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all">
                        <Printer className="w-4 h-4" />
                        {lang === 'ta' ? 'வார சீட்டு அச்சிடு' : 'Print Weekly Slip'}
                    </button>
                </div>
            )}

            {/* ── CONTENT ─────────────────────────────────────────────── */}
            {mode === 'boat' && (
                <BoatOwnerSlip
                    lang={lang}
                    agentName={agentName}
                    boatName={boatName}
                    dateKey={dateKey}
                    rows={rowsToUse}
                    commRate={commRate}
                    commission={commission}
                    expAmts={expAmts}
                    rec={rec}
                    totalDed={totalDed}
                    netPay={netPay}
                    payments={payments}
                    totalPaid={totalPaid}
                    remaining={remaining}
                    settled={settled}
                    t={t}
                />
            )}

            {mode === 'buyer' && (
                <BuyerSlipsView
                    lang={lang}
                    agentName={agentName}
                    dateKey={dateKey}
                    rows={rowsToUse}
                />
            )}

            {mode === 'weekly' && (
                <WeeklySettlementSlip
                    lang={lang}
                    agentName={agentName}
                    boat={boat}
                />
            )}

            {/* Send to owner structured report (boat mode only) */}
            {mode === 'boat' && totalSales > 0 && (
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
