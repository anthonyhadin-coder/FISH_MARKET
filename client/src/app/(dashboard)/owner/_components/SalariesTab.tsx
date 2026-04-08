"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
    Users, Plus, Trash2, IndianRupee, X, Loader2, History
} from 'lucide-react';
import api from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { T, Language } from '@/lib/i18n';
import { useToast } from '@/components/ui/Toast';

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

interface Staff {
    id: number;
    name: string;
    phone: string;
    role: string;
    joined_date: string;
}

interface SalaryHistory {
    id: number;
    staff_name: string;
    staff_role: string;
    amount: number;
    date: string;
    note: string;
}

export function SalariesTab() {
    const { lang } = useLanguage();
    const t = T[lang as Language];

    const [staff, setStaff] = useState<Staff[]>([]);
    const [history, setHistory] = useState<SalaryHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newRole, setNewRole] = useState('');
    const [saving, setSaving] = useState(false);

    const [showPay, setShowPay] = useState<Staff | null>(null);
    const [payAmt, setPayAmt] = useState('');
    const [payNote, setPayNote] = useState('');
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [sRes, hRes] = await Promise.all([
                api.get('/salaries/staff'),
                api.get('/salaries/history')
            ]);
            setStaff(sRes.data);
            setHistory(hRes.data);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            toast(e.response?.data?.message || 'Failed to load staff data', 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async () => {
        if (!newName.trim()) return;
        setSaving(true);
        try {
            await api.post('/salaries/staff', { name: newName, phone: newPhone, role: newRole });
            setNewName(''); setNewPhone(''); setNewRole(''); setShowAdd(false);
            await load();
            toast(lang === "ta" ? "பணியாளர் சேர்க்கப்பட்டார்" : "Staff member added successfully", "success");
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            toast(e.response?.data?.message || 'Failed to add staff', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handlePay = async () => {
        if (!showPay || !payAmt) return;
        setSaving(true);
        try {
            await api.post('/salaries/pay', { staff_id: showPay.id, amount: Number(payAmt), note: payNote, date: payDate });
            setPayAmt(''); setPayNote(''); setShowPay(null);
            await load();
            toast(lang === "ta" ? "சம்பளம் செலுத்தப்பட்டது" : "Salary payment recorded successfully", "success");
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            toast(e.response?.data?.message || 'Failed to record salary', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Remove this person?")) return;
        try {
            await api.delete(`/salaries/staff/${id}`);
            await load();
            toast(lang === "ta" ? "பணியாளர் நீக்கப்பட்டார்" : "Staff member removed successfully", "success");
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            toast(e.response?.data?.message || 'Failed to delete staff', 'error');
        }
    };

    return (
        <div className="space-y-10 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-ocean-950 tracking-tight italic uppercase">{lang === "ta" ? "சம்பளம் மற்றும் பணியாளர்கள்" : "Salaries & Staff"}</h2>
                    <p className="text-ocean-600 text-[10px] font-black uppercase tracking-[0.2em] mt-1">{staff.length} active staff members in system</p>
                </div>
                <Button onClick={() => setShowAdd(true)} className="group flex items-center gap-2 px-6 py-6 bg-ocean-600 text-white rounded-2xl font-black text-sm hover:bg-ocean-700 shadow-xl shadow-ocean-600/20 active:scale-95 transition-all">
                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> {lang === "ta" ? "நபரை சேர்" : "Add Staff"}
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Staff List */}
                <Card className="lg:col-span-2 p-0 overflow-hidden bg-white border-ocean-50 shadow-sm rounded-[2rem]">
                    <div className="px-8 py-6 border-b border-ocean-50 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="text-xs font-black text-ocean-950 uppercase tracking-widest flex items-center gap-2">
                             <Users className="w-5 h-5 text-ocean-600" /> {lang === "ta" ? "பணியாளர்கள்" : "Active Staff"}
                        </h3>
                        <span className="text-[10px] font-black text-ocean-300 uppercase tracking-widest">{staff.length} Total</span>
                    </div>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-4 text-ocean-600">
                            <Loader2 className="w-10 h-10 animate-spin" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Loading Records...</span>
                        </div>
                    ) : staff.length === 0 ? (
                        <div className="text-center py-32">
                             <div className="w-20 h-20 bg-ocean-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                 <Users className="w-10 h-10 text-ocean-600" />
                             </div>
                             <p className="font-black text-ocean-950 text-xl tracking-tight">Team is empty.</p>
                             <p className="text-sm mt-2 max-w-xs mx-auto font-medium text-ocean-600">Add staff members to track their weekly salaries and performance bonuses.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-ocean-50">
                            {staff.map(s => (
                                <div key={s.id} className="group p-8 hover:bg-ocean-50/30 transition-all flex items-center justify-between relative overflow-hidden">
                                    <div className="flex items-center gap-6 relative z-10">
                                        <div className="w-14 h-14 rounded-2xl bg-white border border-ocean-100 flex items-center justify-center text-ocean-600 font-black text-xl shadow-sm group-hover:bg-ocean-600 group-hover:text-white group-hover:border-ocean-600 transition-all">
                                            {s.name[0]}
                                        </div>
                                        <div>
                                            <p className="font-black text-ocean-950 text-xl leading-tight tracking-tight">{s.name}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-[10px] font-black text-ocean-700 uppercase tracking-widest bg-ocean-50 px-2 py-0.5 rounded-lg border border-ocean-100">{s.role || "Staff"}</span>
                                                {s.phone && <span className="text-[10px] font-black text-ocean-500 uppercase tracking-widest">{s.phone}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 relative z-10 translate-x-4 group-hover:translate-x-0 transition-transform">
                                        <Button onClick={() => setShowPay(s)} variant="secondary" className="h-12 text-[10px] font-black gap-2 uppercase tracking-widest px-6 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 hover:shadow-lg hover:shadow-emerald-600/20 transition-all rounded-xl">
                                            <IndianRupee className="w-4 h-4" /> {lang === "ta" ? "சம்பளம்" : "Pay Salary"}
                                        </Button>
                                        <button onClick={() => handleDelete(s.id)} className="w-12 h-12 flex items-center justify-center rounded-xl bg-white border border-coral-100 text-coral-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-coral-600 hover:text-white hover:border-coral-600 hover:shadow-lg">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Recent History */}
                <Card className="p-0 overflow-hidden bg-white border-ocean-50 shadow-sm rounded-[2rem]">
                    <div className="px-8 py-6 border-b border-ocean-50 bg-indigo-50/50">
                        <h3 className="text-xs font-black text-ocean-950 uppercase tracking-widest flex items-center gap-2">
                             <History className="w-5 h-5 text-indigo-600" /> {lang === "ta" ? "சமீபத்திய கட்டணம்" : "Payment History"}
                        </h3>
                    </div>
                    <div className="p-8 space-y-8">
                        {history.slice(0, 6).map(h => (
                            <div key={h.id} className="flex flex-col gap-2 border-l-[3px] border-emerald-100 pl-5 py-2 hover:border-emerald-400 transition-colors">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-ocean-600 uppercase tracking-widest">{new Date(h.date).toLocaleDateString()}</span>
                                    <span className="text-sm font-black text-emerald-600 tracking-tight">{fmt(h.amount)}</span>
                                </div>
                                <p className="text-base font-black text-ocean-950 tracking-tight">{h.staff_name}</p>
                                {h.note && <p className="text-[10px] text-ocean-700 leading-relaxed">&quot;{h.note}&quot;</p>}
                            </div>
                        ))}
                        {history.length === 0 && (
                             <p className="text-xs text-ocean-600 italic text-center py-10">No payments recorded yet.</p>
                        )}
                    </div>
                </Card>
            </div>

            <AnimatePresence>
                {showAdd && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ocean-950/20 backdrop-blur-md px-4">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} 
                            className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl border border-ocean-100 relative overflow-hidden">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-ocean-50 rounded-bl-[5rem] -mr-10 -mt-10" />
                             <h3 className="text-2xl font-black text-ocean-950 mb-8 flex items-center gap-3 relative z-10">
                                 <Users className="w-7 h-7 text-ocean-600" /> {lang === "ta" ? "புதிய நபர்" : "Add Staff Member"}
                             </h3>
                             <div className="space-y-6 relative z-10">
                                 <div>
                                     <label className="block text-[10px] font-black text-ocean-400 uppercase tracking-widest mb-3 ml-1">{lang === "ta" ? "பெயர்" : "Full Name"}</label>
                                     <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Mariappan"
                                         className="w-full bg-gray-50 border border-ocean-100 rounded-2xl px-5 py-4 text-ocean-950 font-bold placeholder-ocean-200 focus:outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-500/5 transition-all" />
                                 </div>
                                 <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-ocean-400 uppercase tracking-widest mb-3 ml-1">{lang === "ta" ? "தொழில்" : "Role"}</label>
                                        <input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="Driver"
                                            className="w-full bg-gray-50 border border-ocean-100 rounded-2xl px-5 py-4 text-ocean-950 font-bold placeholder-ocean-200 focus:outline-none focus:border-ocean-500 transition-all text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-ocean-400 uppercase tracking-widest mb-3 ml-1">{lang === "ta" ? "போன்" : "Phone"}</label>
                                        <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Phone"
                                            className="w-full bg-gray-50 border border-ocean-100 rounded-2xl px-5 py-4 text-ocean-950 font-bold placeholder-ocean-200 focus:outline-none focus:border-ocean-500 transition-all text-sm" />
                                    </div>
                                 </div>
                                 <div className="flex gap-4 pt-4">
                                     <Button onClick={handleAdd} isLoading={saving} className="flex-1 py-6 bg-ocean-600 font-black tracking-widest uppercase text-xs rounded-2xl shadow-xl shadow-ocean-600/20">{t.add}</Button>
                                     <Button variant="ghost" onClick={() => setShowAdd(false)} className="flex-1 py-6 text-ocean-400 font-black tracking-widest uppercase text-xs rounded-2xl hover:bg-ocean-50 hover:text-ocean-900 transition-colors">{t.cancel}</Button>
                                 </div>
                             </div>
                             <button onClick={() => setShowAdd(false)} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-ocean-50 text-ocean-400 hover:text-ocean-900 transition-colors flex items-center justify-center border border-ocean-100">
                                 <X className="w-5 h-5" />
                             </button>
                        </motion.div>
                    </div>
                )}

                {showPay && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ocean-950/20 backdrop-blur-md px-4">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} 
                            className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl border border-ocean-100 relative overflow-hidden">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-[5rem] -mr-10 -mt-10" />
                             <h3 className="text-3xl font-black text-ocean-950 mb-2 relative z-10">{lang === "ta" ? "சம்பளம் செலுத்து" : "Record Payment"}</h3>
                             <p className="text-emerald-600 font-black text-[10px] uppercase tracking-widest mb-10 relative z-10">Paying to {showPay.name}</p>
                             <div className="space-y-6 relative z-10">
                                 <div className="grid grid-cols-2 gap-5">
                                     <div>
                                         <label className="block text-[10px] font-black text-ocean-400 uppercase tracking-widest mb-3 ml-1">Amount (₹)</label>
                                         <input type="number" autoFocus value={payAmt} onChange={e => setPayAmt(e.target.value)} placeholder="0.00"
                                             className="w-full bg-gray-50 border border-ocean-100 rounded-2xl px-5 py-4 text-ocean-950 font-black text-2xl focus:outline-none focus:border-emerald-500 transition-all" />
                                     </div>
                                     <div>
                                         <label className="block text-[10px] font-black text-ocean-400 uppercase tracking-widest mb-3 ml-1">Payment Date</label>
                                         <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} 
                                             className="w-full bg-gray-50 border border-ocean-100 rounded-2xl px-5 py-4 text-ocean-950 font-bold focus:outline-none focus:border-emerald-500 transition-all text-sm" />
                                     </div>
                                 </div>
                                 <div>
                                     <label className="block text-[10px] font-black text-ocean-400 uppercase tracking-widest mb-3 ml-1">Note (Optional)</label>
                                     <input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="e.g. Weekly Wage / Bonus"
                                         className="w-full bg-gray-50 border border-ocean-100 rounded-2xl px-5 py-4 text-ocean-950 font-bold placeholder-ocean-200 focus:outline-none focus:border-emerald-500 transition-all" />
                                 </div>
                                 <div className="flex gap-4 pt-6">
                                     <Button onClick={handlePay} isLoading={saving} className="flex-1 py-6 bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-emerald-600/20 text-white">Confirm Pay</Button>
                                     <Button variant="ghost" onClick={() => setShowPay(null)} className="flex-1 py-6 text-ocean-400 font-black tracking-widest uppercase text-xs rounded-2xl hover:bg-ocean-50 hover:text-ocean-900 transition-colors">{t.cancel}</Button>
                                 </div>
                             </div>
                             <button onClick={() => setShowPay(null)} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-ocean-50 text-ocean-400 hover:text-ocean-900 transition-colors flex items-center justify-center border border-ocean-100">
                                 <X className="w-5 h-5" />
                             </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
