"use client";
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Fish,
    LogOut,
    ChevronRight,
    User,
    KeyRound
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChangePasswordModal } from './ChangePasswordModal';
import { T } from '@/lib/i18n';

interface SidebarItemProps {
    href: string;
    icon: React.ElementType;
    label: string;
    onClick?: () => void;
    active?: boolean;
}

const SidebarItem = ({ href, icon: Icon, label, onClick, active }: SidebarItemProps) => {
    const pathname = usePathname();
    const isActive = active !== undefined ? active : pathname === href;

    const content = (
        <motion.div
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all mb-2 cursor-pointer group ${isActive
                    ? 'bg-gradient-to-br from-ocean-600 to-ocean-800 text-white shadow-xl shadow-ocean-600/20 font-bold'
                    : 'text-ocean-400 hover:bg-white hover:text-ocean-900 hover:shadow-md border border-transparent hover:border-ocean-50'
                }`}
            onClick={(e) => {
                if (onClick) {
                    e.preventDefault();
                    onClick();
                }
            }}
        >
            <Icon className="w-5 h-5" />
            <span className="font-medium">{label}</span>
            {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
        </motion.div>
    );

    if (onClick) return content;

    return (
        <Link href={href}>
            {content}
        </Link>
    );
};

export const DashboardLayout = ({ children, title, roleLinks }: {
    children: React.ReactNode,
    title: string,
    roleLinks: SidebarItemProps[]
}) => {
    const { user, logout } = useAuth();
    const { lang, setLang } = useLanguage();
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const t = T[lang as 'en' | 'ta'];

    return (
        <div className="min-h-screen bg-gray-50/50 flex relative font-sans selection:bg-ocean-100 selection:text-ocean-900">
            {/* Sidebar */}
            <aside className="w-80 border-r border-ocean-100 bg-gray-50/50 backdrop-blur-xl p-8 flex flex-col hidden lg:flex sticky top-0 h-screen">
                <div className="flex items-center gap-3 mb-12 group cursor-pointer">
                    <div className="w-12 h-12 bg-gradient-to-br from-ocean-600 to-ocean-900 rounded-2xl flex items-center justify-center shadow-xl shadow-ocean-600/20 rotate-3 group-hover:rotate-6 transition-transform duration-300">
                        <Fish className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <span className="block text-2xl font-black text-ocean-950 tracking-tight leading-none">Fish Market</span>
                        <span className="text-[10px] font-black text-ocean-400 uppercase tracking-widest mt-1 block">Digital Ledger</span>
                    </div>
                </div>

                <nav className="flex-1">
                    <div className="text-[10px] font-black text-ocean-300 uppercase tracking-[0.2em] mb-6 px-4">
                        {lang === 'ta' ? 'நிர்வாகம்' : 'Management'}
                    </div>
                    {roleLinks.map((link) => (
                        <SidebarItem key={link.href} {...link} />
                    ))}
                </nav>

                <div className="mt-auto pt-8 border-t border-ocean-100">
                    <div className="flex items-center gap-4 px-2 mb-8 group">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-ocean-100 flex items-center justify-center text-ocean-400 shadow-sm group-hover:shadow-md transition-shadow">
                            <User className="w-6 h-6" />
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-black text-ocean-900 leading-none mb-1.5 truncate">{user?.name}</p>
                            <span className="px-2 py-0.5 bg-ocean-50 text-[10px] font-black text-ocean-600 uppercase tracking-widest rounded-full border border-ocean-100">
                                {user?.role === 'owner' ? t.boatOwner : user?.role === 'agent' ? t.agent : user?.role}
                            </span>
                        </div>
                    </div>
                    
                    <button
                        onClick={() => setIsPasswordModalOpen(true)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-ocean-500 hover:bg-white hover:text-ocean-900 transition-all font-bold text-sm mb-2 border border-transparent hover:border-ocean-50 hover:shadow-sm"
                    >
                        <KeyRound className="w-5 h-5 text-ocean-300" />
                        <span>{t.changePassword}</span>
                    </button>

                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-coral-500 hover:bg-coral-50 transition-all font-bold text-sm border border-transparent hover:border-coral-100"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>{t.logout}</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 h-screen overflow-y-auto bg-white/40">
                <header className="px-10 py-6 flex items-center justify-between sticky top-0 z-20 bg-white/70 backdrop-blur-xl border-b border-ocean-50 shadow-sm shadow-ocean-500/5 mb-10">
                    <div className="flex items-center gap-4">
                        <div className="w-1 h-8 bg-gradient-to-b from-ocean-500 to-ocean-800 rounded-full" />
                        <h2 className="text-2xl font-black text-ocean-950 tracking-tight uppercase italic">{title}</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => {
                                setLang(lang === 'ta' ? 'en' : 'ta');
                            }}
                            className="group flex items-center gap-2 px-5 py-2.5 bg-white border border-ocean-100 rounded-2xl text-ocean-900 font-black text-xs hover:border-ocean-300 hover:shadow-lg hover:shadow-ocean-500/10 transition-all uppercase tracking-widest"
                        >
                            <span className="text-ocean-400 group-hover:text-ocean-600 transition-colors">🌐</span>
                            {lang === 'ta' ? 'English' : 'தமிழ்'}
                        </button>
                    </div>
                </header>

                <div className="px-8 pb-12">
                    {children}
                </div>
            </main>

            <ChangePasswordModal 
                isOpen={isPasswordModalOpen} 
                onClose={() => setIsPasswordModalOpen(false)} 
            />
        </div>
    );
};
