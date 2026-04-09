"use client";
import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { useLanguage } from '@/contexts/LanguageContext';
import { T } from '@/lib/i18n';
import { CheckCircle2, X, KeyRound, AlertCircle } from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
    const { lang } = useLanguage();
    const t = T[lang];
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const { toast } = useToast();

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (newPassword !== confirmPassword) {
            setError(t.passwordMismatch);
            return;
        }

        setLoading(true);
        try {
            await api.put('/auth/change-password', {
                currentPassword: currentPassword,
                newPassword: newPassword
            });

            setSuccess(true);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            toast(t.passwordChangedSuccess, "success");
            setTimeout(() => {
                onClose();
                setSuccess(false);
            }, 2000);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            const msg = e.response?.data?.message;
            if (msg === 'Incorrect current password') {
                setError(t.wrongCurrentPassword);
                toast(t.wrongCurrentPassword, "error");
            } else {
                setError(msg || 'Failed to update password');
                toast(msg || 'Failed to update password', "error");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <Card className="w-full max-w-md bg-ocean-950 border-ocean-800 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                    <button onClick={onClose} className="text-ocean-400 hover:text-white transition-colors cursor-pointer">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-ocean-900 rounded-lg flex items-center justify-center border border-ocean-800">
                            <KeyRound className="text-ocean-400" size={24} />
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight italic uppercase">
                            {t.changePassword}
                        </h2>
                    </div>

                    {success ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
                            <p className="text-xl font-bold text-white mb-2">{t.passwordChangedSuccess}</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label={t.currentPassword}
                                type="password"
                                value={currentPassword}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentPassword(e.target.value)}
                                required
                                className="bg-ocean-900/50 border-ocean-800 text-white"
                            />
                            <Input
                                label={t.newPassword}
                                type="password"
                                value={newPassword}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                                required
                                className="bg-ocean-900/50 border-ocean-800 text-white"
                            />
                            <Input
                                label={t.confirmPassword}
                                type="password"
                                value={confirmPassword}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                                required
                                className="bg-ocean-900/50 border-ocean-800 text-white"
                            />

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400 text-sm">
                                    <AlertCircle size={18} />
                                    {error}
                                </div>
                            )}

                            <Button 
                                type="submit" 
                                className="w-full py-6 text-lg"
                                disabled={loading}
                            >
                                {loading ? '...' : t.updatePasswordBtn}
                            </Button>
                        </form>
                    )}
                </div>
            </Card>
        </div>
    );
};
