'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function AuditLogsPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-black text-ocean-950">Audit Logs</h2>
                    <p className="text-sm font-bold text-gray-400">System activity and security events.</p>
                </div>
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center min-h-[400px]"
            >
                <div className="w-16 h-16 bg-ocean-50 text-ocean-600 rounded-full flex items-center justify-center text-2xl mb-4">
                    🔍
                </div>
                <h3 className="text-lg font-black text-ocean-950 mb-2">Logs Temporarily Unavailable</h3>
                <p className="text-sm font-bold text-gray-400 max-w-sm">
                    The audit logging system is currently being integrated. Check back soon for detailed activity tracking.
                </p>
            </motion.div>
        </div>
    );
}
