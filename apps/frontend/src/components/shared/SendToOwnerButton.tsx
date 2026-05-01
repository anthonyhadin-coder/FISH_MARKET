import { useState } from 'react';
import { Send, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@fishmarket/shared-types';

// ── Types ─────────────────────────────────────────────────────────
type SendStatus = 'idle' | 'loading' | 'sent' | 'error';

interface Props {
  boatId      : number;
  boatName    : string;
  reportDate  : string; // YYYY-MM-DD
  onSuccess?  : (reportId: number, totalAmount: number) => void;
  lang?       : 'en' | 'ta';
}

// ── Bilingual labels ──────────────────────────────────────────────
const labels = {
  en: {
    idle   : 'Send to Owner',
    loading: 'Sending...',
    sent   : 'Sent to Owner ✅',
    error  : 'Retry Send',
    confirmTitle: 'Send Report?',
    confirmBody : (boat: string, date: string) =>
      `Send today's catch report for ${boat} (${date}) to the owner?`,
    cancel  : 'Cancel',
    confirm : 'Yes, Send',
    successMsg: (owner: string, amt: number) =>
      `Report sent to ${owner}! Total: ₹${amt.toLocaleString('en-IN')}`,
    noSales : 'No sales entries for this boat today.',
    failed  : 'Failed to send. Please try again.',
  },
  ta: {
    idle   : 'உரிமையாளருக்கு அனுப்பு',
    loading: 'அனுப்புகிறது...',
    sent   : 'அனுப்பப்பட்டது ✅',
    error  : 'மீண்டும் முயற்சி',
    confirmTitle: 'அறிக்கை அனுப்பவா?',
    confirmBody : (boat: string, date: string) =>
      `${boat} (${date}) இன் இன்றைய மீன் பிடிப்பு அறிக்கை உரிமையாளருக்கு அனுப்பவா?`,
    cancel  : 'ரத்துசெய்',
    confirm : 'ஆம், அனுப்பு',
    successMsg: (owner: string, amt: number) =>
      `${owner}-க்கு அறிக்கை அனுப்பப்பட்டது! மொத்தம்: ₹${amt.toLocaleString('en-IN')}`,
    noSales : 'இன்று இந்த படகிற்கு விற்பனை இல்லை.',
    failed  : 'அனுப்ப முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
  },
};

// ── Component ─────────────────────────────────────────────────────
export function SendToOwnerButton({ boatId, boatName, reportDate, onSuccess, lang = 'en' }: Props) {
  const [status, setStatus]       = useState<SendStatus>('idle');
  const [showConfirm, setConfirm] = useState(false);
  const { toast }                 = useToast();
  const t                         = labels[lang];

  const handleConfirm = async () => {
    setConfirm(false);
    setStatus('loading');

    try {
      const res = await api.post('/reports/send-to-owner', {
        boat_id    : boatId,
        report_date: reportDate,
      });

      setStatus('sent');
      toast(t.successMsg(res.data.owner_name, res.data.total_amount), 'success');
      onSuccess?.(res.data.report_id, res.data.total_amount);

    } catch (err: unknown) {
      const error = err as ApiError;
      setStatus('error');
      const msg = error.response?.data?.message || t.failed;
      toast(msg, 'error');
      // Auto-reset after 4 seconds so they can retry
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  // ── Button style logic ─────────────────────────────────────────
  const btnBase = 'w-full flex items-center justify-center gap-2.5 rounded-xl font-semibold text-sm transition-all duration-200 min-h-[52px] px-6 select-none';
  const btnStyle =
    status === 'sent'    ? `${btnBase} bg-emerald-600 text-white cursor-default opacity-90` :
    status === 'error'   ? `${btnBase} bg-red-600 hover:bg-red-500 active:scale-[0.99] text-white cursor-pointer` :
    status === 'loading' ? `${btnBase} bg-teal-700 text-white cursor-wait opacity-80` :
                           `${btnBase} bg-teal-500 hover:bg-teal-400 active:scale-[0.99] hover:shadow-lg hover:shadow-teal-500/25 text-white cursor-pointer`;

  return (
    <>
      {/* ── Main Button ──────────────────────────────────────── */}
      <button
        id={`send-to-owner-btn-${boatId}`}
        onClick={() => {
          if (status === 'loading' || status === 'sent') return;
          setConfirm(true);
        }}
        disabled={status === 'loading' || status === 'sent'}
        aria-label={t[status]}
        className={btnStyle}
      >
        {status === 'loading' ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> {t.loading}</>
        ) : status === 'sent' ? (
          <><CheckCircle2 className="w-4 h-4" /> {t.sent}</>
        ) : status === 'error' ? (
          <><RotateCcw className="w-4 h-4" /> {t.error}</>
        ) : (
          <><Send className="w-4 h-4" /> {t.idle}</>
        )}
      </button>

      {/* ── Confirmation modal overlay ─────────────────────── */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="send-confirm-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirm(false)}
          />

          {/* Dialog card */}
          <div className="relative w-full max-w-sm rounded-2xl p-6 space-y-4 shadow-2xl"
            style={{ background: 'var(--glass-bg, #071428)', border: '1px solid rgba(6,182,212,0.2)' }}>
            <h3 id="send-confirm-title" className="text-base font-black text-white">
              {t.confirmTitle}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              {t.confirmBody(boatName, reportDate)}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-white/8 hover:bg-white/12 text-slate-300 font-semibold text-sm border border-white/10 hover:border-white/20 transition-all"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-bold text-sm transition-all"
              >
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
