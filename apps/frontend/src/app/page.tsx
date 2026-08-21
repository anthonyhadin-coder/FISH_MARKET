"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { Fish, ShieldCheck, TrendingUp, Ship, ArrowRight, Globe, Lock, Activity } from 'lucide-react';
import { Button } from '@fishmarket/ui';
import { Card } from '@fishmarket/ui';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { T } from '@/lib/i18n';

export default function LandingPage() {
  const { lang, setLang } = useLanguage();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // BUG FIX #18: No setTimeout needed — useEffect only runs on the client.
    // The previous setTimeout caused an extra render cycle and layout flash.
    setMounted(true);
  }, []);

  const currentLang = mounted ? lang : 'en';
  const t = T[currentLang];

  return (
    <main role="main" className="min-h-screen bg-slate-50 font-sans selection:bg-ocean-500/30">
      {/* Background Decorators */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-[700px] lg:h-[600px] bg-gradient-to-b from-ocean-900 via-ocean-800/95 to-slate-50 pointer-events-none" />
      
      {/* Navigation */}
      <nav aria-label="Primary navigation" className="relative z-10 max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-md">
            <Fish className="w-6 h-6 text-ocean-700" aria-hidden="true" />
          </div>
          {/* BUG FIX #19: role="heading" inside <nav> is incorrect ARIA — screen readers announce
              nav items, not headings here. Brand span needs no heading role. */}
          <span className="text-xl font-bold text-white tracking-tight">{t.appName}</span>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            className="text-white hover:bg-white/10 flex text-sm font-medium"
            aria-label={lang === 'en' ? 'Switch to Tamil' : 'Switch to English'}
            onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
          >
            <Globe className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">{lang === 'en' ? 'தமிழ்' : 'English'}</span>
          </Button>
          <Link href="/login">
            <Button variant="ghost" className="text-white hover:bg-white/10 font-medium">{t.login}</Button>
          </Link>
          <Link href="/register">
            <Button className="bg-white text-ocean-900 hover:bg-slate-100 font-bold shadow-lg">{t.getStarted}</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-20 text-center lg:text-left grid lg:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* BUG FIX #20: role="group" is for grouping related form controls, not decorative badges. Removed. */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-ocean-800/40 border border-ocean-700/50 rounded-full text-ocean-100 text-xs font-semibold tracking-wide mb-8 backdrop-blur-sm" aria-hidden="true">
            <Activity className="w-3.5 h-3.5" aria-hidden="true" />
            {t.nextGenMarket}
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-[1.1] mb-6 tracking-tight drop-shadow-md">
            {lang === 'ta' ? t.heroTitle : (
              <>
                Operational Precision <br />
                <span className="text-ocean-200">for the Modern Market.</span>
              </>
            )}
          </h1>
          <p className="text-lg md:text-xl text-slate-700 sm:text-ocean-100 mb-10 max-w-xl leading-relaxed font-medium sm:opacity-90">
            {t.heroSubtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Link href="/register">
              <Button className="w-full sm:w-auto px-8 py-6 text-base font-bold flex items-center justify-center gap-2 bg-white text-ocean-900 hover:bg-slate-100 shadow-xl transition-all">
                {t.launchDashboard}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="relative lg:h-[500px] flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-ocean-400/10 blur-[80px] rounded-full" />
          <div className="relative w-full max-w-lg bg-white p-2 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform hover:-translate-y-1 transition-transform duration-500">
            <div className="bg-slate-100 w-full h-8 rounded-t-xl flex items-center px-4 gap-2 mb-2">
               <div className="w-3 h-3 rounded-full bg-rose-400"></div>
               <div className="w-3 h-3 rounded-full bg-amber-400"></div>
               <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
            </div>
            <Image
              src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=2070&q=80"
              alt="Ocean Fish Market"
              width={800}
              height={500}
              className="rounded-b-xl w-full h-auto object-cover"
              style={{ height: 'auto' }}
            />
            
            {/* Overlay Metric Card */}
            <div className="absolute bottom-6 -left-6 bg-white p-5 rounded-2xl shadow-xl border border-slate-100 flex items-center gap-4 animate-bounce-slow">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900">₹45.2k</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.todaySale}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Trust & Features Section */}
      <section aria-label="Features" className="py-24 px-6 bg-white relative z-10 border-t border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">{t.builtForEveryRole}</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-lg">{t.featuresSubtitle}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <FeatureCard
              icon={ShieldCheck}
              title={t.encryptedTitle}
              desc={t.encryptedDesc}
              color="text-emerald-600"
              bg="bg-emerald-50"
            />
            <FeatureCard
              icon={Ship}
              title={t.boatOwner}
              desc={t.boatOwnersFeature}
              color="text-ocean-600"
              bg="bg-ocean-50"
            />
            <FeatureCard
              icon={Lock}
              title={t.agent}
              desc={t.marketAgentsFeature}
              color="text-indigo-600"
              bg="bg-indigo-50"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer aria-label="Site footer" className="py-12 bg-slate-50 border-t border-slate-200 text-center relative z-10">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Fish className="w-5 h-5 text-ocean-600" />
          <span className="text-lg font-bold text-slate-900 tracking-tight">{t.appName}</span>
        </div>
        <div className="flex justify-center mb-4 gap-6">
          <Link href="/about" className="text-sm font-semibold text-slate-500 hover:text-ocean-600 transition-colors">
            {t.aboutOurProject || "About"}
          </Link>
          {/* BUG FIX #17: Hardcoded 'Login' string — must use translation key like all other footer links. */}
          <Link href="/login" className="text-sm font-semibold text-slate-500 hover:text-ocean-600 transition-colors">
            {t.login}
          </Link>
        </div>
        <p className="text-slate-400 text-sm font-medium">© 2026 {t.appName}. All rights reserved.</p>
      </footer>
    </main>
  );
}

const FeatureCard = ({ icon: Icon, title, desc, color, bg }: { icon: React.ElementType, title: string, desc: string, color: string, bg: string }) => (
  <Card className="p-8 border border-slate-100 shadow-sm hover:shadow-md transition-shadow group bg-white">
    <div className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center mb-6`}>
      <Icon className={`w-7 h-7 ${color}`} />
    </div>
    <h3 className="text-xl font-bold text-slate-900 mb-3 tracking-tight">{title}</h3>
    <p className="text-slate-500 leading-relaxed font-medium">{desc}</p>
  </Card>
);
