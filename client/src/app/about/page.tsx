"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { Fish, ShieldCheck, Ship, Database, WifiOff, Globe } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useLanguage } from '@/contexts/LanguageContext';
import { T } from '@/lib/i18n';

export default function AboutPage() {
  const { lang } = useLanguage();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setTimeout(() => setMounted(true), 0);
  }, []);

  const currentLang = mounted ? lang : 'en';
  const t = T[currentLang];

  return (
    <div className="min-h-screen bg-ocean-950 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pb-20">
      {/* Navigation Bar */}
      <nav className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-ocean-600 rounded-xl flex items-center justify-center shadow-lg shadow-ocean-600/20">
            <Fish className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-black text-white tracking-tighter">{t.appName}</span>
        </Link>
        <Link href="/">
          <Button variant="ghost" className="text-ocean-200">Back to Home</Button>
        </Link>
      </nav>

      <main id="main-content">
        {/* Hero Header */}
        <header className="max-w-4xl mx-auto px-6 pt-12 pb-16 text-center">
          <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-ocean-900/50 border border-ocean-800 rounded-full text-ocean-400 text-xs font-bold uppercase tracking-widest mb-6">
              <Globe className="w-4 h-4" />
              Project Overview
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-white leading-tight mb-6 italic uppercase">
              {t.aboutOurProject || "About Our Project"}
            </h1>
            <p className="text-xl text-ocean-300 leading-relaxed max-w-2xl mx-auto">
              A high-performance Progressive Web Application (PWA) designed to seamlessly digitize the daily operations of a wholesale fish market. Features an offline-first architecture, multilingual voice commands, real-time data sync, and a role-based dashboard.
            </p>
          </motion.div>
        </header>

        {/* Main Content Sections */}
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
             <FeatureBox 
               icon={WifiOff} 
               title="Offline-First Capabilities" 
               desc="Our core IndexedDB-powered engine guarantees that agents can record every catch and transaction, even when internet connectivity drops entirely. Data syncs flawlessly when online."
             />
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
             <FeatureBox 
               icon={Database} 
               title="Real-Time Synchronization" 
               desc="The backend is powered by Node.js & Redis. It manages atomic operations for token denylists, concurrent sales state hydration, and immediate ledger updates for all connected market participants."
             />
          </motion.div>
          
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.4 }}>
             <FeatureBox 
               icon={Ship} 
               title="Role-Based Dashboards" 
               desc="Separate specialized interfaces for Boat Owners and Market Agents. Owners view fleet-wide catch reports and salary payouts, whilst agents manage rapid data-entry on the ground."
             />
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.5 }}>
             <FeatureBox 
               icon={ShieldCheck} 
               title="Production Ready Security" 
               desc="Secured by SameSite strict JWT HttpOnly cookies with stateless refresh lifecycles, account lockout defenses, rate-limiting, and comprehensive role-based access control."
             />
          </motion.div>
        </div>

        {/* Innovation & Patent Strategy Section */}
        <section className="max-w-5xl mx-auto px-6 mt-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Innovation & Patent Strategy</h2>
            <p className="text-ocean-400 text-sm mt-2">Protecting India's Maritime Tech Intelligence</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-ocean-900/40 border-ocean-800 p-6">
              <h4 className="text-ocean-400 font-bold text-xs uppercase mb-3">IP Strategy</h4>
              <p className="text-white font-bold mb-2">Is it patentable?</p>
              <p className="text-ocean-300 text-xs leading-relaxed">
                Our localized Tamil Voice Parser and specialized noise-handling logic for chaotic markets constitute a "Technical Contribution" protectable via patents and trade secrets in India.
              </p>
            </Card>
            <Card className="bg-ocean-900/40 border-ocean-800 p-6">
              <h4 className="text-ocean-400 font-bold text-xs uppercase mb-3">India Roadmap</h4>
              <p className="text-white font-bold mb-2">Filing Timeline</p>
              <p className="text-ocean-300 text-xs leading-relaxed">
                Step-by-step roadmap from Provisional Specification (lock priority) to Complete Filing. Focus on technical effects in the maritime supply chain.
              </p>
            </Card>
            <Card className="bg-ocean-900/40 border-ocean-800 p-6">
              <h4 className="text-ocean-400 font-bold text-xs uppercase mb-3">Student Support</h4>
              <p className="text-white font-bold mb-2">Low-Cost SIPP</p>
              <p className="text-ocean-300 text-xs leading-relaxed">
                Leveraging the KAPILA scheme to recover filing costs and the SIPP program for professional patent drafting facilitation for student innovators.
              </p>
            </Card>
          </div>
        </section>

        {/* Footer Call to Action */}
        <section className="max-w-4xl mx-auto px-6 mt-24 text-center">
          <Card className="bg-ocean-800/30 border border-ocean-700/50 p-10 flex flex-col items-center">
             <h3 className="text-2xl font-bold text-white mb-4 italic">Ready to manage your fleet?</h3>
             <Link href="/register">
               <Button className="px-8 py-3 text-lg font-bold bg-ocean-100 text-ocean-950 hover:bg-white transition-all shadow-xl shadow-ocean-500/20">
                 Launch the App
               </Button>
             </Link>
          </Card>
        </section>
      </main>
    </div>
  );
}

const FeatureBox = ({ icon: Icon, title, desc }: { icon: React.ElementType, title: string, desc: string }) => (
  <Card className="p-8 h-full bg-ocean-900/40 border border-ocean-800 hover:border-ocean-600 transition-colors">
    <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6">
      <Icon className="w-6 h-6 text-ocean-400" />
    </div>
    <h3 className="text-xl font-bold text-white mb-3 tracking-wide">{title}</h3>
    <p className="text-ocean-300 leading-relaxed text-sm">
      {desc}
    </p>
  </Card>
);
