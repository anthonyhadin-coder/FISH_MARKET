"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Compass, ArrowLeft, Anchor } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-6 text-white font-sans selection:bg-cyan-500/30 overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <motion.div 
            animate={{ 
                x: [0, 20, 0],
                y: [0, -20, 0],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute top-[15%] right-[10%] w-[30%] h-[30%] rounded-full bg-cyan-600/5 blur-[100px]" 
        />
        <motion.div 
            animate={{ 
                x: [0, -30, 0],
                y: [0, 40, 0],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-[10%] left-[5%] w-[40%] h-[40%] rounded-full bg-indigo-600/5 blur-[120px]" 
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl relative text-center"
      >
        <div className="relative inline-block mb-12">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-40px] border border-white/5 rounded-full"
            />
            <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-80px] border border-white/5 rounded-full border-dashed"
            />
            <div className="w-32 h-32 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center shadow-2xl relative z-10">
                <Compass className="w-16 h-16 text-cyan-400" />
            </div>
        </div>

        <h1 className="text-8xl md:text-9xl font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20 select-none">
          404
        </h1>
        
        <h2 className="text-2xl md:text-3xl font-bold mb-6 text-white tracking-tight">
          Lost at Sea?
        </h2>
        
        <p className="text-slate-400 text-base md:text-lg mb-12 font-medium leading-relaxed max-w-md mx-auto">
          The page you are looking for has drifted away or never existed in this deep blue ocean.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <Link
                href="/"
                className="w-full sm:w-auto group flex items-center justify-center gap-3 px-10 py-5 bg-cyan-500 text-slate-950 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-cyan-400 transition-all duration-300 shadow-xl shadow-cyan-500/20 active:scale-95"
            >
                <Anchor className="w-5 h-5" />
                Back to Harbor
            </Link>

            <button
                onClick={() => window.history.back()}
                className="w-full sm:w-auto group flex items-center justify-center gap-3 px-10 py-5 bg-white/5 text-white border border-white/10 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-all duration-300 active:scale-95"
            >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                Head Back
            </button>
        </div>

        <div className="mt-20 pt-10 border-t border-white/5 flex items-center justify-center gap-6 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
             <div className="h-0.5 w-12 bg-white/20" />
             <span className="text-[10px] font-black uppercase tracking-[0.3em]">Fish Market Navigator</span>
             <div className="h-0.5 w-12 bg-white/20" />
        </div>
      </motion.div>
    </div>
  );
}
