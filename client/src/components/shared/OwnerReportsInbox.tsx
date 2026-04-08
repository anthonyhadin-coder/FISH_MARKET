import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Ship, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

// ── Types ─────────────────────────────────────────────────────────
interface ReportItem {
  fish_name : string;
  weight    : number;
  rate      : number;
  total     : number;
}

interface Report {
  id           : number;
  boat_name    : string;
  agent_name   : string;
  report_date  : string;
  sent_at      : string;
  total_weight : number;
  total_amount : number;
  status       : 'pending' | 'approved' | 'rejected';
  reject_reason: string | null;
  items        : ReportItem[];
}

interface Props {
  lang?: 'en' | 'ta';
}

// ── Bilingual labels ──────────────────────────────────────────────
const T = {
  en: {
    title       : 'Boat Reports Inbox',
    pending     : 'Pending',
    approved    : 'Approved',
    rejected    : 'Rejected',
    all         : 'All',
    noReports   : 'No reports in this category.',
    approve     : 'Approve ✅',
    reject      : 'Reject ❌',
    confirmReject: 'Confirm Reject',
    reasonPlaceholder: 'Reason for rejection…',
    boat        : 'Boat',
    agent       : 'Agent',
    date        : 'Date',
    amount      : 'Amount',
    weight      : 'Weight (kg)',
    fishName    : 'Fish',
    rate        : 'Rate (₹/kg)',
    total       : 'Total (₹)',
    sentAt      : 'Received',
    approvedMsg : 'Report approved successfully.',
    rejectedMsg : 'Report rejected.',
    failMsg     : 'Action failed. Please try again.',
    items       : 'Catch Items',
    rejectedNote: 'Rejection reason',
  },
  ta: {
    title       : 'படகு அறிக்கை உள்வரவு',
    pending     : 'நிலுவையில்',
    approved    : 'அனுமதிக்கப்பட்டது',
    rejected    : 'நிராகரிக்கப்பட்டது',
    all         : 'அனைத்தும்',
    noReports   : 'இந்த வகையில் அறிக்கைகள் இல்லை.',
    approve     : 'அனுமதி ✅',
    reject      : 'நிராகரி ❌',
    confirmReject: 'நிராகரணம் உறுதி',
    reasonPlaceholder: 'நிராகரண காரணம்…',
    boat        : 'படகு',
    agent       : 'முகவர்',
    date        : 'தேதி',
    amount      : 'தொகை',
    weight      : 'எடை (கிகி)',
    fishName    : 'மீன்',
    rate        : 'விலை (₹/கிகி)',
    total       : 'மொத்தம் (₹)',
    sentAt      : 'பெறப்பட்டது',
    approvedMsg : 'அறிக்கை வெற்றிகரமாக அனுமதிக்கப்பட்டது.',
    rejectedMsg : 'அறிக்கை நிராகரிக்கப்பட்டது.',
    failMsg     : 'செயல் தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.',
    items       : 'மீன் பிடிப்பு விவரம்',
    rejectedNote: 'நிராகரண காரணம்',
  },
};

const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

