"use client";

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Root App Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-6 text-white font-sans selection:bg-cyan-500/30">
      {/* Background Mesh Gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute bottom-[0%] right-[-5%] w-[35%] h-[35%] rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg relative"
      >
        <div className="bg-slate-900/50 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-10 md:p-14 shadow-2xl relative overflow-hidden text-center">
            
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
              className="w-20 h-20 bg-rose-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-rose-500/30"
            >
              <AlertTriangle className="w-10 h-10 text-rose-400" />
            </motion.div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-4 text-white">
              Something went wrong
            </h1>
            
            <p className="text-slate-400 text-base md:text-lg mb-10 font-medium leading-relaxed max-w-sm mx-auto">
              The application encountered an unexpected error. Don&apos;t worry, your data is safe.
            </p>

            {error.digest && (
               <div className="mb-10 px-4 py-2 bg-white/5 rounded-xl border border-white/5 inline-block">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Error Digest</p>
                  <code className="text-xs font-mono text-cyan-400">{error.digest}</code>
               </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => reset()}
                className="group flex items-center justify-center gap-3 px-8 py-4 bg-white text-slate-950 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-cyan-400 hover:text-slate-950 transition-all duration-300 shadow-xl shadow-white/5 active:scale-95"
              >
                <RefreshCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                Retry Now
              </button>
              
              <Link
                href="/"
                className="group flex items-center justify-center gap-3 px-8 py-4 bg-white/5 text-white border border-white/10 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-all duration-300 active:scale-95"
              >
                <Home className="w-4 h-4" />
                Go Home
              </Link>
            </div>

            <p className="mt-12 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">
              Deep Ocean Fish Market System
            </p>
        </div>
      </motion.div>
    </div>
  );
}
