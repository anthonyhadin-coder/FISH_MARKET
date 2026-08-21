'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';

// Mock data for the marketplace stub
const MOCK_MARKET = [
    { id: 1, fish: 'Seer Fish', weight: 15, price: 450, agent: 'Rajesh', location: 'Chennai Port' },
    { id: 2, fish: 'Pomfret', weight: 8, price: 650, agent: 'Mani', location: 'Kochi Harbor' },
    { id: 3, fish: 'Prawns', weight: 25, price: 380, agent: 'Suresh', location: 'Mangalore' },
];

export default function MarketplacePage() {
    const [listings, _setListings] = useState(MOCK_MARKET);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-black text-ocean-950">Live Auctions</h2>
                    <p className="text-sm font-bold text-gray-400">Bid on fresh catches from trusted agents.</p>
                </div>
                <div className="flex gap-2">
                    <input 
                        type="search" 
                        placeholder="Search fish..." 
                        className="bg-white border border-gray-100 rounded-2xl px-5 py-3 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-ocean-500/10 transition-all shadow-sm"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map(item => (
                    <motion.div 
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all group cursor-pointer relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-ocean-50 to-transparent opacity-50 rounded-bl-[4rem] group-hover:scale-110 transition-transform" />
                        
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div>
                                <h3 className="text-lg font-black text-ocean-950 group-hover:text-ocean-600 transition-colors uppercase tracking-tight">{item.fish}</h3>
                                <p className="text-xs font-bold text-gray-400">{item.weight} kg available</p>
                            </div>
                            <span className="bg-coral-50 text-coral-600 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                Live
                            </span>
                        </div>
                        
                        <div className="mb-6 relative z-10">
                            <div className="text-2xl font-black text-gray-900">₹{item.price}<span className="text-xs text-gray-400 font-bold">/kg</span></div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-50 relative z-10">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black uppercase tracking-widest text-ocean-400">Agent</span>
                                <span className="text-sm font-bold text-gray-700">{item.agent}</span>
                            </div>
                            <button className="bg-ocean-50 text-ocean-600 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-ocean-600 hover:text-white transition-colors">
                                Place Bid
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