// ── Single Report Card ────────────────────────────────────────────
function ReportCard({ report, t, onAction }: {
  report  : Report;
  t       : typeof T.en;
  onAction: (id: number, action: 'approved' | 'rejected') => void;
}) {
  const [expanded, setExpanded]     = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason]         = useState('');
  const [acting, setActing]         = useState(false);
  const { toast }                   = useToast();

  const statusColor =
    report.status === 'approved' ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' :
    report.status === 'rejected' ? 'text-red-400 border-red-400/30 bg-red-400/10' :
                                   'text-yellow-400 border-yellow-400/30 bg-yellow-400/10';

  const handleApprove = async () => {
    setActing(true);
    try {
      await api.patch(`/reports/${report.id}/approve`);
      toast(t.approvedMsg, 'success');
      onAction(report.id, 'approved');
    } catch {
      toast(t.failMsg, 'error');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!reason.trim()) return;
    setActing(true);
    try {
      await api.patch(`/reports/${report.id}/reject`, { reason });
      toast(t.rejectedMsg, 'success');
      onAction(report.id, 'rejected');
    } catch {
      toast(t.failMsg, 'error');
    } finally {
      setActing(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(7,20,40,0.7)', border: '1px solid rgba(6,182,212,0.12)' }}
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between p-5 cursor-pointer gap-4"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}>
            <Ship className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <p className="font-black text-white text-sm truncate">{report.boat_name}</p>
            <p className="text-xs text-slate-400 font-medium">{t.agent}: {report.agent_name}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="font-black text-white text-sm">{fmt(report.total_amount)}</p>
            <p className="text-[11px] text-slate-500">{report.report_date}</p>
          </div>
          <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusColor}`}>
            {t[report.status as keyof typeof t]}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* ── Expanded Content ───────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">

              {/* Meta row */}
              <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {t.sentAt}: {new Date(report.sent_at).toLocaleString()}
                </span>
                <span>{t.weight}: <strong className="text-white">{report.total_weight} kg</strong></span>
                <span>{t.amount}: <strong className="text-cyan-400">{fmt(report.total_amount)}</strong></span>
              </div>

              {/* Catch Items Table */}
              {report.items?.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{t.items}</p>
                  <div className="rounded-xl overflow-hidden border border-white/5">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <th className="text-left px-4 py-2.5 text-slate-400 font-black uppercase tracking-wider">{t.fishName}</th>
                          <th className="text-right px-4 py-2.5 text-slate-400 font-black uppercase tracking-wider">{t.weight}</th>
                          <th className="text-right px-4 py-2.5 text-slate-400 font-black uppercase tracking-wider">{t.rate}</th>
                          <th className="text-right px-4 py-2.5 text-slate-400 font-black uppercase tracking-wider">{t.total}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {report.items.map((item, i) => (
                          <tr key={i} className="hover:bg-white/3 transition-colors">
                            <td className="px-4 py-3 text-white font-semibold">🐟 {item.fish_name}</td>
                            <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{item.weight}</td>
                            <td className="px-4 py-3 text-right text-slate-300 tabular-nums">₹{item.rate}</td>
                            <td className="px-4 py-3 text-right text-emerald-400 font-black tabular-nums">{fmt(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Rejection reason (if rejected) */}
              {report.status === 'rejected' && report.reject_reason && (
                <div className="rounded-xl p-3.5 text-sm" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)' }}>
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-wider mb-1">{t.rejectedNote}</p>
                  <p className="text-slate-300">{report.reject_reason}</p>
                </div>
              )}

              {/* Approve / Reject actions — only for pending */}
              {report.status === 'pending' && (
                <div className="space-y-3">
                  {showReject && (
                    <textarea
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder={t.reasonPlaceholder}
                      rows={2}
                      className="w-full rounded-xl p-3 text-sm text-white resize-none"
                      style={{ background: 'rgba(10,37,64,0.6)', border: '1px solid rgba(6,182,212,0.15)' }}
                    />
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={handleApprove}
                      disabled={acting}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-sm transition-all disabled:opacity-50"
                    >
                      {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {t.approve}
                    </button>
                    <button
                      onClick={() => showReject ? handleReject() : setShowReject(true)}
                      disabled={acting}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-700 hover:bg-red-600 active:scale-[0.99] text-white font-bold text-sm transition-all disabled:opacity-50"
                    >
                      {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      {showReject ? t.confirmReject : t.reject}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Tab Component ────────────────────────────────────────────
export function OwnerReportsInbox({ lang = 'en' }: Props) {
  const t = T[lang];
  const [statusFilter, setFilter]   = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [reports, setReports]       = useState<Report[]>([]);
  const [loading, setLoading]       = useState(true);
  const { toast }                   = useToast();

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/owner-inbox', { params: { status: statusFilter } });
      setReports(res.data.reports);
    } catch {
      toast(t.failMsg, 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast, t.failMsg]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleAction = (id: number, _action: 'approved' | 'rejected') => {
    // Remove the acted-on report from the current filter view
    setReports(prev => prev.filter(r => r.id !== id));
  };

  const tabs: Array<'pending' | 'approved' | 'rejected'> = ['pending', 'approved', 'rejected'];

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white">{t.title}</h2>
        <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
          🐟 {reports.length} {t[statusFilter]}
        </span>
      </div>

      {/* ── Filter tabs ────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {tabs.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${
              statusFilter === s
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t[s]}
          </button>
        ))}
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-slate-500 font-semibold text-sm">
          <Ship className="w-12 h-12 mx-auto mb-4 opacity-20" />
          {t.noReports}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {reports.map(r => (
              <ReportCard key={r.id} report={r} t={t} onAction={handleAction} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
