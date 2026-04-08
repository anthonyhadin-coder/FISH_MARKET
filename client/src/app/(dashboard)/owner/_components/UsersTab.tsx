"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    Users, Plus, Trash2, X, Loader2, AlertCircle, UserCircle2, ShieldCheck
} from 'lucide-react';
import { fetchAllUsers, createUser, deleteUser, AdminUser } from '@/lib/api/adminApi';

const ROLE_COLORS: Record<string, string> = {
    owner: 'bg-yellow-500/10 text-yellow-400',
    agent: 'bg-ocean-500/10 text-ocean-400',
    buyer: 'bg-green-500/10 text-green-400',
};

export function UsersTab() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [roleFilter, setRoleFilter] = useState('');

    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ name: '', phone: '', role: 'agent', password: '' });
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchAllUsers(roleFilter || undefined);
            setUsers(data);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message || 'Failed to load users');
        } finally { setLoading(false); }
    }, [roleFilter]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async () => {
        if (!form.name || !form.phone || !form.password) {
            setFormError('All fields are required');
            return;
        }
        setSaving(true); setFormError('');
        try {
            await createUser(form);
            setForm({ name: '', phone: '', role: 'agent', password: '' });
            setShowAdd(false);
            await load();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setFormError(err.response?.data?.message || 'Failed to create user');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: number, name: string) => {
        if (!window.confirm(`Remove user "${name}"? This cannot be undone.`)) return;
        try {
            await deleteUser(id);
            await load();
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            setError(err.response?.data?.message || 'Failed to delete user');
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div className="flex items-center gap-2">
                    {['', 'owner', 'agent', 'buyer'].map(r => (
                        <button key={r} onClick={() => setRoleFilter(r)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${roleFilter === r ? 'bg-ocean-600 text-white' : 'text-ocean-700 hover:text-ocean-300 bg-ocean-900/40'}`}>
                            {r || 'All'}
                        </button>
                    ))}
                </div>
                <Button onClick={() => { setShowAdd(true); setFormError(''); }} className="flex items-center gap-2 text-sm">
                    <Plus className="w-4 h-4" /> Add User
                </Button>
            </div>

            {error && (
                <div className="flex items-center gap-3 bg-coral-500/10 border border-coral-500/20 text-coral-400 rounded-xl px-4 py-3 mb-6 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
            )}

            <AnimatePresence>
                {showAdd && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="glass rounded-2xl p-8 w-full max-w-md shadow-2xl border border-white/10">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white">Add New User</h3>
                                <button onClick={() => setShowAdd(false)} className="text-ocean-600 hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            {formError && (
                                <div className="flex items-center gap-2 bg-coral-500/10 text-coral-400 rounded-lg px-3 py-2 mb-4 text-sm">
                                    <AlertCircle className="w-4 h-4" />{formError}
                                </div>
                            )}
                            <div className="space-y-4">
                                {[
                                    { key: 'name', label: 'Full Name', placeholder: 'Enter full name', type: 'text' },
                                    { key: 'phone', label: 'Phone Number', placeholder: '10-digit phone', type: 'tel' },
                                    { key: 'password', label: 'Password', placeholder: 'Minimum 6 characters', type: 'password' },
                                ].map(({ key, label, placeholder, type }) => (
                                    <div key={key}>
                                        <label className="block text-xs font-bold text-ocean-400 uppercase tracking-widest mb-2">{label}</label>
                                        <input type={type} value={(form as Record<string, string>)[key]}
                                            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                            placeholder={placeholder}
                                            className="w-full bg-ocean-900/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-ocean-600 focus:outline-none focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500/50 transition-all" />
                                    </div>
                                ))}
                                <div>
                                    <label className="block text-xs font-bold text-ocean-600 uppercase tracking-widest mb-2">Role</label>
                                    <div className="flex gap-2">
                                        {['agent', 'owner', 'buyer'].map(r => (
                                            <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                                                className={`flex-1 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all border ${form.role === r ? 'bg-ocean-600 border-ocean-500 text-white' : 'border-white/10 text-ocean-600 hover:border-ocean-600'}`}>
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button onClick={handleAdd} isLoading={saving} className="flex-1">Create User</Button>
                                    <Button variant="ghost" onClick={() => setShowAdd(false)} className="flex-1">Cancel</Button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Card className="overflow-hidden p-0">
                {loading ? (
                    <div className="flex items-center justify-center py-20 gap-3 text-ocean-600">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Loading users...</span>
                    </div>
                ) : users.length === 0 ? (
                    <div className="text-center py-20 text-ocean-700">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p className="font-medium">No users found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="text-left px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-ocean-700">Name</th>
                                    <th className="text-left px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-ocean-700">Phone</th>
                                    <th className="text-left px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-ocean-700">Role</th>
                                    <th className="text-left px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-ocean-700">Joined</th>
                                    <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-widest text-ocean-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u, idx) => (
                                    <motion.tr key={u.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.04 }}
                                        className="border-b border-white/5 hover:bg-white/2 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-ocean-800 border border-white/10 flex items-center justify-center text-ocean-300">
                                                    {u.role === 'owner' ? <ShieldCheck className="w-4 h-4" /> : <UserCircle2 className="w-4 h-4" />}
                                                </div>
                                                <span className="font-bold text-white">{u.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-ocean-300 text-sm font-mono">{u.phone}</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${ROLE_COLORS[u.role] ?? 'bg-gray-500/10 text-gray-400'}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-ocean-700">
                                            {new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => handleDelete(u.id, u.name)}
                                                className="p-2 rounded-lg bg-coral-500/10 text-coral-400 hover:bg-coral-500/20 transition-colors opacity-0 group-hover:opacity-100" title="Remove user">
                                                <Trash2 className="w-4 h-4" />
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
