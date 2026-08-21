import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Boat, ApiError } from '@fishmarket/shared-types';
import { findOwnerByContact, requestBoatLink, createBoatAgent } from '@/lib/api/agentApi';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgent } from '../_context/AgentContext';
import { offlineStorage } from '@/lib/offlineStorage';
import { useToast } from '@fishmarket/ui';

interface AddBoatModalProps {
    showAddBoat: boolean;
    setShowAddBoat: (show: boolean) => void;
    refreshBoats: () => void;
    t: any;
}

export const AddBoatModal: React.FC<AddBoatModalProps> = ({ showAddBoat, setShowAddBoat, refreshBoats, t }) => {
    const { toast } = useToast();
    const [ownerSearchQuery, setOwnerSearchQuery] = useState("");
    const [searchResult, setSearchResult] = useState<{ owner: { name: string; phone: string }; boats: Boat[] } | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [requestingBoatId, setRequestingBoatId] = useState<number | null>(null);

    const [addMode, setAddMode] = useState<'link' | 'local'>('link');
    const [localBoatName, setLocalBoatName] = useState("");
    const { lang } = useLanguage();
    const { isOnline } = useAgent();

    const handleCreateLocal = async () => {
        if (!localBoatName.trim()) return;
        setRequestingBoatId(-1); // using -1 as loading state for local boat
        try {
            const payload = { name: localBoatName.trim() };
            if (!isOnline) {
                await offlineStorage.addPendingSale({ type: 'add-boat', payload });
                toast("Local boat saved offline", "info");
            } else {
                await createBoatAgent(payload);
                toast("Local boat created", "success");
            }
            setShowAddBoat(false);
            setLocalBoatName("");
            refreshBoats();
        } catch (err: unknown) {
            const error = err as ApiError;
            toast(error.response?.data?.message || "Failed to create boat", "error");
        } finally {
            setRequestingBoatId(null);
        }
    };

    const handleSearchOwner = async () => {
        if (!ownerSearchQuery.trim()) return;
        setIsSearching(true);
        setSearchResult(null);
        try {
            const res = await findOwnerByContact(ownerSearchQuery.trim());
            setSearchResult(res);
        } catch (err: unknown) {
            const error = err as ApiError;
            toast(error.response?.data?.message || "Owner not found", "error");
        } finally {
            setIsSearching(false);
        }
    };

    const handleRequestLink = async (boatId: number) => {
        setRequestingBoatId(boatId);
        try {
            await requestBoatLink(boatId);
            toast("Request sent to owner", "success");
            setShowAddBoat(false);
            setSearchResult(null);
            setOwnerSearchQuery("");
            refreshBoats();
        } catch (err: unknown) {
            const error = err as ApiError;
            toast(error.response?.data?.message || "Failed to send request", "error");
        } finally {
            setRequestingBoatId(null);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && showAddBoat) {
                setShowAddBoat(false);
                setSearchResult(null);
                setOwnerSearchQuery("");
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showAddBoat]);

    return (
        <AnimatePresence>
            {showAddBoat && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Add new boat"
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
                >
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden relative"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-ocean-50/50 rounded-bl-[5rem] -mr-16 -mt-16" />
                        
                        <h3 className="text-2xl font-black text-ocean-950 mb-2 flex items-center gap-2 relative z-10">
                            ⚓ {t.boats.add}
                        </h3>
                        <p className="text-ocean-600 text-[10px] font-black uppercase tracking-widest mb-6 relative z-10 px-1">
                            Search for boat owner to request access
                        </p>

                        <div className="space-y-6 relative z-10">
                            {/* Tabs for Add Mode */}
                            <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
                                <button
                                    onClick={() => setAddMode('link')}
                                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${addMode === 'link' ? 'bg-white shadow text-ocean-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {lang === 'ta' ? 'இணைப்பு கோரிக்கை' : 'Link Owner'}
                                </button>
                                <button
                                    onClick={() => setAddMode('local')}
                                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1 ${addMode === 'local' ? 'bg-white shadow text-ocean-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {lang === 'ta' ? 'உள்ளூர் படகு' : 'Local Boat'}
                                </button>
                            </div>

                            {addMode === 'link' ? (
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <input 
                                                autoFocus
                                                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-black text-sm font-bold focus:outline-none focus:ring-4 focus:ring-ocean-500/10 transition-all placeholder-gray-300"
                                                placeholder="Mobile or Email"
                                                value={ownerSearchQuery}
                                                onChange={e => setOwnerSearchQuery(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleSearchOwner()}
                                            />
                                        </div>
                                        <button 
                                            onClick={handleSearchOwner}
                                            disabled={isSearching || !isOnline}
                                            className="bg-ocean-600 text-white px-6 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-ocean-700 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {isSearching ? "..." : "Search"}
                                        </button>
                                    </div>
                                    {!isOnline && (
                                        <p className="text-xs text-red-500 font-bold">You must be online to search for an owner.</p>
                                    )}

                                    {searchResult && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-4 pt-2"
                                        >
                                            <div className="bg-ocean-50/50 rounded-2xl p-4 border border-ocean-100">
                                                <div className="text-[10px] font-black text-ocean-500 uppercase tracking-widest mb-1">Owner Found</div>
                                                <div className="text-ocean-950 font-black">{searchResult.owner.name}</div>
                                                <div className="text-[10px] font-bold text-ocean-400">{searchResult.owner.phone}</div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="text-[10px] font-black text-ocean-500 uppercase tracking-widest px-1">Available Boats</div>
                                                {searchResult.boats.length === 0 ? (
                                                    <div className="text-center py-4 text-gray-400 text-xs font-bold italic">No boats registered by this owner.</div>
                                                ) : (
                                                    <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                                        {searchResult.boats.map(b => (
                                                            <div key={b.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl p-4 hover:border-ocean-300 transition-all group">
                                                                <div>
                                                                    <div className="font-black text-ocean-950 group-hover:text-ocean-600 transition-colors uppercase text-sm tracking-tight italic">{b.name}</div>
                                                                    {b.agent_id && <div className="text-[9px] font-black text-coral-500 uppercase tracking-tighter">Already Managed</div>}
                                                                </div>
                                                                <button 
                                                                    disabled={requestingBoatId !== null || (b.status === 'active' && b.agent_id !== null)}
                                                                    onClick={() => handleRequestLink(b.id)}
                                                                    className="bg-ocean-100 text-ocean-600 hover:bg-ocean-600 hover:text-white p-2.5 rounded-xl transition-all active:scale-90 disabled:opacity-30 disabled:hover:bg-ocean-100 disabled:hover:text-ocean-600"
                                                                >
                                                                    {requestingBoatId === b.id ? (
                                                                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                                    ) : (
                                                                        <ArrowRight className="w-5 h-5" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <input 
                                        autoFocus
                                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-black text-sm font-bold focus:outline-none focus:ring-4 focus:ring-ocean-500/10 transition-all placeholder-gray-300"
                                        placeholder={lang === 'ta' ? 'படகு பெயர்' : 'Local Boat Name'}
                                        value={localBoatName}
                                        onChange={e => setLocalBoatName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleCreateLocal()}
                                    />
                                    <button 
                                        onClick={handleCreateLocal}
                                        disabled={!localBoatName.trim() || requestingBoatId !== null}
                                        className="w-full bg-ocean-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-ocean-700 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {requestingBoatId !== null ? "..." : (lang === 'ta' ? 'உருவாக்கு' : 'Create Local Boat')}
                                    </button>
                                    {!isOnline && (
                                        <p className="text-xs text-amber-600 font-bold text-center mt-2">Will sync automatically when back online.</p>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-3 pt-4 border-t border-gray-50">
                                <button 
                                    onClick={() => {
                                        setShowAddBoat(false);
                                        setSearchResult(null);
                                        setOwnerSearchQuery("");
                                        setLocalBoatName("");
                                    }}
                                    className="w-full bg-gray-50 text-ocean-400 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-ocean-50 hover:text-ocean-900 transition-all"
                                >
                                    {t.boats?.cancel || "Close"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
