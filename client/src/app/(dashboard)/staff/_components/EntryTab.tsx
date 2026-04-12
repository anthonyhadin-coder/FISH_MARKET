"use client";
import React, { useState, useRef } from "react";
import { T_AGENT, G, FISH_TA, FISH_TA_SYNONYMS, FISH_EN, FISH_COLORS, EXP_KEYS, EXP_ICONS, fmt, groupByFish, Label, Badge, Divider, GCard, makeInp, TH, TD, Payment, SaleRow } from "../SharedUI";
import api from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgent } from '../_context/AgentContext';
import { offlineStorage } from '@/lib/offlineStorage';
import { useToast } from '@/components/ui/Toast';
// Global declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: unknown;
    webkitSpeechRecognition: unknown;
  }
}

import { VoiceInput } from '@/components/voice/VoiceInput';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  onresult: (e: SpeechRecognitionEvent) => void;
  start: () => void;
  stop: () => void;
}

import { Boat, Buyer, ApiError } from "@/lib/types";
import { ParsedVoiceResult } from "@/lib/voice/voiceParser";

interface EntryTabProps {
    lang: string;
    canEdit: boolean;
    boat: Boat;
    setBoat: (boat: Boat | null) => void;
    availBoats: Boat[];
    dateKey: string;
    setDateKey: (date: string) => void;
    user: { name: string };
    rec: { exp: Record<string, string>; notes: Record<string, string>; rows: SaleRow[] };
    upd: (fn: (prev: { exp: Record<string, string>; notes: Record<string, string>; rows: SaleRow[] }) => { exp: Record<string, string>; notes: Record<string, string>; rows: SaleRow[] }) => void;
    totalSales: number;
    commRate: number;
    commission: number;
    expAmts: Record<string, number>;
    totalDed: number;
    netPay: number;
    payments: Payment[];
    totalPaid: number;
    remaining: number;
    settled: boolean;
    setTab: (tab: string) => void;
    refreshDailyReport: () => void;
    dailySales: SaleRow[];
    onDeleteBoat: () => void;
    buyers?: Buyer[];
    
    // Lifted props
    newRow: { fish: string; weight: string; rate: string; buyer: string; paid: string };
    setNR: React.Dispatch<React.SetStateAction<{ fish: string; weight: string; rate: string; buyer: string; paid: string }>>;
    addRow: () => Promise<void>;
    addPayment: () => Promise<void>;
    payAmt: string;
    setPayAmt: (v: string) => void;
    payNote: string;
    setPayNote: (v: string) => void;
    fieldErrors: Record<string, string>;
}

const round = (n: number) => Math.round(n * 1000) / 1000; // 3 decimals for weight, 2 for currency
const roundFin = (n: number) => Math.round(n * 100) / 100;

