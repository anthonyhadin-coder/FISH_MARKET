"use client";
import React, { useState } from 'react';

export const FeedbackWidget = () => {
    const [open, setOpen] = useState(false);
    return (
        <div className="fixed bottom-4 left-4 z-50">
            <button 
                onClick={() => setOpen(!open)} 
                className="w-10 h-10 bg-coral-500 text-white rounded-full shadow-lg shadow-coral-500/30 flex items-center justify-center hover:scale-105 transition-transform"
                title="Send Feedback"
            >
                💬
            </button>
            {open && (
                <div className="absolute bottom-14 left-0 bg-white border border-ocean-100 p-4 w-64 shadow-xl rounded-2xl">
                    <h4 className="text-sm font-bold text-ocean-900 mb-2">Beta Feedback</h4>
                    <p className="text-xs text-ocean-600 mb-3">Found a bug or have a suggestion? Let us know!</p>
                    <a href="mailto:support@fishmarket.app" className="block text-center w-full bg-ocean-500 text-white text-xs font-bold py-2 rounded-xl hover:bg-ocean-600 transition-colors">
                        Send Email
                    </a>
                </div>
            )}
        </div>
    );
};
