"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { Fish, ShieldCheck, TrendingUp, Ship, ArrowRight, Anchor } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { T } from '@/lib/i18n';

export default function LandingPage() {
  const { lang, setLang } = useLanguage();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setTimeout(() => setMounted(true), 0);
  }, []);

  // On the first render (including SSR), strictly use English to match server output.
  // After mount, we switch to the actual language selected in context.
  const currentLang = mounted ? lang : 'en';
  const t = T[currentLang];

  return (
    <main className="min-h-screen bg-ocean-950 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
      {/* Navigation */}
      <nav aria-label="Main navigation" className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-ocean-600 rounded-xl flex items-center justify-center shadow-lg shadow-ocean-600/20">
            <Fish className="w-6 h-6 text-white" aria-hidden="true" />
          </div>
          <span className="text-2xl font-black text-white tracking-tighter">{t.appName}</span>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            className="text-ocean-200 hover:bg-white/5"
            aria-label={lang === 'en' ? 'Switch to Tamil' : 'Switch to English'}
            onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
          >
            {lang === 'en' ? 'தமிழ்' : 'English'}
          </Button>
          <Link href="/login">
            <Button variant="ghost" className="text-ocean-200">{t.login}</Button>
          </Link>
          <Link href="/register">
            <Button>{t.getStarted}</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-32 text-center lg:text-left grid lg:grid-cols-2 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div role="group" className="inline-flex items-center gap-2 px-4 py-2 bg-ocean-900/50 border border-ocean-800 rounded-full text-ocean-400 text-xs font-bold uppercase tracking-widest mb-6" aria-label={t.nextGenMarket}>
            <Anchor className="w-4 h-4" aria-hidden="true" />
            {t.nextGenMarket}
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-white leading-[0.9] mb-8">
            {lang === 'ta' ? t.heroTitle : (
              <>
                REVOLUTIONIZE <br />
                <span className="text-ocean-500">THE CATCH.</span>
              </>
            )}
          </h1>
          <p className="text-xl text-ocean-300 mb-10 max-w-lg leading-relaxed">
            {t.heroSubtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Link href="/register">
              <Button className="px-10 py-4 text-xl flex items-center gap-3">
                {t.launchDashboard}
                <ArrowRight className="w-6 h-6" />
              </Button>
            </Link>
            <Button variant="outline" className="px-10 py-4 text-xl">
              {t.watchDemo}
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-ocean-500/20 blur-[100px] rounded-full" />
          <div className="relative glass p-4 rounded-3xl border-white/10 shadow-2xl skew-y-3 transform hover:skew-y-0 transition-all duration-700">
            <Image
              src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=2070&q=80"
              alt="Ocean Fish Market"
              width={800}
              height={400}
              className="rounded-2xl w-full h-[400px] object-cover"
            />
            <div role="group" className="absolute -bottom-8 -right-8 glass p-6 rounded-2xl border-ocean-500/30 shadow-2xl" aria-label={`${t.todaySale}: ₹45.2k`}>
              <div className="flex items-center gap-4 mb-2">
                <TrendingUp className="w-8 h-8 text-green-400" aria-hidden="true" />
                <div>
                  <p className="text-2xl font-black text-white" aria-hidden="true">₹45.2k</p>
                  <p className="text-[10px] font-bold text-ocean-500 uppercase" aria-hidden="true">{t.todaySale}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section aria-label="Features" className="bg-ocean-900/30 py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-black text-white mb-4 italic">{t.builtForEveryRole}</h2>
            <div className="w-20 h-1 bg-ocean-500 mx-auto" role="presentation" />
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <FeatureCard
              icon={Ship}
              title={t.boatOwner}
              desc={t.boatOwnersFeature}
              color="text-ocean-400"
            />
            <FeatureCard
              icon={ShieldCheck}
              title={t.agent}
              desc={t.marketAgentsFeature}
              color="text-coral-400"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer aria-label="Site footer" className="py-20 border-t border-white/5 text-center">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-8 h-8 bg-ocean-800 rounded-lg flex items-center justify-center" aria-hidden="true">
            <Fish className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold text-white uppercase tracking-tighter">{t.appName} OS</span>
        </div>
        <div className="flex justify-center mb-4">
          <Link href="/about" className="text-sm font-bold text-ocean-400 hover:text-white transition-colors">
            {t.aboutOurProject || "About Our Project"}
          </Link>
        </div>
        <p className="text-ocean-700 text-sm italic">© 2026 {t.appName}. {t.footerTagline}</p>
      </footer>
    </main>
  );
}

const FeatureCard = ({ icon: Icon, title, desc, color }: { icon: React.ElementType, title: string, desc: string, color: string }) => (
  <Card className="hover:border-ocean-500/50 transition-all group">
    <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
      <Icon className={`w-6 h-6 ${color}`} />
    </div>
    <h3 className="text-xl font-bold text-white mb-4 group-hover:text-ocean-300 transition-colors uppercase italic">{title}</h3>
    <p className="text-ocean-400 leading-relaxed text-sm">{desc}</p>
  </Card>
);