export function EntryTab({ 
    lang, canEdit, boat, setBoat, availBoats, dateKey, setDateKey, user, 
    rec, upd, totalSales, commRate, commission, expAmts, totalDed, 
    payments, totalPaid, remaining, settled, setTab,
    refreshDailyReport,
    dailySales,
    onDeleteBoat,
    buyers = [],
    newRow, setNR, addRow, addPayment, payAmt, setPayAmt, payNote, setPayNote, fieldErrors
}: EntryTabProps) {
    const t = T_AGENT[lang as 'en' | 'ta'];
    const { isOnline, pendingCount, syncOfflineData } = useAgent();
    
    const [suggest, setSug] = useState<string[]>([]);
    const [editId, setEId] = useState<string | number | null>(null);
    const [editVal, setEV] = useState<Partial<SaleRow>>({});
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [saved, setSaved] = useState(false);
    const { toast } = useToast();
    
    const fishRef = useRef<HTMLInputElement>(null);
    const fishList = lang === "ta" ? FISH_TA : FISH_EN;
    const inp = makeInp();

    const speak = (message: string, currentLang: string) => {
        if (!window.speechSynthesis) return;
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = currentLang === 'ta' ? 'ta-IN' : 'en-IN';
        window.speechSynthesis.speak(utterance);
    };
    
    // Use `dailySales` provided by the database or fallback to the local rec if we still use hybrid
    const rowsToGroup = dailySales || rec.rows;
    const grouped = groupByFish(rowsToGroup);
    const fishNames = Object.keys(grouped);
    const colorOf = (f: string) => FISH_COLORS[fishNames.indexOf(f) % FISH_COLORS.length];
    const toggleExp = (f: string) => setExpanded(p => ({...p, [f]: p[f] === false}));

    const delRow = async (id: string) => {
        if (!canEdit) return;
        if (!confirm("Are you sure you want to delete this sale?")) return;
        try {
            await api.delete(`/sales/${id}`);
            toast("Sale deleted", "success");
            refreshDailyReport();
        } catch (err: unknown) {
            const e = err as ApiError;
            if (!navigator.onLine) {
                await offlineStorage.addPendingSale({ type: 'delete-sale', id });
                toast("Deleted offline", "info");
                refreshDailyReport();
            } else {
                toast(e.response?.data?.message || t.actions.delSaleFail, "error");
            }
        }
    };

    const startEdit = (row: SaleRow) => {
        if(!canEdit) return;
        setEId(row.id);
        const fish = (row.fishName || row.fish || (row as unknown as Record<string, unknown>).fish_name || "") as string;
        const buyer = (row.buyerName || row.buyer || (row as unknown as Record<string, unknown>).buyer_name || "") as string;
        setEV({ fish, weight: row.weight, rate: row.rate, buyer, amountPaid: Number(row.amountPaid || (row as unknown as Record<string, unknown>).amount_paid || 0) });
    };

    const saveEdit = async (id: string | number) => {
        if (!canEdit || !editVal.fish || !editVal.weight || !editVal.rate) return;
        try {
            await api.patch(`/sales/${id}`, {
                fishName: editVal.fish,
                weight: round(parseFloat(editVal.weight as string)),
                rate: roundFin(parseFloat(editVal.rate as string)),
                buyerName: editVal.buyer || "",
                amountPaid: roundFin(parseFloat(editVal.amountPaid as unknown as string) || 0)
            });
            toast("Sale updated", "success");
            setEId(null);
            refreshDailyReport();
        } catch (e: unknown) {
            const err = e as ApiError;
            if (!navigator.onLine) {
                const payload = {
                    fishName: editVal.fish,
                    weight: round(parseFloat(editVal.weight as string)),
                    rate: roundFin(parseFloat(editVal.rate as string)),
                    buyerName: editVal.buyer || "",
                    amountPaid: roundFin(parseFloat(editVal.amountPaid as unknown as string) || 0)
                };
                await offlineStorage.addPendingSale({ type: 'update-sale', id, payload });
                toast("Updated offline", "info");
                setEId(null);
                refreshDailyReport();
            } else {
                toast(err.response?.data?.message || t.actions.updSaleFail, "error");
            }
        }
    };

    const delPayment = async (id: string) => {
        if (!canEdit) return;
        if (!confirm("Delete this payment?")) return;
        try {
            await api.delete(`/boat-payments/${id}`);
            toast("Payment deleted", "success");
            refreshDailyReport();
        } catch (err: unknown) {
            const e = err as ApiError;
            if (!navigator.onLine) {
                await offlineStorage.addPendingSale({ type: 'delete-payment', id });
                toast("Payment deleted offline", "info");
                refreshDailyReport();
            } else {
                toast(e.response?.data?.message || t.actions.delPayFail, "error");
            }
        }
    };

    const levenshtein = (a: string, b: string): number => {
        const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
        for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
        for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
            }
        }
        return matrix[a.length][b.length];
    };

    const fuzzyMatch = (input: string, list: string[], threshold = 0.3): string | null => {
        if (!input) return null;
        let bestMatch: string | null = null;
        let minDistance = Infinity;
        const lowerInput = input.toLowerCase();

        for (const item of list) {
            const lowerItem = item.toLowerCase();
            const distance = levenshtein(lowerInput, lowerItem);
            const score = distance / Math.max(lowerInput.length, lowerItem.length);
            if (score < minDistance && score <= threshold) {
                minDistance = score;
                bestMatch = item;
            }
        }
        return bestMatch;
    };

    const onVoiceResult = (results: ParsedVoiceResult[]) => {
        if (!results || results.length === 0) return;
        
        results.forEach(item => {
            if (item.type === 'SALE') {
                setNR(prev => ({
                    ...prev,
                    fish: item.fish || prev.fish,
                    weight: item.weight ? String(round(Number(item.weight))) : prev.weight,
                    rate: item.rate ? String(roundFin(Number(item.rate))) : prev.rate,
                    buyer: item.buyer || prev.buyer
                }));
            } else if (item.type === 'EXPENSE' && item.key) {
                upd(prev => ({
                    ...prev,
                    exp: { ...prev.exp, [item.key as string]: String(item.amount || 0) }
                }));
                const expenseName = item.key as string;
                toast(lang === 'ta' ? `${expenseName} செலவு மாற்றப்பட்டது: ${item.amount}` : `${expenseName} expense updated: ${item.amount}`, "success");
            } else if (item.type === 'COMMAND') {
                if (item.command === 'save') addRow();
                if (item.command === 'delete') {
                    const last = rowsToGroup[rowsToGroup.length-1];
                    if (last && last.id) delRow(String(last.id));
                }
            }
        });
    };



    // Use totalSales directly from dailyReport/props

    // Use totalSales directly from dailyReport/props
    const actualTotalSales = roundFin(totalSales);
    const actualTotalDed = roundFin(totalDed);
    const actualNetPay = roundFin(Math.max(0, actualTotalSales - actualTotalDed));

    return (
        <div style={{ paddingBottom: 100 }}>

            {!isOnline && (
                <div data-testid="offline-banner" style={{background:G.red+"22",border:`1px solid ${G.red}40`,borderRadius:10,padding:"10px 16px",marginBottom:14,fontSize:13,color:G.red,display:"flex",alignItems:"center",gap:8,fontWeight:700}}>
                    📡 {t.summary.offline}
                </div>
            )}

            {pendingCount > 0 && (
                <div onClick={syncOfflineData} style={{background:G.amber+"22",border:`1px solid ${G.amber}40`,borderRadius:10,padding:"10px 16px",marginBottom:14,fontSize:13,color:G.amber,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:isOnline?"pointer":"default"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,fontWeight:700}}>
                        ⏳ {t.summary.syncPending.replace('{n}', pendingCount.toString())}
                    </div>
                    {isOnline && <span style={{fontSize:11,fontWeight:800,textTransform:"uppercase"}}>{t.summary.syncNow}</span>}
                </div>
            )}

            {!canEdit && (
                <div style={{background:"#F59E0B14",border:"1px solid #F59E0B40",borderRadius:10,padding:"10px 16px",marginBottom:14,fontSize:13,color:"#FCD34D",display:"flex",alignItems:"center",gap:8}}>
                    👁 {t.readOnly}
                </div>
            )}

            {/* Meta */}
            <GCard style={{padding:"14px 18px",marginBottom:14}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12}}>
                    <div><Label data-testid="boat-label" c={t.fields.boat}/>
                        <div style={{display:"flex", gap:8}}>
                            <select value={boat?.id || ""} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>{
                                const b = availBoats.find((x: Boat)=>x.id.toString()===e.target.value);
                                if(b) setBoat(b);
                            }} style={inp}>{availBoats.map((b: Boat)=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
                            <button onClick={() => onDeleteBoat()} style={{background:G.red+"22", border:`1px solid ${G.red}40`, borderRadius:8, padding: "0 10px", color:G.red, cursor:"pointer", transition:"all .2s", fontSize: 11, fontWeight: 800}}>{t.actions.delete}</button>
                        </div>
                    </div>
                    <div><Label c={t.fields.date}/>
                        <input type="date" value={dateKey} onChange={e=>setDateKey(e.target.value)} style={inp}/>
                    </div>
                    <div><Label c={t.fields.agent}/>
                        <div style={{...inp,color:G.muted,fontSize:13,display:"flex",alignItems:"center"}}>{user.name}</div>
                    </div>
                    <div><Label c={t.summary.totalSales}/>
                        <div style={{...inp,background:"#10B98114",border:"1px solid #10B98140",color:G.green,fontWeight:900,fontSize:16,textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{fmt(actualTotalSales, t.fields.unitCurrency)}</div>
                    </div>
                </div>
            </GCard>

            {/* Add row */}
            {canEdit && (
                <GCard style={{padding:"16px 18px",marginBottom:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                        <div style={{width:6,height:6,borderRadius:"50%",background:G.accent}}/>
                        <span style={{fontSize:13,fontWeight:700,color:G.accent}}>{t.actions.newEntry}</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1.8fr 0.7fr 0.7fr 1.2fr 0.8fr 0.9fr 0.9fr auto",gap:8,alignItems:"end"}}>
                        <div style={{position:"relative"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                                <Label data-testid="fish-label" c={t.fields.fish} style={{color: (fieldErrors.fishName || fieldErrors.fish) ? G.red : G.muted, marginBottom:0}}/>
                                <VoiceInput lang={lang as 'ta' | 'en'} onParsedResult={onVoiceResult} targetField="fish" fishList={fishList} buyerList={buyers.map(b=>b.name)} />
                            </div>
                            <input ref={fishRef} data-testid="input-fish" style={{...inp, borderColor: (fieldErrors.fishName || fieldErrors.fish) ? G.red : G.text}} placeholder={t.fields.fishPlaceholder} value={newRow.fish}
                                onChange={e=>{setNR(p=>({...p,fish:e.target.value}));setSug(fishList.filter((f:string)=>f.toLowerCase().startsWith(e.target.value.toLowerCase())).slice(0,6));}}
                                onKeyDown={e=>{if(e.key==="Tab"||e.key==="Enter"){e.preventDefault();document.getElementById("wt")?.focus();}}}/>
                            {suggest.length>0 && (
                                <div style={{position:"absolute",top:"100%",left:0,right:0,background:G.card,border:`1px solid ${G.border}`,borderRadius:8,zIndex:99,boxShadow:"0 10px 40px -10px rgba(0,0,0,0.2)",overflow:"hidden"}}>
                                    {suggest.map(s=>(
                                        <div key={s} onClick={()=>{setNR(p=>({...p,fish:s}));setSug([]);document.getElementById("wt")?.focus();}}
                                            style={{padding:"9px 14px",cursor:"pointer",fontSize:13,borderBottom:`1px solid ${G.border}`}}
                                            onMouseEnter={e=>e.currentTarget.style.background=G.border}
                                            onMouseLeave={e=>e.currentTarget.style.background=""}>{s}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                                <Label c={t.fields.weight} style={{color: fieldErrors.weight ? G.red : G.muted, marginBottom:0}}/>
                                <VoiceInput lang={lang as 'ta' | 'en'} onParsedResult={onVoiceResult} targetField="weight" fishList={fishList} buyerList={buyers.map(b=>b.name)} />
                            </div>
                            <input id="wt" data-testid="input-weight" style={{...inp,textAlign:"right", borderColor: fieldErrors.weight ? G.red : G.text}} type="number" placeholder={t.fields.unitKg} value={newRow.weight}
                                onChange={e=>setNR(p=>({...p,weight:e.target.value}))}
                                onKeyDown={e=>{if(e.key==="Tab"||e.key==="Enter"){e.preventDefault();document.getElementById("rt")?.focus();}}}/>
                        </div>
                        <div>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                                <Label c={t.fields.rate} style={{color: fieldErrors.rate ? G.red : G.muted, marginBottom:0}}/>
                                <VoiceInput lang={lang as 'ta' | 'en'} onParsedResult={onVoiceResult} targetField="rate" fishList={fishList} buyerList={buyers.map(b=>b.name)} />
                            </div>
                            <input id="rt" data-testid="input-rate" style={{...inp,textAlign:"right", borderColor: fieldErrors.rate ? G.red : G.text}} type="number" placeholder={t.fields.unitCurrency} value={newRow.rate}
                                onChange={e=>setNR(p=>({...p,rate:e.target.value}))}
                                onKeyDown={e=>{if(e.key==="Tab"||e.key==="Enter"){e.preventDefault();document.getElementById("by")?.focus();}}}/>
                        </div>
                        <div style={{position:"relative"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                                <Label c={t.fields.buyer} style={{color: (fieldErrors.buyerName || fieldErrors.buyer) ? G.red : G.muted, marginBottom:0}}/>
                                <VoiceInput variant="minimal" lang={lang as 'ta' | 'en'} onParsedResult={onVoiceResult} targetField="buyer" fishList={fishList} buyerList={buyers.map(b=>b.name)} />
                            </div>
                            <input id="by" data-testid="input-buyer" style={{...inp, borderColor: (fieldErrors.buyerName || fieldErrors.buyer) ? G.red : G.text}} placeholder={t.fields.buyerPlaceholder} value={newRow.buyer}
                                onChange={e=>setNR(p=>({...p,buyer:e.target.value}))}
                                onKeyDown={e=>{if(e.key==="Tab"||e.key==="Enter"){e.preventDefault();document.getElementById("pd")?.focus();}}}/>
                        </div>
                        <div>
                            <Label c={t.fields.total}/>
                            <div style={{...inp, border: "none", background: "transparent", fontWeight: 800, color: G.accent, paddingTop: 11, textAlign: "right"}}>
                                {fmt(roundFin(Number(newRow.weight) * Number(newRow.rate) || 0), t.fields.unitCurrency)}
                            </div>
                        </div>
                        <div>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                                <Label c={t.fields.paid} style={{marginBottom:0}}/>
                                <VoiceInput variant="minimal" lang={lang as 'ta' | 'en'} onParsedResult={onVoiceResult} targetField="paid" fishList={fishList} buyerList={buyers.map(b=>b.name)} />
                            </div>
                            <input id="pd" data-testid="input-paid" style={{...inp, textAlign:"right", borderColor: G.text}} type="number" placeholder={t.fields.unitCurrency} value={newRow.paid}
                                onChange={e=>setNR(p=>({...p,paid:e.target.value}))}
                                onKeyDown={e=>{if(e.key==="Enter")addRow();}}/>
                        </div>
                        <div style={{textAlign: "right"}}>
                            <Label c={t.fields.remaining}/>
                            <div style={{...inp, border: "none", background: "transparent", fontWeight: 800, color: G.coral400, paddingTop: 11, textAlign: "right"}}>
                                {fmt(Math.max(0, roundFin((Number(newRow.weight) * Number(newRow.rate) || 0) - (Number(newRow.paid) || 0))), t.fields.unitCurrency)}
                            </div>
                        </div>
                        <button 
                            onClick={addRow} 
                            data-testid="add-row-btn"
                            style={{background:newRow.fish&&newRow.weight&&newRow.rate?G.accent:"#F3F4F6",border:"none",borderRadius:8,padding:"9px 14px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13,height:39,fontFamily:"inherit",whiteSpace:"nowrap"}}
                        >
                            {t.actions.addRow}
                        </button>
                    </div>
                </GCard>
            )}

            {/* Grouped fish */}
            {fishNames.length===0?(
                <GCard style={{padding:"40px 20px",textAlign:"center",marginBottom:14}}>
                    <div style={{fontSize:40,marginBottom:12}}>🐟</div>
                    <div style={{fontWeight:700,color:G.subtle,fontSize:15}}>{t.summary.noEntries}</div>
                    {canEdit&&<div style={{fontSize:13,color:G.muted,marginTop:4}}>{t.summary.addHint}</div>}
                </GCard>
            ):(
                <div style={{marginBottom:14}}>
                    {fishNames.map(fishName => {
                        const fRows = grouped[fishName];
                        const fTotal = fRows.reduce((a, r) => a + roundFin((+r.weight||0)*(+r.rate||0)), 0);
                        const fKg = fRows.reduce((a, r) => a + round(Number(r.weight||0)), 0);
                        const col = colorOf(fishName);
                        const isOpen = expanded[fishName] !== false;
                        return (
                            <GCard key={fishName} style={{overflow:"hidden",marginBottom:10}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:`${col}0D`,borderBottom:isOpen?`1px solid ${col}30`:"none"}}>
                                    <div onClick={()=>toggleExp(fishName)} style={{flex:1,display:"flex",alignItems:"center",gap:10,padding:"12px 16px",cursor:"pointer",userSelect:"none"}}>
                                        <div style={{width:10,height:10,borderRadius:"50%",background:col,boxShadow:`0 0 8px ${col}80`}}/>
                                        <span style={{fontWeight:800,fontSize:15,color:col}}>🐟 {fishName}</span>
                                        <Badge color={col}>{fRows.length} {t.summary.buyers}</Badge>
                                        <Badge color={G.muted}>{fKg} {t.fields.unitKg}</Badge>
                                    </div>
                                    <div style={{display:"flex",alignItems:"center",gap:10,paddingRight:16}}>
                                        <VoiceInput variant="minimal" lang={lang as 'ta' | 'en'} onParsedResult={(res: ParsedVoiceResult[]) => onVoiceResult(res.map(r => ({...r, fish: fishName})))} label="" fishList={fishList} buyerList={buyers.map(b=>b.name)} />
                                        <span onClick={()=>toggleExp(fishName)} style={{cursor:"pointer", fontWeight:900,fontSize:17,color:col,fontVariantNumeric:"tabular-nums"}}>{fmt(fTotal, t.fields.unitCurrency)}</span>
                                        <span onClick={()=>toggleExp(fishName)} style={{cursor:"pointer", color:G.muted,fontSize:12,display:"inline-block",transform:isOpen?"rotate(0deg)":"rotate(-90deg)",transition:"transform .2s"}}>▼</span>
                                    </div>
                                </div>
                                {isOpen && (
                                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                                        <thead>
                                            <tr>
                                                <th style={{...TH,width:36}}>{t.srNo}</th>
                                                <th style={TH}>{t.fields.buyer}</th>
                                                <th style={{...TH,textAlign:"right"}}>{t.fields.weight}</th>
                                                <th style={{...TH,textAlign:"right"}}>{t.fields.rate}</th>
                                                <th style={{...TH,textAlign:"right"}}>💵 {t.fields.amount}</th>
                                                <th style={{...TH,textAlign:"right"}}>{t.fields.paid}</th>
                                                <th style={{...TH,textAlign:"right"}}>{t.fields.remaining}</th>
                                                {canEdit && <th style={{...TH,width:80}}/>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fRows.map((r, ri) => (
                                                <tr key={r.id || ri} style={{background:ri%2===0?"transparent":"#FAFAFA", borderLeft:editId===r.id?`3px solid ${col}`:"none"}}>
                                                    <td style={{...TD,color:G.muted,fontSize:11}}>{ri+1}</td>
                                                    {editId === r.id ? (
                                                        <>
                                                            <td style={TD}>
                                                                <input style={{...inp, padding:"4px 8px", fontSize:12}} value={editVal.buyer} onChange={e=>setEV(p=>({...p, buyer:e.target.value}))} placeholder={t.fields.buyerPlaceholder}/>
                                                            </td>
                                                            <td style={TD}>
                                                                <input style={{...inp, padding:"4px 8px", fontSize:12, textAlign:"right"}} type="number" value={editVal.weight} onChange={e=>setEV(p=>({...p, weight:e.target.value}))}/>
                                                            </td>
                                                            <td style={TD}>
                                                                <input style={{...inp, padding:"4px 8px", fontSize:12, textAlign:"right"}} type="number" value={editVal.rate} onChange={e=>setEV(p=>({...p, rate:e.target.value}))}/>
                                                            </td>
                                                            <td style={{...TD, textAlign:"right", fontWeight:800, color:col}}>
                                                                {fmt(Math.round(Number(editVal.weight)*Number(editVal.rate)), t.fields.unitCurrency)}
                                                            </td>
                                                            <td style={TD}>
                                                                <input style={{...inp, padding:"4px 8px", fontSize:12, textAlign:"right"}} type="number" value={editVal.amountPaid} onChange={e=>setEV(p=>({...p, amountPaid: e.target.value as unknown as number}))}/>
                                                            </td>
                                                            <td style={{...TD, textAlign:"right", fontWeight:800, color: (Number(editVal.weight)*Number(editVal.rate) - Number(editVal.amountPaid)) > 0 ? G.coral400 : G.green}}>
                                                                { (Number(editVal.weight)*Number(editVal.rate) - Number(editVal.amountPaid)) > 0 ? fmt((Number(editVal.weight)*Number(editVal.rate) - Number(editVal.amountPaid)), t.fields.unitCurrency) : "✅"}
                                                            </td>
                                                            <td style={TD}>
                                                                <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                                                                    <button onClick={()=>saveEdit(r.id)} style={{background:G.green, border:"none", borderRadius:5, padding:"4px 8px", color:"#fff", cursor:"pointer", fontSize:10, fontWeight:800}}>{t.actions.saveShort}</button>
                                                                    <button onClick={()=>setEId(null)} style={{background:"#F3F4F6", border:"none", borderRadius:5, padding:"4px 8px", color:G.muted, cursor:"pointer", fontSize:10, fontWeight:800}}>{t.actions.escShort}</button>
                                                                </div>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td onClick={()=>startEdit(r)} style={{...TD,fontWeight:600, cursor:"pointer"}}>{r.buyerName||r.buyer||((r as unknown as Record<string, unknown>).buyer_name as string)||<span style={{color:G.muted,fontStyle:"italic"}}>—</span>}</td>
                                                            <td onClick={()=>startEdit(r)} style={{...TD,textAlign:"right", cursor:"pointer"}}>{r.weight}</td>
                                                            <td onClick={()=>startEdit(r)} style={{...TD,textAlign:"right", cursor:"pointer"}}>{r.rate}</td>
                                                            <td style={{...TD,textAlign:"right",fontWeight:700,color:G.green,fontVariantNumeric:"tabular-nums"}}>{fmt(Math.round(Number(r.weight)*Number(r.rate)), t.fields.unitCurrency)}</td>
                                                            <td style={{...TD,textAlign:"right",color:G.green,fontSize:12,fontVariantNumeric:"tabular-nums"}}>{fmt(Number(r.amountPaid || (r as unknown as Record<string, unknown>).amount_paid || 0), t.fields.unitCurrency)}</td>
                                                            <td style={{...TD,textAlign:"right",fontWeight:800,color:Number(r.balance) > 0 ? G.coral400 : G.green,fontVariantNumeric:"tabular-nums"}}>
                                                                {Number(r.balance) > 0 ? fmt(r.balance, t.fields.unitCurrency) : "✅"}
                                                            </td>
                                                            {canEdit && <td style={TD}>
                                                                <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                                                                    <button onClick={()=>startEdit(r)} style={{background:"none",border:"none",color:G.subtle,cursor:"pointer",fontSize:13,padding:"0 4px"}}>✎</button>
                                                                    <button onClick={()=>delRow(r.id.toString())} style={{background:"none",border:"none",color:G.red,cursor:"pointer",fontSize:14,padding:"0 4px"}}>✕</button>
                                                                </div>
                                                            </td>}
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                            <tr style={{background:`${col}0A`,borderTop:`1px solid ${col}30`}}>
                                                <td colSpan={2} style={{...TD,fontWeight:700,color:col,fontSize:11}}>{t.summary.subTotal} · {fRows.length} {t.summary.buyers}</td>
                                                <td style={{...TD,textAlign:"right",fontWeight:700,color:col}}>{fKg} {t.fields.unitKg}</td>
                                                <td style={{...TD,textAlign:"right",color:G.muted,fontSize:11}}>{t.fields.avg} {t.fields.unitCurrency}{fRows.length?Math.round(fTotal/fKg||0):0}</td>
                                                <td style={{...TD,textAlign:"right",fontWeight:900,color:col,fontSize:15,fontVariantNumeric:"tabular-nums"}}>{fmt(fTotal, t.fields.unitCurrency)}</td>
                                                <td style={TD}/>
                                                <td style={TD}/>
                                                {canEdit && <td style={TD}/>}
                                            </tr>
                                        </tbody>
                                    </table>
                                )}
                            </GCard>
                        )
                    })}
                </div>
            )}

            {/* Voice Cheatsheet */}
            {canEdit && (
                <GCard style={{padding:"16px 18px",marginBottom:14}}>
                    <div style={{background:"#F1F5F9",borderRadius:8,padding:"10px 14px",display:"grid",gridTemplateColumns:"22px 1fr",gap:"4px 10px",lineHeight:2,fontSize:12,border:`1px solid ${G.border}`}}>
                        {t.voice.examplesList.map((ex: { i: string; t: string }, i: number) => (
                            <React.Fragment key={i}>
                                <span>{ex.i}</span><span style={{color:G.subtle}}>{ex.t}</span>
                            </React.Fragment>
                        ))}
                        <span style={{color:G.accent}}>💬</span><span style={{color:G.accent,fontWeight:700,fontStyle:"italic"}}>{t.voice.example}</span>
                    </div>
                </GCard>
            )}

            {/* Expenses */}
            {canEdit && (
                <GCard style={{padding:"16px 18px",marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                        <div style={{fontWeight:800,fontSize:14,color:G.text}}>💸 {t.expenses.title}</div>
                        <VoiceInput lang={lang as 'ta' | 'en'} onParsedResult={onVoiceResult} />
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                        {EXP_KEYS.map(k=>(
                            <div key={k}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                                    <Label c={EXP_ICONS[k]+" "+t.expenses[k]} style={{marginBottom:0}}/>
                                    <VoiceInput lang={lang as 'ta' | 'en'} onParsedResult={(res: ParsedVoiceResult[]) => onVoiceResult(res.map(r => ({...r, key: k})))} targetField="amount" />
                                </div>
                                <input style={{...makeInp(), marginBottom: 5}} type="number" placeholder={t.fields.unitCurrency} value={rec.exp[k]} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>{
                                    const val = e.target.value;
                                    upd(r => ({...r, exp: {...r.exp, [k]: val}}));
                                }}/>
                                <input style={{...makeInp(), fontSize: 12, padding: "6px 10px"}} placeholder={t.expenses.note+"…"} value={rec.notes[k]||""} onChange={e=>{
                                    const val = e.target.value;
                                    upd(r => ({...r, notes: {...r.notes, [k]: val}}));
                                }}/>
                            </div>
                        ))}
                    </div>
                    <Divider style={{marginBottom:12}}/>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <Label c={"💼 "+t.expenses.commPct} style={{marginBottom:0}}/>
                        <input style={{...makeInp(),width:70}} type="number" value={rec.exp.comm} onChange={e=>{
                            const val = e.target.value;
                            upd(r => ({...r, exp: {...r.exp, comm: val}}));
                        }}/>
                        <span style={{fontSize:13,color:G.muted}}>% → <span style={{color:G.red,fontWeight:700}}>{fmt(commission, t.fields.unitCurrency)}</span></span>
                    </div>
                </GCard>
            )}

            {/* Payments */}
            <GCard style={{padding:"16px 18px",marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div style={{fontWeight:800,fontSize:14,color:G.text}}>💳 {t.payments.title}</div>
                    {totalPaid>0 && <Badge color={G.green}>{t.payments.totalPaid}: {fmt(totalPaid, t.fields.unitCurrency)}</Badge>}
                </div>
                {payments.length===0?(
                    <div style={{fontSize:12,color:G.muted,paddingBottom:8}}>{t.payments.noPayments}</div>
                ):(
                    <div style={{borderRadius:8,overflow:"hidden",border:`1px solid ${G.border}`,marginBottom:12}}>
                        {payments.map((p: Payment, i: number)=>(
                            <div key={p.id || i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",background:i%2===0?"transparent":"#FAFAFA",borderBottom:i<payments.length-1?`1px solid ${G.border}`:"none"}}>
                                <div>
                                    <span style={{fontWeight:700,color:G.green,fontVariantNumeric:"tabular-nums"}}>{fmt(p.amount || p.amt, t.fields.unitCurrency)}</span>
                                    {p.note && <span style={{color:G.muted,fontSize:12,marginLeft:8}}>· {p.note}</span>}
                                    <div style={{fontSize:10,color:G.muted,marginTop:2}}>{new Date(p.date || p.time || 0).toLocaleTimeString("en-IN")} {p.by ? `· ${t.payments.by} ${p.by}` : ""}</div>
                                </div>
                                {canEdit && (
                                    <button onClick={()=>delPayment(p.id.toString())} style={{background:"none",border:"none",color:G.red,cursor:"pointer",fontSize:15,padding:"0 6px",lineHeight:1}}>✕</button>
                                )}
                            </div>
                        ))}
                        <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",background:"#10B98110",borderTop:`1px solid ${G.green}30`}}>
                            <span style={{fontWeight:700,color:G.green,fontSize:13}}>{t.payments.totalPaid}</span>
                            <span style={{fontWeight:900,color:G.green,fontVariantNumeric:"tabular-nums"}}>{fmt(totalPaid, t.fields.unitCurrency)}</span>
                        </div>
                    </div>
                )}
                {canEdit && (
                    <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                        <div style={{flex:"0 0 130px"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                                <Label c={t.payments.amtPaid} style={{color: fieldErrors.amount ? G.red : G.muted, marginBottom:0}}/>
                                    <VoiceInput lang={lang as 'ta' | 'en'} onParsedResult={(res: ParsedVoiceResult[]) => {
                                        if(res[0]?.type === 'EXPENSE' || res[0]?.type === 'SALE') {
                                            setPayAmt(String(res[0].amount || res[0].weight || ""));
                                        }
                                    }} />
                            </div>
                            <input style={{...makeInp(),fontWeight:700, borderColor: fieldErrors.amount ? G.red : G.text}} type="number" placeholder={t.fields.unitCurrency} value={payAmt}
                                onChange={e=>setPayAmt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPayment()}/>
                        </div>
                        <div style={{flex:1}}><Label c={t.payments.noteLbl}/>
                            <input style={makeInp()} placeholder={t.payments.notePlaceholder} value={payNote}
                                onChange={e=>setPayNote(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPayment()}/>
                        </div>
                        <button onClick={addPayment} style={{background:payAmt&&+payAmt>0?G.green:"#F3F4F6",border:"none",borderRadius:8,padding:"9px 14px",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:13,height:39,fontFamily:"inherit",whiteSpace:"nowrap"}}>
                            ✓ Add
                        </button>
                    </div>
                )}
            </GCard>

            {/* Settlement summary */}
            <GCard style={{padding:"18px 20px",marginBottom:14,border:`1px solid ${settled?G.green+"40":G.accent+"30"}`}}>
                {[
                    {lbl:t.summary.totalSales, val:fmt(actualTotalSales), col:G.text, big:true},
                    {lbl:`${t.summary.commission} (${commRate}%)`, val:"– "+fmt(commission), col:G.red},
                    ...EXP_KEYS.filter(k=>expAmts[k]>0).map(k=>({lbl:EXP_ICONS[k]+" "+t.expenses[k]+(rec.notes[k]?" · "+rec.notes[k]:""), val:"– "+fmt(expAmts[k]), col:G.red})),
                    {lbl:t.summary.totalDed, val:"– "+fmt(actualTotalDed), col:G.red, div:true},
                    {lbl:t.summary.netPayable, val:fmt(actualNetPay), col:G.green, big:true},
                    ...(totalPaid>0?[
                        {lbl:t.summary.paid, val:"– "+fmt(totalPaid), col:G.blue, div:true},
                        {lbl:t.summary.remaining, val:fmt(Math.max(0,remaining)), col:settled?G.green:G.amber, big:true, badge:settled},
                    ]:[]),
                ].map((row,i)=>(
                    <div key={i}>
                        {row.div&&<Divider style={{margin:"6px 0"}}/>}
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:`${row.big?"9":"5"}px 0`}}>
                            <span style={{fontSize:row.big?14:12,color:row.big?G.text:G.muted,fontWeight:row.big?700:400,display:"flex",alignItems:"center",gap:8}}>
                                {row.lbl}
                                {row.badge&&<Badge color={G.green} style={{fontSize:10}}>✅ {t.summary.settled}</Badge>}
                            </span>
                            <span style={{fontSize:row.big?20:14,fontWeight:row.big?900:600,color:row.col,fontVariantNumeric:"tabular-nums"}}>{row.val}</span>
                        </div>
                    </div>
                ))}
            </GCard>

            {/* Action bar */}
            <div style={{display:"flex",gap:10}}>
                {canEdit && (
                    <button onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2200);}}
                        style={{flex:2,background:saved?G.green:G.accent,border:"none",borderRadius:10,padding:"13px 0",color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"inherit",transition:"background .3s"}}>
                        {saved?"✅ Saved!":"💾 "+t.actions.save}
                    </button>
                )}
                <button onClick={()=>setTab("slip")} style={{flex:1,background:"#F3F4F6",border:`1px solid ${G.border}`,borderRadius:10,padding:"13px 0",color:G.text,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
                    📄 {t.tabs.slip}
                </button>
                <button onClick={()=>window.print()} style={{flex:1,background:"#F3F4F6",border:`1px solid ${G.border}`,borderRadius:10,padding:"13px 0",color:G.text,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
                    🖨 {t.actions.print}
                </button>
            </div>
        </div>
    );
}
