"use client";
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useVoiceNoteRecorder } from '../../hooks/useVoiceNoteRecorder';
import { ParsedVoiceResult } from '@/lib/voice/voiceParser';

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const fmtCurrency = (n: number) =>
  `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const fmtTime = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface VoiceNoteRecorderProps {
  lang: 'ta' | 'en';
  fishList?: string[];
  buyerList?: string[];
  /** Called when agent confirms the parsed rows — bulk-insert + navigate to slip */
  onConfirm: (results: ParsedVoiceResult[], transcript: string) => void;
  disabled?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────

/** Waveform canvas drawn with scrolling bars */
const WaveformCanvas: React.FC<{
  dbLevel: number;
  isRecording: boolean;
  isPaused: boolean;
}> = ({ dbLevel, isRecording, isPaused }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsRef   = useRef<number[]>(Array(28).fill(3));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const draw = () => {
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);

      const N     = barsRef.current.length;
      const barW  = w / N - 1.5;

      // Scroll animation — push a new bar value each frame
      if (isRecording && !isPaused) {
        const newH = Math.max(4, (dbLevel / 80) * h * (0.55 + Math.random() * 0.45));
        barsRef.current = [...barsRef.current.slice(1), newH];
      }

      barsRef.current.forEach((barH, i) => {
        const alpha = isRecording && !isPaused
          ? 0.3 + (i / N) * 0.7
          : isPaused
          ? 0.25
          : 0.15 + (i / N) * 0.25;

        ctx.fillStyle = isPaused
          ? `rgba(251,191,36,${alpha})`
          : isRecording
          ? `rgba(239,68,68,${alpha})`
          : `rgba(14,165,233,${alpha})`;

        const x = i * (barW + 1.5);
        const y = (h - barH) / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 2);
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [dbLevel, isRecording, isPaused]);

  return (
    <canvas
      ref={canvasRef}
      width={560}
      height={52}
      style={{ width: '100%', height: 52, display: 'block', marginBottom: 16 }}
    />
  );
};

/** Preview table of parsed sales before confirming */
const PreviewPanel: React.FC<{
  results: ParsedVoiceResult[];
  transcript: string;
  lang: 'ta' | 'en';
  onConfirm: () => void;
  onReRecord: () => void;
}> = ({ results, transcript, lang, onConfirm, onReRecord }) => {
  const sales = results.filter(r => r.type === 'SALE');
  const canConfirm = sales.length > 0;

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Section label */}
      <div style={{
        fontSize: 11, fontWeight: 800, color: '#64748B',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span>{lang === 'ta' ? 'கண்டறியப்பட்ட உள்ளீடுகள்' : 'Detected Entries'}</span>
        <span style={{
          background: canConfirm ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
          color: canConfirm ? '#34D399' : '#F87171',
          padding: '1px 8px',
          borderRadius: 20,
          fontSize: 10,
          fontWeight: 900,
        }}>
          {sales.length}
        </span>
      </div>

      {/* Table */}
      {sales.length > 0 ? (
        <div style={{
          border: '1px solid rgba(14,165,233,0.2)',
          borderRadius: 14,
          overflow: 'hidden',
          marginBottom: 12,
        }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2.5fr 1fr 1fr 1.2fr 50px',
            padding: '8px 14px',
            background: 'rgba(14,165,233,0.08)',
            borderBottom: '1px solid rgba(14,165,233,0.15)',
            gap: 8,
          }}>
            {[
              lang === 'ta' ? 'மீன்' : 'Fish',
              lang === 'ta' ? 'எடை' : 'Weight',
              lang === 'ta' ? 'விலை' : 'Rate',
              lang === 'ta' ? 'மொத்தம்' : 'Total',
              '%',
            ].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                {h}
              </span>
            ))}
          </div>

          {/* Data rows */}
          {sales.map((r, i) => {
            const total = (r.weight ?? 0) * (r.rate ?? 0);
            const conf  = r.confidence?.total ?? 0;
            const confColor = conf >= 80 ? '#34D399' : conf >= 60 ? '#FBBF24' : '#F87171';
            return (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2.5fr 1fr 1fr 1.2fr 50px',
                  padding: '10px 14px',
                  gap: 8,
                  borderBottom: i < sales.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: '#F0F9FF' }}>
                  🐟 {r.fish || <span style={{ color: '#F87171' }}>—</span>}
                  {r.buyer && (
                    <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 6, fontWeight: 400 }}>
                      → {r.buyer}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 13, color: '#CBD5E1', fontVariantNumeric: 'tabular-nums' }}>
                  {r.weight != null ? `${r.weight} kg` : <span style={{ color: '#F87171' }}>—</span>}
                </span>
                <span style={{ fontSize: 13, color: '#CBD5E1', fontVariantNumeric: 'tabular-nums' }}>
                  {r.rate != null ? `₹${r.rate}` : <span style={{ color: '#F87171' }}>—</span>}
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#34D399', fontVariantNumeric: 'tabular-nums' }}>
                  {total > 0 ? fmtCurrency(total) : '—'}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 800,
                  color: confColor,
                  background: `${confColor}18`,
                  padding: '2px 6px',
                  borderRadius: 6,
                  textAlign: 'center',
                }}>
                  {conf}%
                </span>
              </div>
            );
          })}

          {/* Total footer */}
          {sales.length > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'rgba(52,211,153,0.06)',
              borderTop: '1px solid rgba(52,211,153,0.15)',
            }}>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 700 }}>
                {sales.length} {lang === 'ta' ? 'பதிவுகள் மொத்தம்' : 'entries total'}
              </span>
              <span style={{ fontSize: 14, fontWeight: 900, color: '#34D399', fontVariantNumeric: 'tabular-nums' }}>
                {fmtCurrency(sales.reduce((s, r) => s + ((r.weight ?? 0) * (r.rate ?? 0)), 0))}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          background: 'rgba(248,113,113,0.08)',
          border: '1px solid rgba(248,113,113,0.2)',
          borderRadius: 12,
          padding: '14px 16px',
          fontSize: 13,
          color: '#FCA5A5',
          marginBottom: 12,
        }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            ⚠️ {lang === 'ta'
              ? 'எந்த விற்பனையும் கண்டறியப்படவில்லை.'
              : 'No sales detected.'}
          </div>
          {/* BUG-021 FIX: Explicit guidance on how to speak the format */}
          <div style={{ fontSize: 12, color: '#F87171', lineHeight: 1.5 }}>
            {lang === 'ta' 
              ? 'தயவுசெய்து மீண்டும் பதிவு செய்யவும். உதாரணம்: "10 கிலோ சீலா 500 ரூபாய்"' 
              : 'Please re-record. Example: "10 kg seela 500 rupees"'}
          </div>
        </div>
      )}

      {/* Transcript */}
      <div style={{
        fontSize: 12,
        color: '#475569',
        fontStyle: 'italic',
        lineHeight: 1.6,
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.05)',
        marginBottom: 14,
        wordBreak: 'break-word',
      }}>
        &quot;{transcript}&quot;
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          id="voice-note-confirm-btn"
          onClick={onConfirm}
          disabled={!canConfirm}
          style={{
            flex: 2,
            background: canConfirm
              ? 'linear-gradient(135deg, #059669, #047857)'
              : '#1E293B',
            border: 'none',
            borderRadius: 12,
            padding: '13px 0',
            color: canConfirm ? '#fff' : '#475569',
            fontWeight: 800,
            fontSize: 14,
            cursor: canConfirm ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: canConfirm ? '0 4px 20px rgba(5,150,105,0.3)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          ✅ {lang === 'ta' ? 'உறுதிப்படுத்து & சீட்டு உருவாக்கு' : 'Confirm & Generate Slip'}
        </button>
        <button
          id="voice-note-rerecord-btn"
          onClick={onReRecord}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: '13px 0',
            color: '#94A3B8',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}
        >
          🔄 {lang === 'ta' ? 'மீண்டும் பதிவு செய்' : 'Re-record'}
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────

export const VoiceNoteRecorder: React.FC<VoiceNoteRecorderProps> = ({
  lang,
  fishList,
  buyerList,
  onConfirm,
  disabled = false,
}) => {
  const [error,   setError]   = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    results: ParsedVoiceResult[];
    transcript: string;
  } | null>(null);

  const {
    isRecording, isPaused, isProcessing,
    elapsedSeconds, dbLevel,
    startRecording, pauseRecording, resumeRecording, stopRecording,
  } = useVoiceNoteRecorder({
    lang, fishList, buyerList,
    onResult: useCallback((results: ParsedVoiceResult[], transcript: string) => {
      setPreview({ results, transcript });
      setError(null);
    }, []),
    onError: useCallback((err: string) => {
      setError(err);
      setPreview(null);
    }, []),
  });

  const isActive = isRecording || isPaused;
  const isIdle   = !isActive && !isProcessing && !preview;

  const handleConfirm = () => {
    if (!preview) return;
    onConfirm(preview.results, preview.transcript);
    setPreview(null);
    setError(null);
  };

  const handleReRecord = () => {
    setPreview(null);
    setError(null);
  };

  // Outer glow based on state
  const cardGlow = isRecording && !isPaused
    ? '0 0 40px rgba(239,68,68,0.18), 0 8px 32px rgba(0,0,0,0.35)'
    : isPaused
    ? '0 0 30px rgba(251,191,36,0.15), 0 8px 32px rgba(0,0,0,0.35)'
    : preview
    ? '0 0 30px rgba(52,211,153,0.12), 0 8px 32px rgba(0,0,0,0.35)'
    : '0 8px 32px rgba(0,0,0,0.3)';

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
      borderRadius: 20,
      padding: '20px 22px',
      border: `1px solid ${isRecording && !isPaused ? 'rgba(239,68,68,0.3)' : isPaused ? 'rgba(251,191,36,0.3)' : preview ? 'rgba(52,211,153,0.2)' : 'rgba(14,165,233,0.2)'}`,
      boxShadow: cardGlow,
      transition: 'box-shadow 0.5s ease, border-color 0.4s ease',
      marginBottom: 16,
    }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Status dot */}
          <div style={{
            width: 9, height: 9, borderRadius: '50%',
            background: isRecording && !isPaused ? '#EF4444' : isPaused ? '#FBBF24' : preview ? '#34D399' : '#0EA5E9',
            boxShadow: `0 0 8px ${isRecording && !isPaused ? '#EF4444' : isPaused ? '#FBBF24' : preview ? '#34D399' : '#0EA5E9'}`,
            animation: isRecording && !isPaused ? 'vnPulse 1s infinite' : 'none',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {lang === 'ta' ? 'AI குரல் குறிப்பு பதிவாளர்' : 'AI Voice Note Recorder'}
          </span>
        </div>

        {/* Elapsed timer */}
        {isActive && (
          <div style={{
            fontFamily: '"SF Mono", "Fira Code", monospace',
            fontSize: 20,
            fontWeight: 900,
            color: isPaused ? '#FBBF24' : '#EF4444',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            {isPaused && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#FBBF24', background: 'rgba(251,191,36,0.12)', padding: '2px 8px', borderRadius: 6, letterSpacing: 0 }}>
                PAUSED
              </span>
            )}
            {fmtTime(elapsedSeconds)}
            {/* BUG-013 FIX: Display max duration */}
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 700, letterSpacing: 0 }}>/ 10:00</span>
          </div>
        )}
      </div>

      {/* ── Waveform ─────────────────────────────────────────── */}
      <WaveformCanvas dbLevel={dbLevel} isRecording={isRecording} isPaused={isPaused} />

      {/* ── Error ────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 10,
          padding: '10px 14px',
          fontSize: 13,
          color: '#FCA5A5',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          ⚠️ {error}
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}
          >×</button>
        </div>
      )}

      {/* ── Processing spinner ────────────────────────────────── */}
      {isProcessing && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 16px',
          background: 'rgba(14,165,233,0.08)',
          border: '1px solid rgba(14,165,233,0.2)',
          borderRadius: 12,
          marginBottom: 14,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            border: '2.5px solid rgba(14,165,233,0.2)',
            borderTopColor: '#0EA5E9',
            animation: 'vnSpin 0.75s linear infinite',
            flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: 13, color: '#7DD3FC', fontWeight: 700 }}>
              {lang === 'ta' ? 'AI குரலை பகுப்பாய்கிறது…' : 'AI is transcribing your voice note…'}
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
              {lang === 'ta' ? 'இது 30 வினாடி வரை எடுக்கலாம்' : 'This may take up to 30 seconds'}
            </div>
          </div>
        </div>
      )}

      {/* ── Preview panel ─────────────────────────────────────── */}
      {preview && !isProcessing && (
        <PreviewPanel
          results={preview.results}
          transcript={preview.transcript}
          lang={lang}
          onConfirm={handleConfirm}
          onReRecord={handleReRecord}
        />
      )}

      {/* ── Control buttons ───────────────────────────────────── */}
      {!preview && !isProcessing && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>

          {/* Primary button: Record ↔ Stop */}
          <button
            id="voice-note-record-btn"
            onClick={isActive ? stopRecording : startRecording}
            disabled={disabled}
            aria-label={isActive
              ? (lang === 'ta' ? 'நிறுத்து மற்றும் செயலாக்கு' : 'Stop and process voice note')
              : (lang === 'ta' ? 'குரல் குறிப்பு பதிவு தொடங்கு' : 'Start recording voice note')}
            style={{
              flex: 1,
              height: 54,
              borderRadius: 14,
              border: 'none',
              background: isActive
                ? 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)'
                : 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
              color: '#fff',
              fontWeight: 800,
              fontSize: 15,
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              fontFamily: 'inherit',
              boxShadow: isRecording && !isPaused
                ? '0 0 28px rgba(220,38,38,0.45)'
                : isActive
                ? '0 4px 16px rgba(220,38,38,0.25)'
                : '0 4px 20px rgba(14,165,233,0.35)',
              animation: isRecording && !isPaused ? 'vnRecordPulse 1.8s ease-in-out infinite' : 'none',
              transition: 'background 0.3s, box-shadow 0.3s, opacity 0.2s',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <span style={{ fontSize: 22 }}>{isActive ? '⏹' : '🎙'}</span>
            {isActive
              ? (lang === 'ta' ? 'நிறுத்து & பதிவாக்கு' : 'Stop & Process')
              : (lang === 'ta' ? 'குரல் குறிப்பு பதிவு செய்' : 'Record Voice Note')}
          </button>

          {/* Pause / Resume — only shown while active */}
          {isActive && (
            <button
              id="voice-note-pause-btn"
              onClick={isPaused ? resumeRecording : pauseRecording}
              aria-label={isPaused
                ? (lang === 'ta' ? 'பதிவை தொடரவும்' : 'Resume recording')
                : (lang === 'ta' ? 'பதிவை இடைநிறுத்தவும்' : 'Pause recording')}
              title={isPaused
                ? (lang === 'ta' ? 'தொடரவும்' : 'Resume')
                : (lang === 'ta' ? 'இடைநிறுத்து' : 'Pause')}
              style={{
                width: 54,
                height: 54,
                borderRadius: 14,
                border: `1px solid ${isPaused ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.1)'}`,
                background: isPaused
                  ? 'linear-gradient(135deg, #D97706, #92400E)'
                  : 'rgba(255,255,255,0.06)',
                color: '#fff',
                fontWeight: 900,
                fontSize: 22,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'inherit',
                flexShrink: 0,
                boxShadow: isPaused ? '0 0 16px rgba(217,119,6,0.45)' : 'none',
                transition: 'all 0.25s',
              }}
            >
              {isPaused ? '▶' : '⏸'}
            </button>
          )}
        </div>
      )}

      {/* ── Idle hint ─────────────────────────────────────────── */}
      {isIdle && !error && (
        <div style={{
          marginTop: 14,
          fontSize: 12,
          color: '#334155',
          textAlign: 'center',
          lineHeight: 1.7,
        }}>
          <span style={{ color: '#0EA5E9' }}>●</span>{' '}
          {lang === 'ta'
            ? 'ஒரு படகின் அனைத்து மீன் விற்பனையையும் ஒரே குரல் குறிப்பில் பதிவு செய்யுங்கள் — சீட்டு தானாக உருவாகும்'
            : 'Record the entire boat\'s fish sales in one go — slip is auto-generated on confirm'}
        </div>
      )}

      {/* ── Keyframe animations ───────────────────────────────── */}
      <style>{`
        @keyframes vnPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
        @keyframes vnRecordPulse {
          0%, 100% { box-shadow: 0 0 28px rgba(220,38,38,0.45); }
          50%       { box-shadow: 0 0 48px rgba(220,38,38,0.7), 0 0 70px rgba(220,38,38,0.25); }
        }
        @keyframes vnSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
