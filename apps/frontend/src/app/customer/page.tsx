"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, History, CreditCard, ChevronRight, Fish } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CustomerDashboard() {
  const { user, logout } = useAuth();
  const { lang } = useLanguage();
  const t = lang === 'ta' ? {
    welcome: 'வரவேற்கிறோம்',
    buyTitle: 'வாங்குபவர் கணக்கு',
    balance: 'நிலுவைத் தொகை',
    purchases: 'கடந்தகால கொள்முதல்',
    logout: 'வெளியேறு',
    comingSoon: 'கொள்முதல் வரலாறு விரைவில் கிடைக்கும்.',
  } : {
    welcome: 'Welcome back',
    buyTitle: 'Buyer Dashboard',
    balance: 'Total Balance',
    purchases: 'Recent Purchases',
    logout: 'Log Out',
    comingSoon: 'Purchase history and ledgers will be available soon.',
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Bar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <Fish className="w-5 h-5" />
          </div>
          <span className="font-black text-slate-900 tracking-tight uppercase text-sm">Customer Portal</span>
        </div>
        <Button variant="ghost" onClick={logout} className="text-slate-500 text-xs font-bold uppercase">{t.logout}</Button>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-10">
          <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">{t.welcome}</p>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">{user?.name}</h1>
        </header>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <Card className="bg-white border-none shadow-sm p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
              <CreditCard className="w-8 h-8" />
            </div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.balance}</h3>
            <p className="text-4xl font-black text-slate-900">₹0.00</p>
          </Card>

          <Card className="bg-white border-none shadow-sm p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Market Status</h3>
            <p className="text-xl font-black text-slate-900 uppercase">Live Now</p>
          </Card>
        </div>

        {/* History Placeholder */}
        <section>
          <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <History className="w-5 h-5 text-slate-400" />
            {t.purchases}
          </h2>
          <Card className="bg-white border-none shadow-sm py-20 px-8 flex flex-col items-center text-center gap-4">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-2">
              <Fish className="w-10 h-10 text-slate-200" />
            </div>
            <p className="font-bold text-slate-400 text-sm italic">{t.comingSoon}</p>
          </Card>
        </section>
      </main>
    </div>
  );
}
