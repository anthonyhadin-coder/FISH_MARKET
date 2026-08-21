import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface NotificationDropdownProps {
    t: any;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ t }) => {
    const { lang } = useLanguage();
    const { notifications, markAsRead, clearAll } = useNotifications();
    const [showNotifs, setShowNotifs] = useState(false);
    
    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="relative">
            <button 
                onClick={() => setShowNotifs(!showNotifs)}
                aria-label={lang === 'ta' ? 'அறிவிப்புகள்' : 'Notifications'}
                className="p-2.5 rounded-xl hover:bg-gray-100 transition-all relative group"
            >
                <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-ocean-600 fill-ocean-50' : 'text-gray-400'}`} />
                {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-4 h-4 bg-coral-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                        {unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {showNotifs && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 py-4 z-[100]"
                    >
                        <div className="flex items-center justify-between px-5 mb-4">
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-ocean-900">{t.notifications}</h3>
                            {notifications.length > 0 && (
                                <button onClick={() => { clearAll(); setShowNotifs(false); }} className="text-[9px] font-bold text-ocean-400 hover:text-ocean-600 transition-colors uppercase">{t.clearAll}</button>
                            )}
                        </div>
                        <div className="max-h-80 overflow-y-auto px-2 space-y-1">
                            {notifications.length === 0 ? (
                                <div className="py-8 text-center">
                                    <p className="text-xs text-gray-400 font-medium">No new alerts.</p>
                                </div>
                            ) : (
                                notifications.map(n => (
                                    <div 
                                        key={n.id} 
                                        onClick={() => markAsRead(String(n.id))}
                                        className={`p-3 rounded-xl cursor-pointer transition-all ${n.read ? 'opacity-50' : 'bg-ocean-50/50 hover:bg-ocean-50'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-[10px] font-black uppercase ${n.type === 'success' ? 'text-green-600' : n.type === 'error' ? 'text-coral-500' : 'text-ocean-600'}`}>{n.title}</span>
                                            <span className="text-[9px] text-gray-400 font-medium">{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <p className="text-[11px] text-gray-600 font-medium leading-relaxed">{n.message}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
