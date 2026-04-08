"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    Users, Plus, Wallet, AlertCircle, X, Loader2, IndianRupee, MessageCircle, History as HistoryIcon, TrendingUp, TrendingDown, Calendar
} from 'lucide-react';
import { fetchBuyers, createBuyer, recordBuyerPayment, Buyer, fetchBuyerHistory } from '@/lib/api/agentApi';
import { shareToWhatsApp } from '@/lib/whatsapp';
import { fmt, T_AGENT, dispDate } from '../SharedUI';
import { useToast } from '@/components/ui/Toast';

import { useAgent } from '../_context/AgentContext';

export function BuyersTab({ lang }: { lang: string }) {
    const t = T_AGENT[lang as 'en' | 'ta'];
    const { buyers, refreshBuyers, isLoading: loading } = useAgent();
    const [error, setError] = useState('');
    const { toast } = useToast();

    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ name: '', phone: '' });
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean; buyer: Buyer | null }>({ isOpen: false, buyer: null });
    const [paymentAmount, setPaymentAmount] = useState('');

    const [historyModal, setHistoryModal] = useState<{ 
        isOpen: boolean; 
        buyer: Buyer | null; 
        data: { sales: any[], transactions: any[] } | null;
        loading: boolean;
    }>({ isOpen: false, buyer: null, data: null, loading: false });

    const load = refreshBuyers;

    const handleViewHistory = async (buyer: Buyer) => {
        setHistoryModal({ isOpen: true, buyer, data: null, loading: true });
        try {
            const data = await fetchBuyerHistory(buyer.id);
            setHistoryModal(prev => ({ ...prev, data, loading: false }));
        } catch (e) {
            toast("Failed to load history", "error");
            setHistoryModal(prev => ({ ...prev, loading: false }));
        }
    };

    const handleAdd = async () => {
        if (!form.name.trim()) {
            setFieldErrors({ name: 'Name is required' });
            return;
        }
        setSaving(true);
        setFieldErrors({});
        try {
            await createBuyer({ name: form.name.trim(), phone: form.phone.trim() || undefined });
            toast('Buyer added successfully', 'success');
            setShowAdd(false); setForm({ name: '', phone: '' });
            await load();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string, errors?: Array<{ path: string | string[], message: string }> } } };
            if (!navigator.onLine) {
                const payload = { name: form.name.trim(), phone: form.phone.trim() || undefined };
                await import('@/lib/offlineStorage').then(m => m.offlineStorage.addPendingSale({ type: 'buyer', payload }));
                toast('Buyer saved offline', 'info');
                setShowAdd(false); setForm({ name: '', phone: '' });
            } else if (err.response?.data?.errors) {
                const map: Record<string, string> = {};
                err.response.data.errors.forEach((er) => {
                    const path = Array.isArray(er.path) ? er.path.join('.') : String(er.path);
                    map[path.replace('body.', '')] = er.message;
                });
                setFieldErrors(map);
            } else {
                toast(err.response?.data?.message || t.buyers.addFail, 'error');
            }
        } finally { setSaving(false); }
    };

    const handlePayment = async () => {
        const amt = parseFloat(paymentAmount);
        if (!paymentModal.buyer || isNaN(amt) || amt <= 0) {
            setFieldErrors({ amount: 'Please enter a valid amount' });
            return;
        }
        setSaving(true);
        setFieldErrors({});
        try {
            await recordBuyerPayment(paymentModal.buyer.id, amt);
            toast('Payment recorded successfully', 'success');
            setPaymentModal({ isOpen: false, buyer: null });
            setPaymentAmount('');
            await load();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string, errors?: Array<{ path: string | string[], message: string }> } } };
            if (!navigator.onLine) {
                await import('@/lib/offlineStorage').then(m => 
                    m.offlineStorage.addPendingSale({ type: 'buyer-payment', buyerId: paymentModal.buyer!.id, amount: amt })
                );
                toast('Payment saved offline', 'info');
                setPaymentModal({ isOpen: false, buyer: null });
                setPaymentAmount('');
            } else if (err.response?.data?.errors) {
                const map: Record<string, string> = {};
                err.response.data.errors.forEach((er) => {
                    const path = Array.isArray(er.path) ? er.path.join('.') : String(er.path);
                    map[path.replace('body.', '')] = er.message;
                });
                setFieldErrors(map);
            } else {
                toast(err.response?.data?.message || t.buyers.payFail, 'error');
            }
        } finally { setSaving(false); }
    };

    const totalOutstanding = buyers.reduce((sum, b) => sum + Number(b.balance), 0);

    const getWAMsg = (b: Buyer) => {
        return t.buyers.waMsg
            .replace('{name}', b.name)
            .replace('{total}', Number(b.totalSales).toLocaleString('en-IN'))
            .replace('{paid}', Number(b.totalPaid).toLocaleString('en-IN'))
            .replace('{bal}', Number(b.balance).toLocaleString('en-IN'))
            .replace(/{sym}/g, t.fields.unitCurrency);
    };

    // Combine sales and payments into a single history list
    const combinedHistory = useMemo(() => {
        if (!historyModal.data) return [];
        const { sales, transactions } = historyModal.data;
        
        const saleItems = sales.map(s => ({
            id: `sale-${s.id}`,
            date: s.date || s.created_at,
            type: 'sale',
            amount: s.total,
            description: s.fish_name || s.fish,
            sub: `${s.weight}kg @ ${s.rate}`
        }));

        const paymentItems = transactions.map(p => ({
            id: `pay-${p.id}`,
            date: p.date || p.created_at,
            type: 'payment',
            amount: p.amount_paid,
            description: 'Payment Received',
            sub: p.note || 'Cash Settlement'
        }));

        return [...saleItems, ...paymentItems].sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
    }, [historyModal.data]);

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <Card className="px-6 py-4 flex items-center gap-4 bg-ocean-900/40 border border-ocean-800">
                    <div className="w-12 h-12 rounded-full bg-coral-500/10 flex items-center justify-center">
                        <Wallet className="w-6 h-6 text-coral-400" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-ocean-500 uppercase tracking-widest leading-none mb-1">{t.buyers.title}</p>
                        <p className="text-2xl font-black text-coral-400 leading-none">{fmt(totalOutstanding, t.fields.unitCurrency)}</p>
                    </div>
                </Card>
                <Button onClick={() => setShowAdd(true)} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" /> {t.buyers.addBtn}
                </Button>
            </div>

            {error && (
                <div className="flex items-center gap-3 bg-coral-500/10 border border-coral-500/20 text-coral-400 rounded-xl px-4 py-3 mb-6 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Add Buyer Modal */}
            <AnimatePresence>
                {showAdd && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl border border-ocean-200">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-ocean-900">{t.buyers.addBuyerTitle}</h3>
                                <button onClick={() => setShowAdd(false)} className="text-ocean-400 hover:text-ocean-700"><X className="w-5 h-5"/></button>
                            </div>
                            <div className="space-y-4">
                                <Input label={t.buyers.buyerNameInput} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t.buyers.namePlaceholder} error={fieldErrors.name} />
                                <Input label={t.buyers.phoneInput} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder={t.buyers.phonePlaceholder} error={fieldErrors.phone} />
                                <div className="pt-2 flex gap-3">
                                    <Button className="flex-1" onClick={handleAdd} isLoading={saving}>{t.buyers.addBtn}</Button>
                                    <Button variant="ghost" className="flex-1" onClick={() => setShowAdd(false)}>{t.buyers.cancel}</Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* History Modal */}
            <AnimatePresence>
                {historyModal.isOpen && historyModal.buyer && (
                    <div className="fixed inset-0 z-[1000] flex justify-end bg-black/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ x: '100%' }} 
                            animate={{ x: 0 }} 
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="bg-white w-full max-w-lg h-full shadow-2xl overflow-hidden flex flex-col"
                        >
                            <div className="p-8 border-b border-gray-100">
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-2xl font-black tracking-tight text-ocean-900">{historyModal.buyer.name}&apos;s Log</h3>
                                    <button onClick={() => setHistoryModal({ isOpen: false, buyer: null, data: null, loading: false })} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                        <X className="w-6 h-6 text-ocean-400"/>
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-ocean-100 p-4 rounded-2xl border border-ocean-200">
                                        <p className="text-[11px] font-black text-ocean-600 uppercase tracking-widest mb-1">Total Sales</p>
                                        <p className="text-xl font-black text-ocean-950">{fmt(historyModal.buyer.totalSales, t.fields.unitCurrency)}</p>
                                    </div>
                                    <div className={`p-4 rounded-2xl border-2 ${historyModal.buyer.balance > 0 ? 'bg-coral-50 border-coral-200 text-coral-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                                        <p className="text-[11px] font-black opacity-60 uppercase tracking-widest mb-1">Balance</p>
                                        <p className="text-xl font-black">{fmt(historyModal.buyer.balance, t.fields.unitCurrency)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-6">
                                {historyModal.loading ? (
                                    <div className="flex flex-col items-center justify-center h-40 gap-4 opacity-40">
                                        <Loader2 className="w-8 h-8 animate-spin" />
                                        <span className="text-xs font-bold uppercase tracking-widest">Compiling history...</span>
                                    </div>
                                ) : combinedHistory.length === 0 ? (
                                    <div className="text-center py-20 opacity-30">
                                        <Calendar className="w-12 h-12 mx-auto mb-4" />
                                        <p className="font-bold uppercase text-[10px] tracking-widest">No transaction history found</p>
                                    </div>
                                ) : (
                                    <div className="space-y-8 relative">
                                        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-100" />
                                        {combinedHistory.map((item: any) => (
                                            <div key={item.id} className="relative pl-14 group">
                                                <div className={`absolute left-0 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 z-10 
                                                    ${item.type === 'sale' ? 'bg-gray-900 text-white shadow-lg' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-100'}`}>
                                                    {item.type === 'sale' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="flex justify-between items-baseline mb-1">
                                                        <h4 className="font-black text-ocean-950 tracking-tight">{item.description}</h4>
                                                        <span className="text-[11px] font-black text-ocean-500 uppercase">{dispDate(item.date)}</span>
                                                    </div>
                                                    <p className="text-xs text-ocean-600 mb-2 font-black">{item.sub}</p>
                                                    <p className={`text-lg font-black ${item.type === 'sale' ? 'text-ocean-900' : 'text-emerald-700'}`}>
                                                        {item.type === 'sale' ? '+' : '–'} {fmt(item.amount, t.fields.unitCurrency)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-8 bg-gray-50 border-t border-gray-100 flex gap-4">
                                <Button 
                                    className="flex-1 min-h-[60px] text-lg rounded-2xl"
                                    onClick={() => {
                                        shareToWhatsApp(historyModal.buyer?.phone || '', getWAMsg(historyModal.buyer!));
                                    }}
                                >
                                    <MessageCircle className="w-5 h-5 mr-2" /> Share Statement
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Receive Payment Modal */}
            <AnimatePresence>
                {paymentModal.isOpen && paymentModal.buyer && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl border border-ocean-200">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-ocean-900 flex items-center gap-2"><IndianRupee className="w-5 h-5 text-green-600"/> {t.buyers.receiveCash}</h3>
                                <button onClick={() => setPaymentModal({ isOpen: false, buyer: null })} className="text-ocean-400 hover:text-ocean-700"><X className="w-5 h-5"/></button>
                            </div>
                            <div className="mb-6 bg-ocean-50 border border-ocean-100 rounded-xl p-4 text-center">
                                <p className="text-sm font-medium text-ocean-700 mb-1">{paymentModal.buyer.name}&apos;s {t.buyers.balance}</p>
                                <p className="text-2xl font-bold text-coral-400">{fmt(paymentModal.buyer.balance, t.fields.unitCurrency)}</p>
                            </div>
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-ocean-700 uppercase tracking-widest mb-2">{t.buyers.amtReceived.replace('{sym}', t.fields.unitCurrency)}</label>
                                <input 
                                    type="number" 
                                    value={paymentAmount} 
                                    onChange={e => setPaymentAmount(e.target.value)} 
                                    placeholder="0" 
                                    autoFocus
                                    className={`w-full bg-white border ${fieldErrors.amount ? 'border-coral-500' : 'border-ocean-300'} rounded-xl px-4 py-3 text-ocean-900 text-lg focus:outline-none focus:ring-2 focus:ring-ocean-500`}
                                />
                                {fieldErrors.amount && <p className="text-xs text-coral-500">{fieldErrors.amount}</p>}
                                <div className="flex gap-2">
                                    <Button className="flex-1 min-h-[50px] bg-green-600 hover:bg-green-700 text-white font-bold" onClick={handlePayment} isLoading={saving}>
                                        {t.buyers.confirmPay}
                                    </Button>
                                    <button 
                                        onClick={() => {
                                            if (!paymentModal.buyer) return;
                                            shareToWhatsApp(paymentModal.buyer.phone || '', getWAMsg(paymentModal.buyer));
                                        }}
                                        className="w-14 h-[50px] bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center text-green-600 hover:bg-green-500/20 transition-all"
                                        title="Share Balance via WhatsApp"
                                    >
                                        <MessageCircle className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Buyers Table */}
            <Card className="overflow-hidden p-0">
                {loading ? (
                    <div className="flex items-center justify-center py-20 gap-3 text-ocean-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{t.history.loading}</span>
                    </div>
                ) : buyers.length === 0 ? (
                    <div className="text-center py-20 text-ocean-500">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p className="font-medium">{t.buyers.noBuyers}</p>
                        <p className="text-sm mt-1">{t.buyers.addFirst}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-ocean-100 bg-ocean-50/50">
                                    <th className="text-left px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-ocean-500">{t.buyers.name}</th>
                                    <th className="text-right px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-ocean-500">{t.buyers.totalBought}</th>
                                    <th className="text-right px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-ocean-500">{t.buyers.totalPaid}</th>
                                    <th className="text-right px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-ocean-500">{t.buyers.balance}</th>
                                    <th className="text-right px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-ocean-500">{t.buyers.action}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {buyers.map((b, i) => (
                                    <motion.tr key={b.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                                        className="border-b border-ocean-100 hover:bg-ocean-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-ocean-100 flex items-center justify-center text-ocean-700">
                                                    <Users className="w-4 h-4" />
                                                </div>
                                                <div className="cursor-pointer group" onClick={() => handleViewHistory(b)}>
                                                    <p className="font-black text-ocean-950 leading-tight group-hover:text-blue-700 transition-colors uppercase tracking-tight">{b.name}</p>
                                                    <p className="text-[11px] text-ocean-500 font-black uppercase tracking-widest">{b.phone || t.buyers.noPhone}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-black text-ocean-700 tabular-nums">
                                                {fmt(Number(b.totalSales), t.fields.unitCurrency)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-black text-emerald-600 tabular-nums">
                                                {fmt(Number(b.totalPaid), t.fields.unitCurrency)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`text-sm font-black px-3 py-1.5 rounded-lg ${b.balance > 0 ? 'bg-coral-500/10 text-coral-600' : 'bg-emerald-500/10 text-emerald-700'}`}>
                                                {b.balance > 0 ? fmt(Number(b.balance), t.fields.unitCurrency) : t.buyers.settled}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                <button 
                                                    onClick={() => handleViewHistory(b)}
                                                    className="p-2 hover:bg-ocean-100 rounded-lg text-ocean-400 transition-colors group"
                                                    title="View Full History"
                                                >
                                                    <HistoryIcon className="w-4 h-4 group-hover:rotate-[-45deg] transition-transform" />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        shareToWhatsApp(b.phone || '', getWAMsg(b));
                                                    }}
                                                    className="p-2 hover:bg-green-500/10 rounded-lg text-green-400 transition-colors group"
                                                    title="Send Statement via WhatsApp"
                                                >
                                                    <MessageCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                                </button>
                                                {Number(b.balance) > 0 && (
                                                    <Button variant="outline" className="py-1.5 px-4 text-xs font-bold border-green-500/30 text-green-400 hover:bg-green-500/10"
                                                        onClick={() => { setPaymentAmount(''); setPaymentModal({ isOpen: true, buyer: b }); }}>
                                                        {t.buyers.payBtn}
                                                    </Button>
                                                )}
                                            </div>
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
