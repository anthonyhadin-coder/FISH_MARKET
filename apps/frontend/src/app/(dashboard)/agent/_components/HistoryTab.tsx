"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2, MessageCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { shareToWhatsApp } from '@/lib/whatsapp';
import api from '@/lib/api';
import { fmt, T_AGENT } from '../SharedUI';
import { useToast } from '@/components/ui/Toast';

interface SaleHistoryItem {
    id: string | number;
    date: string;
    time: string;
    boat_name: string;
    buyer_name?: string;
    fish_name: string;
    weight: number;
    rate: number;
    total: number;
    cash_received: boolean;
}

export function HistoryTab({ lang = 'en' }: { lang?: string }) {
    const t = T_AGENT[lang as 'en' | 'ta'];
    const [sales, setSales] = useState<SaleHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const { toast } = useToast();

    const fetchSales = useCallback(async () => {
        try {
            const res = await api.get('/sales/history');
            setSales(res.data);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            toast(e.response?.data?.message || "Failed to fetch history", "error");
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchSales();
    }, [fetchSales]);

    const filtered = sales.filter(s => {
        const q = search.toLowerCase();
        return (
            s.boat_name?.toLowerCase().includes(q) ||
            s.buyer_name?.toLowerCase().includes(q) ||
            s.fish_name?.toLowerCase().includes(q)
        );
    });

    return (
        <div>
            <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-3.5 w-5 h-5 text-ocean-500" />
                    <Input 
                        placeholder={t.history.searchPlaceholder} 
                        className="pl-12 py-3 bg-white border-ocean-200"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <Card className="p-0 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20 gap-3 text-ocean-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{t.history.loading}</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-ocean-500">
                        <p>{t.history.noRecords}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-ocean-100 bg-ocean-50/50 text-ocean-600 text-[11px] font-bold uppercase tracking-widest">
                                    <th className="px-6 py-4">{t.history.date}</th>
                                    <th className="px-6 py-4">{t.history.boat}</th>
                                    <th className="px-6 py-4">{t.history.buyer}</th>
                                    <th className="px-6 py-4">{t.history.fish}</th>
                                    <th className="px-6 py-4 text-right">{t.history.qty}</th>
                                    <th className="px-6 py-4 text-right">{t.history.amount}</th>
                                    <th className="px-6 py-4 text-center">{t.history.status}</th>
                                    <th className="px-6 py-4 text-center">{t.history.actions}</th>
                                </tr>
                            </thead>
                            <tbody className="text-ocean-900 text-sm">
                                {filtered.map((s, i) => (
                                    <motion.tr 
                                        key={s.id}
                                        initial={{ opacity: 0, x: -10 }} 
                                        animate={{ opacity: 1, x: 0 }} 
                                        transition={{ delay: i * 0.02 }}
                                        className="border-b border-ocean-50 last:border-0 hover:bg-ocean-50/30 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-ocean-900 block">{new Date(s.date + 'T00:00:00').toLocaleDateString()}</span>
                                            <span className="text-xs text-ocean-500">{s.time.substring(0, 5)}</span>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-ocean-700">{s.boat_name}</td>
                                        <td className="px-6 py-4">{s.buyer_name || '-'}</td>
                                        <td className="px-6 py-4">
                                            <span className="bg-ocean-100/50 px-3 py-1.5 rounded-lg border border-ocean-100">{s.fish_name}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-ocean-300">{s.weight} {t.fields.unitKg} {t.actions.at} {t.fields.unitCurrency}{s.rate}</td>
                                        <td className="px-6 py-4 text-right font-black text-ocean-900">{fmt(s.total, t.fields.unitCurrency)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase ${
                                                s.cash_received ? 'bg-green-500/10 text-green-400' : 'bg-coral-500/10 text-coral-400'
                                            }`}>
                                                {s.cash_received ? t.history.paid : t.history.credit}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => {
                                                    const msg = `${t.history.billTitle}\n\n📅 ${t.history.dateLbl}: ${new Date(s.date).toLocaleDateString()}\n🛥 ${t.history.boatLbl}: ${s.boat_name}\n🐟 ${t.history.fishLbl}: ${s.fish_name}\n⚖️ ${t.history.qtyLbl}: ${s.weight}${t.fields.unitKg} ${t.actions.at} ${t.fields.unitCurrency}${s.rate}\n💰 *${t.history.totalLbl}: ${t.fields.unitCurrency}${s.total.toLocaleString('en-IN')}*\n\n${t.history.typeLbl}: ${s.cash_received ? t.history.paidType : t.history.debtType}\n\n${t.history.thankYou}`;
                                                    shareToWhatsApp('', msg); 
                                                }}
                                                className="p-2 hover:bg-green-500/20 rounded-lg text-green-400 transition-all group"
                                                title="Share Bill on WhatsApp"
                                            >
                                                <MessageCircle className="w-4 h-4 group-hover:scale-120 transition-transform" />
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
