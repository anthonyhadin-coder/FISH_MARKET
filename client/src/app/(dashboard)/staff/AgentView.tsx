import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Bell, History, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgent } from './_context/AgentContext';
import { EntryTab } from './_components/EntryTab';
import { SlipTab } from './_components/SlipTab';
import { ReportsTab } from './_components/ReportsTab';
import { BuyersTab } from './_components/BuyersTab';
import { HistoryTab } from './_components/HistoryTab';
import { T_AGENT, toKey, Payment, SaleRow, EXP_KEYS } from './SharedUI';
import api from '@/lib/api';
import { ApiError, Buyer } from '@/lib/types';
import { ParsedVoiceResult } from '@/lib/voice/voiceParser';
import { offlineStorage } from '@/lib/offlineStorage';
import { createBoat } from '@/lib/api/agentApi';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { VoiceInput } from '@/components/voice/VoiceInput';
import { useToast } from '@/components/ui/Toast';

type Tab = "entry" | "slip" | "reports" | "buyers" | "history";

export default function AgentDashboard() {
    const { user, logout } = useAuth();
    const { lang, setLang } = useLanguage();

    const { 
        boats, 
        selectedBoat, 
        setSelectedBoat,
        buyers,
        refreshBoats,
        isLoading: boatsLoading,
        isOnline,
        isSyncing,
        pendingCount,
        syncOfflineData
    } = useAgent();

    const { notifications, markAsRead, clearAll } = useNotifications();
    const [showNotifs, setShowNotifs] = useState(false);
    const unreadCount = notifications.filter(n => !n.read).length;
    const { permission, subscribed, subscribe, loading: pushLoading } = usePushNotifications();

    const [activeTab, setActiveTab] = useState<Tab>("entry");
    const [dateKey, setDateKey] = useState(toKey(new Date()));
    const [commRate] = useState(8);
    const { toast } = useToast();
    
    const [rec, setRec] = useState<{
        exp: Record<string, string>;
        notes: Record<string, string>;
        rows: SaleRow[];
    }>({
        exp: EXP_KEYS.reduce((a, k) => ({ ...a, [k]: "" }), {}),
        notes: EXP_KEYS.reduce((a, k) => ({ ...a, [k]: "" }), {}),
        rows: []
    });

    const [newRow, setNR] = useState({fish:"", weight:"", rate:"", buyer:"", paid: ""});
    const [payAmt, setPayAmt] = useState("");
    const [payNote, setPayNote] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [payments, setPayments] = useState<Payment[]>([]);
    const [dailySales, setDailySales] = useState<SaleRow[]>([]);
    const [showAddBoat, setShowAddBoat] = useState(false);
    const [newBoatName, setNewBoatName] = useState("");
    const [addingBoat, setAddingBoat] = useState(false);

    const updateRec = useCallback((fn: (prev: typeof rec) => typeof rec) => {
        setRec(prev => fn(prev));
    }, []);

    const round = (n: number) => Math.round(n * 1000) / 1000;
    const roundFin = (n: number) => Math.round(n * 100) / 100;

    const fetchDailyData = useCallback(async () => {
        if (!selectedBoat) return;
        try {
            const [salesRes, paymentsRes] = await Promise.all([
                api.get(`/sales/history?boatId=${selectedBoat.id}&date=${dateKey}`),
                api.get(`/boat-payments?boatId=${selectedBoat.id}&date=${dateKey}`)
            ]);
            setDailySales(salesRes.data || []);
            setPayments(paymentsRes.data || []);
        } catch (err: unknown) {
            const error = err as ApiError;
            console.error("Failed to fetch daily data details:", error.message, error.code, error.response?.status);
            toast("Data error", "error");
        }
    }, [selectedBoat, dateKey]);

    const addRow = useCallback(async () => {
        if (!user || !selectedBoat || !newRow.fish || !newRow.weight || !newRow.rate) {
            setFieldErrors({
                fish: !newRow.fish ? "Fish name required" : "",
                weight: !newRow.weight ? "Weight required" : "",
                rate: !newRow.rate ? "Rate required" : ""
            });
            return;
        }
        
        const payload = {
            boatId: selectedBoat.id,
            fishName: newRow.fish,
            weight: round(parseFloat(newRow.weight)),
            rate: roundFin(parseFloat(newRow.rate)),
            buyerName: newRow.buyer || "",
            amountPaid: roundFin(parseFloat(newRow.paid) || 0)
        };

        setFieldErrors({});
        try {
            await api.post('/sales', payload);
            toast("Sale recorded", "success");
            fetchDailyData();
            setNR({fish:"", weight: "", rate: "", buyer: "", paid: ""}); 
        } catch (err: unknown) {
            const error = err as ApiError;
            console.error("addRow API failed:", error.message, error.code, "isOnline:", navigator.onLine);
            // Check navigator.onLine or if the error indicates a network failure
            if (!navigator.onLine || error.code === 'ERR_NETWORK' || !error.response) {
                await offlineStorage.addPendingSale({ type: 'sale', payload });
                toast("Saved offline", "info");
                    setNR({fish:"", weight: "", rate: "", buyer: "", paid: ""}); 
                    fetchDailyData();
                } else {
                    toast(error.response?.data?.message || "Failed to record sale", "error");
                }
            }
    }, [user, selectedBoat, newRow, toast, fetchDailyData]);

    const addPayment = async () => {
        if (!selectedBoat || !payAmt || +payAmt <= 0) {
            setFieldErrors({ amount: "Valid amount required" });
            return;
        }
        const payload = {
            boatId: selectedBoat.id,
            amount: roundFin(parseFloat(payAmt)),
            paymentMethod: 'cash',
            note: payNote.trim()
        };

        setFieldErrors({});
        try {
            await api.post('/boat-payments', payload);
            toast("Payment added", "success");
            fetchDailyData();
            setPayAmt(""); 
            setPayNote("");
        } catch (err: unknown) {
             const error = err as ApiError;
             if (!navigator.onLine) {
                await offlineStorage.addPendingSale({ type: 'payment', payload });
                toast("Payment saved offline", "info");
                setPayAmt(""); 
                setPayNote("");
                fetchDailyData();
            } else {
                toast(error.response?.data?.message || "Failed to add payment", "error");
            }
        }
    };

    const speakBack = useCallback((msg: string) => {
        if (!window.speechSynthesis) return;
        // Cancel any ongoing speech to prevent overlap
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-IN';
        utterance.rate = 1.1; // Slightly faster for efficiency
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    }, [lang]);

    // Global Voice Handler
    const onGlobalVoiceResult = useCallback((results: ParsedVoiceResult[]) => {
        if (!results || results.length === 0) return;
        
        results.forEach(item => {
            if (item.type === 'EXPENSE' && item.key) {
                setRec(prev => ({
                    ...prev,
                    exp: { ...prev.exp, [item.key as string]: String(item.amount || 0) }
                }));
                const msg = lang === 'ta' ? `${item.key} செலவு மாற்றப்பட்டது: ${item.amount || 0}` : `${item.key} expense updated: ${item.amount || 0}`;
                toast(msg, "success");
                speakBack(msg);
            } else if (item.type === 'COMMAND' && item.command) {
                if (item.command === 'save') {
                  setActiveTab("entry");
                  addRow(); 
                  speakBack(lang === 'ta' ? "சேமிக்கப்பட்டது" : "Recorded successfully");
                } else if (['entry', 'slip', 'reports', 'buyers', 'history'].includes(item.command)) {
                  setActiveTab(item.command as Tab);
                  const msg = lang === 'ta' ? `${item.command} பக்கம் மாற்றப்பட்டது` : `Switched to ${item.command}`;
                  toast(msg, "info");
                  speakBack(msg);
                } else if (item.command === 'english') {
                  setLang('en');
                  toast("Switched to English", "success");
                  speakBack("Language changed to English");
                } else if (item.command === 'tamil') {
                  setLang('ta');
                  toast("தமிழுக்கு மாற்றப்பட்டது", "success");
                  speakBack("மொழி தமிழுக்கு மாற்றப்பட்டது");
                }
            } else if (item.type === 'SALE') {
                setActiveTab("entry");
                setNR(prev => ({
                  ...prev,
                  fish: item.fish || prev.fish,
                  weight: item.weight ? String(item.weight) : prev.weight,
                  rate: item.rate ? String(item.rate) : prev.rate,
                  buyer: item.buyer || prev.buyer,
                  paid: item.amount ? String(item.amount) : prev.paid
                }));
                const msg = lang === 'ta' 
                    ? `${item.fish || 'மீன்'} ${item.weight || ''} கிலோ தயார்` 
                    : `${item.fish || 'Fish'} ${item.weight || ''} kg ready`;
                speakBack(msg);
            }
        });
    }, [lang, toast, addRow, setLang, speakBack]);

    useEffect(() => {
        void fetchDailyData();  
    }, [fetchDailyData]);

    // Summary calculations
    const totalSales = (dailySales || []).reduce((sum, r) => sum + (Number(r.weight) * Number(r.rate)), 0);
    const commission = Math.round(totalSales * (commRate / 100));
    const expAmts = EXP_KEYS.reduce((a, k) => ({ ...a, [k]: Number(rec.exp[k] || 0) }), {} as Record<string, number>);
    const totalExp = Object.values(expAmts).reduce((a, b) => a + b, 0);
    const totalDed = commission + totalExp;
    const netPay = totalSales - totalDed;
    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount || p.amt || 0)), 0);
    const remaining = netPay - totalPaid;
    const settled = netPay > 0 && remaining <= 0;

    const handleLogout = () => {
        logout();
    };

    const handleAddBoat = async () => {
        if (!newBoatName.trim() || !user?.id) return;
        setAddingBoat(true);
        try {
            await createBoat({ name: newBoatName.trim(), agentId: Number(user.id) });
            setNewBoatName("");
            setShowAddBoat(false);
            await refreshBoats(); 
        } catch (err) {
            if (!navigator.onLine) {
                await offlineStorage.addPendingSale({ 
                    type: 'add-boat', 
                    payload: { name: newBoatName.trim(), agentId: Number(user.id) } 
                });
                setNewBoatName("");
                setShowAddBoat(false);
                alert("Boat saved offline. It will appear once you sync.");
            } else {
                console.error("Failed to add boat", err);
                alert("Failed to add boat");
            }
        } finally {
            setAddingBoat(false);
        }
    };

    if (boatsLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="animate-spin text-4xl">⏳</div>
            </div>
        );
    }

    const t = T_AGENT[lang];

    return (
        <div className="min-h-screen bg-white text-black font-sans">
            {/* Push Notification Banner */}
            {permission === 'default' && !subscribed && (
                <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between text-sm font-medium"
                >
                    <div className="flex items-center gap-3">
                        <Bell size={18} className="animate-bounce" />
                        <span>{lang === 'ta' ? 'முக்கியமான அறிவிப்புகளைப் பெற புஷ் அறிவிப்புகளை இயக்கவும்' : 'Enable push notifications for important alerts'}</span>
                    </div>
                    <button 
                        onClick={subscribe}
                        disabled={pushLoading}
                        className="bg-white text-blue-600 px-3 py-1.5 rounded-md text-xs font-bold hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                        {pushLoading ? '...' : (lang === 'ta' ? 'அனுமதி' : 'ALLOW')}
                    </button>
                </motion.div>
            )}

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50 flex items-center justify-between px-4 md:px-8">
                <div className="flex items-center gap-3 group cursor-pointer">
                    <div className="w-10 h-10 bg-gradient-to-br from-ocean-600 to-ocean-900 rounded-xl flex items-center justify-center rotate-3 shadow-lg group-hover:rotate-6 transition-transform">
                        <span className="text-white font-bold text-xl">F</span>
                    </div>
                    <div>
                    <h2 data-testid="dashboard-heading" className="text-xl md:text-2xl font-black tracking-tight text-ocean-950">
                        {t.appName}
                    </h2>
                        <p className="text-[10px] font-bold text-ocean-500 uppercase tracking-widest leading-none mt-0.5">{t.tagline}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-ocean-50 rounded-xl border border-ocean-100">
                        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-xs font-bold text-ocean-700">{user?.name}</span>
                    </div>

                    {/* Language Toggle */}
                    <button 
                        onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
                        data-testid="language-toggle"
                        aria-label={lang === 'en' ? 'Switch to Tamil' : 'ஆங்கிலத்திற்கு மாறவும்'}
                        className="bg-gray-100/50 hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-black transition-colors"
                    >
                        {lang === 'en' ? 'தமிழ்' : 'EN'}
                    </button>

                    {/* Global Voice Assistant */}
                    <VoiceInput 
                        lang={lang as 'ta' | 'en'} 
                        onParsedResult={onGlobalVoiceResult} 
                        fishList={boats.map(b => b.name)} 
                        buyerList={buyers.map(b => b.name)}
                    />

                    {/* Notification Bell */}
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
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-ocean-900">Notifications</h3>
                                        {notifications.length > 0 && (
                                            <button onClick={clearAll} className="text-[9px] font-bold text-ocean-400 hover:text-ocean-600 transition-colors uppercase">Clear All</button>
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

                    <button 
                        onClick={handleLogout}
                        aria-label={t.logout}
                        className="p-2.5 rounded-xl text-coral-500 hover:bg-coral-50 transition-all group"
                        title={t.logout}
                    >
                        <LogOut className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                </div>
            </header>

            {/* Sidebar Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 md:top-16 md:bottom-0 md:left-0 md:w-24 bg-white md:bg-gray-50/50 border-t md:border-t-0 md:border-r border-gray-100 z-40 flex md:flex-col justify-around md:justify-start items-center p-3 md:py-10 gap-6">
                {[
                    { id: 'entry', label: t.tabs.entry, icon: '📝', color: 'from-blue-500 to-blue-600' },
                    { id: 'slip', label: t.tabs.slip, icon: '📄', color: 'from-purple-500 to-purple-600' },
                    { id: 'reports', label: t.tabs.reports, icon: '📊', color: 'from-green-500 to-green-600' },
                    { id: 'buyers', label: t.tabs.buyers, icon: '👥', color: 'from-orange-500 to-orange-600' },
                    { id: 'history', label: t.tabs.history, icon: '🕒', color: 'from-gray-500 to-gray-600' }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as Tab)}
                        data-testid={`${tab.id}-tab`}
                        className={`group relative flex flex-col md:w-16 md:h-16 items-center justify-center p-2 rounded-2xl transition-all duration-300 ${
                            activeTab === tab.id 
                                ? `bg-gradient-to-br ${tab.color} text-white shadow-xl shadow-blue-500/20 scale-110` 
                                : 'text-gray-400 hover:text-ocean-600 hover:bg-white hover:shadow-md'
                        }`}
                        title={tab.label}
                        aria-label={tab.label}
                    >
                        <span className="text-xl md:text-2xl transition-transform group-hover:scale-110">{tab.icon}</span>
                        <span className="text-[10px] md:hidden mt-1 font-bold">{tab.label}</span>
                        {activeTab === tab.id && (
                            <motion.div layoutId="activeTab" className="absolute -right-1 md:right-auto md:-bottom-1 w-1 h-1 md:w-6 md:h-1 bg-white rounded-full" />
                        )}
                    </button>
                ))}
            </nav>

            {/* Main Content Area */}
            <main role="main" className="pt-24 pb-24 md:pb-12 md:pl-28 px-6 md:px-12 max-w-7xl mx-auto min-h-screen">
                <h1 className="sr-only">{t.appName} - {t.tabs[activeTab]}</h1>

                {/* Offline Banner */}
                {!isOnline && (
                    <div
                        data-testid="offline-banner"
                        className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800 text-sm font-medium"
                    >
                        <span>📴</span>
                        <span>{lang === 'ta' ? 'நீங்கள் ஆஃப்லைனில் உள்ளீர்கள் — மாற்றங்கள் ஒத்திசைக்கப்படும்' : 'You are offline — changes will sync when reconnected'}</span>
                    </div>
                )}

                <div className="space-y-8">
                    {/* Top Bar: Boat Selector & Date */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                            {boats.map((boat) => (
                                <button
                                    key={boat.id}
                                    data-testid="boat-btn"
                                    onClick={() => setSelectedBoat(boat)}
                                    className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-bold transition-all ${
                                        selectedBoat?.id === boat.id
                                            ? 'bg-black text-white shadow-md ring-2 ring-black ring-offset-2'
                                            : 'bg-white border border-gray-200 text-gray-600 hover:border-black'
                                    }`}
                                >
                                    {boat.name}
                                </button>
                            ))}
                            <button
                                onClick={() => setShowAddBoat(true)}
                                className="px-4 py-2 rounded-xl whitespace-nowrap text-sm font-bold bg-ocean-50 border border-ocean-200 text-ocean-600 hover:bg-ocean-100 transition-all flex items-center gap-2"
                            >
                                ➕ {t.boats.add}
                            </button>
                        </div>
                        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                            <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 flex items-center gap-2">
                                <span className="text-gray-400">📅</span>
                                <span className="text-sm font-bold text-black">{dateKey}</span>
                            </div>
                        </div>
                    </div>

                    {/* Tab Panels */}
                    <div className="min-h-[600px] relative">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab + (selectedBoat?.id || '')}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                {activeTab === 'entry' && selectedBoat && (
                                    <EntryTab 
                                        lang={lang}
                                        canEdit={user?.role === 'agent' || user?.role === 'admin'}
                                        boat={selectedBoat}
                                        setBoat={setSelectedBoat}
                                        availBoats={boats}
                                        buyers={buyers}
                                        dateKey={dateKey}
                                        setDateKey={setDateKey}
                                        user={{ name: user?.name || "Agent" }}
                                        rec={rec}
                                        upd={updateRec}
                                        totalSales={totalSales}
                                        commRate={commRate}
                                        commission={commission}
                                        expAmts={expAmts}
                                        totalDed={totalDed}
                                        netPay={netPay}
                                        payments={payments}
                                        totalPaid={totalPaid}
                                        remaining={remaining}
                                        settled={settled}
                                        setTab={(tab) => setActiveTab(tab as Tab)}
                                        refreshDailyReport={fetchDailyData}
                                        dailySales={dailySales}
                                        onDeleteBoat={() => {}}
                                        newRow={newRow}
                                        setNR={setNR}
                                        addRow={addRow}
                                        addPayment={addPayment}
                                        payAmt={payAmt}
                                        setPayAmt={setPayAmt}
                                        payNote={payNote}
                                        setPayNote={setPayNote}
                                        fieldErrors={fieldErrors}
                                    />
                                )}
                        {activeTab === 'slip' && selectedBoat && (
                            <SlipTab 
                                lang={lang}
                                rec={rec}
                                boat={selectedBoat}
                                user={user as { id: string; name: string; role: string } | null}
                                dateKey={dateKey}
                                commRate={commRate}
                                commission={commission}
                                expAmts={expAmts}
                                totalDed={totalDed}
                                netPay={netPay}
                                payments={payments}
                                totalPaid={totalPaid}
                                remaining={remaining}
                                settled={settled}
                                setTab={(tab) => setActiveTab(tab)}
                                dailySales={dailySales}
                            />
                        )}
                        {activeTab === 'reports' && (
                            <ReportsTab lang={lang} availBoats={boats} commRate={commRate} />
                        )}
                        {activeTab === 'buyers' && (
                            <BuyersTab lang={lang} />
                        )}
                            {activeTab === 'history' && (
                               <HistoryTab lang={lang} />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
                </div>

                {/* Add Boat Modal */}
                <AnimatePresence>
                    {showAddBoat && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl border border-gray-100"
                            >
                                <h3 className="text-xl font-black text-ocean-950 mb-6 flex items-center gap-2">
                                    🚢 {t.boats.add}
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-ocean-500 uppercase tracking-widest mb-2 px-1">Boat Name</label>
                                        <input 
                                            autoFocus
                                            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-black text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all"
                                            placeholder={t.boats.namePlaceholder}
                                            value={newBoatName}
                                            onChange={e => setNewBoatName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddBoat()}
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button 
                                            disabled={addingBoat}
                                            onClick={handleAddBoat}
                                            className="flex-1 bg-black text-white py-3 rounded-xl font-bold text-sm hover:shadow-lg active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            {addingBoat ? "Adding..." : "Add Boat"}
                                        </button>
                                        <button 
                                            onClick={() => setShowAddBoat(false)}
                                            className="flex-1 bg-gray-50 text-gray-400 py-3 rounded-xl font-bold text-sm hover:bg-gray-100 transition-all"
                                        >
                                            {t.boats.cancel || "Cancel"}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
