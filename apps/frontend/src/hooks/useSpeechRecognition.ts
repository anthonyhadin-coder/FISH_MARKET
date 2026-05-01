import { useState, useEffect, useRef, useCallback } from 'react';
import { parseVoiceInput, scoreConfidence, ConfidenceBreakdown, ParsedVoiceResult } from '../lib/voice/voiceParser';
import api from '../lib/api';

/**
 * useSpeechRecognition Hook — Enhanced
 * • Checks ALL speech alternatives (not just index 0)
 * • Routes by confidence: auto_fill / confirm / manual → Whisper
 * • Language auto-retry: Tamil fails → English → Whisper
 * • Noise gate: blocks processing when background is too loud
 */

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface BestResult {
  transcript: string;
  parsed:     ParsedVoiceResult[];
  confidence: ConfidenceBreakdown;
}

interface SpeechRecognitionOptions {
  lang:        'ta' | 'en';
  onResult:    (results: ParsedVoiceResult[]) => void;
  onError:     (error: string) => void;
  onConfidence?: (score: ConfidenceBreakdown) => void;
  onPreview?:    (result: BestResult) => void;  // 60-79% → show preview
  onNoiseGate?:  (level: number) => void;
  fishList?:   string[];
  buyerList?:  string[];
}

// ─────────────────────────────────────────────────────────────────
// TYPES FOR SPEECH RECOGNITION (Global)
// ─────────────────────────────────────────────────────────────────
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      length: number;
      [index: number]: {
        transcript: string;
        confidence: number;
      };
    };
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((err: SpeechRecognitionErrorEvent) => void) | null;
}

export const useSpeechRecognition = (options: SpeechRecognitionOptions) => {
  const [isListening,       setIsListening]       = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [dbLevel,           setDbLevel]           = useState(0);
  const [isTooNoisy,        setIsTooNoisy]        = useState(false);

  const recognitionRef   = useRef<SpeechRecognitionInstance | null>(null);
  const audioContextRef  = useRef<AudioContext | null>(null);
  const streamRef        = useRef<MediaStream | null>(null);
  const audioBlobRef     = useRef<Blob | null>(null);
  const mediaRecRef      = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<BlobPart[]>([]);
  const silenceTimerRef  = useRef<NodeJS.Timeout | null>(null);
  const sessionTimerRef  = useRef<NodeJS.Timeout | null>(null);
  const currentLangRef   = useRef<string>(options.lang === 'ta' ? 'ta-IN' : 'en-IN');
  const clearNoiseRef    = useRef<(() => void) | null>(null);
  const isListeningRef   = useRef(false);
  const lastNoiseToastRef = useRef<number>(0);

  // ── Cleanup audio ─────────────────────────────────────────────
  const stopAudio = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
  }, []);

  // ── Noise gate analyser ───────────────────────────────────────
  const handleNoiseLevel = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyser     = audioContext.createAnalyser();
    const source       = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    // FIX 2/3: Raise threshold, debounce, and apply rolling average
    const NOISE_THRESHOLD = 60;
    const NOISE_SAMPLES = 5;
    const noiseSamples: number[] = [];
    const checkVolume = () => {
      if (!recognitionRef.current) return;
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setDbLevel(avg);
      
      // Rolling average to prevent false triggers from brief spikes
      noiseSamples.push(avg);
      if (noiseSamples.length > NOISE_SAMPLES) {
        noiseSamples.shift();
      }
      
      const smoothedAvg = noiseSamples.reduce((a, b) => a + b, 0) / noiseSamples.length;
      
      const noisy = smoothedAvg > NOISE_THRESHOLD;
      setIsTooNoisy(noisy);
      
      if (noisy) {
        const now = Date.now();
        if (now - lastNoiseToastRef.current > 5000) {
          lastNoiseToastRef.current = now;
          options.onNoiseGate?.(avg);
        }
      }
    };
    
    // Check less frequently to save resources and prevent rapid flashing
    const intervalId = setInterval(checkVolume, 500);
    
    // Must clear interval on unmount
    return () => {
      clearInterval(intervalId);
      source.disconnect();
      audioContext.close().catch(() => {});
    };
  }, [options]);

  // ── Whisper API fallback ──────────────────────────────────────
  const triggerWhisperFallback = useCallback(async (
    blob: Blob,
    lang: 'ta' | 'en',
  ) => {
    try {
      const formData = new FormData();
      formData.append('audio',  blob);
      formData.append('lang',   lang);
      formData.append('domain', 'fish_market');   // domain hint → better accuracy

      const res        = await api.post('/voice/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const transcript = res.data.transcript as string;
      if (!transcript) throw new Error('empty transcript');

      const parsed     = parseVoiceInput(transcript, lang, {
        fishList:  options.fishList,
        buyerList: options.buyerList,
      });
      const topResult  = parsed[0];
      if (topResult) {
        const confidence = scoreConfidence(topResult, transcript);
        options.onResult(parsed);
        options.onConfidence?.(confidence);
      }
    } catch (err: any) {
      console.error('Whisper transcription failed:', err);
      const serverMsg = err.response?.data?.message || err.friendlyMessage;
      
      options.onError(
        lang === 'ta'
          ? (serverMsg || 'குரல் அடையாளம் தோல்வியடைந்தது')
          : (serverMsg || 'Voice recognition failed — please type manually'),
      );
    }
  }, [options]);

  // ── Pick best result across ALL alternatives ──────────────────
  const pickBestResult = useCallback((
    event: SpeechRecognitionEvent,
    lang: 'ta' | 'en',
  ): BestResult | null => {
    const results = event.results as unknown as SpeechRecognitionResultList;
    const alternatives = Array.from(results[0]) as unknown as SpeechRecognitionAlternative[];
    let best: BestResult | null = null;
    let bestScore = -1;

    for (const alt of alternatives) {
      const transcript = (alt.transcript as string).trim();
      if (!transcript) continue;

      const parsed = parseVoiceInput(transcript, lang, {
        fishList:  options.fishList,
        buyerList: options.buyerList,
      });

      // Score the first SALE result (most relevant)
      const saleResult = parsed.find(r => r.type === 'SALE') ?? parsed[0];
      if (!saleResult) continue;

      const scored = scoreConfidence(saleResult, transcript);
      if (scored.total > bestScore) {
        bestScore = scored.total;
        best = { transcript, parsed, confidence: scored };
      }
    }
    return best;
  }, [options]);

  // ── Core stop ────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    mediaRecRef.current?.stop();
    
    clearNoiseRef.current?.();
    clearNoiseRef.current = null;

    setIsListening(false);
    isListeningRef.current = false;
    setInterimTranscript('');
    setIsTooNoisy(false);
    setDbLevel(0);
    
    stopAudio();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
  }, [stopAudio]);

  // ── Start ─────────────────────────────────────────────────────
  const startListening = async () => {
    const SpeechRecognition =
      (window as Window & typeof globalThis & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
      (window as Window & typeof globalThis & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      options.onError('Browser does not support Speech Recognition');
      return;
    }

    try {
      // FIX 3: Use stronger noise suppression and optimal Whisper settings
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000
        },
      });
      streamRef.current = stream;
      
      clearNoiseRef.current = handleNoiseLevel(stream) ?? null;

      // Record audio for potential Whisper fallback
      try {
        const mr = new MediaRecorder(stream);
        chunksRef.current = [];
        mr.ondataavailable = e => chunksRef.current.push(e.data);
        mr.onstop = () => {
          audioBlobRef.current = new Blob(chunksRef.current, { type: 'audio/webm' });
        };
        mr.start();
        mediaRecRef.current = mr;
      } catch {
        /* MediaRecorder optional — Whisper fallback just won't work */
      }

      const recognition = new window.webkitSpeechRecognition() as SpeechRecognitionInstance;
      currentLangRef.current = options.lang === 'ta' ? 'ta-IN' : 'en-IN';
      recognition.lang           = currentLangRef.current;
      recognition.interimResults = true;
      recognition.continuous     = false; // FIX 3: don't keep continuous to prevent garbage buildup
      recognition.maxAlternatives = 5;   // Request maximum alternatives for better matching

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
        sessionTimerRef.current = setTimeout(() => stopListening(), 10_000);
      };

      // FIX 3: Adding speech start timeout block
      // If agent pauses/breathes, don't give up immediately
      recognition.onspeechstart = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      };

      // ── onresult: pick best across ALL alternatives ────────────
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];

          if (result.isFinal) {
            const lang = (currentLangRef.current === 'ta-IN') ? 'ta' : 'en';
            const best = pickBestResult(event, lang);

            if (!best) return;

            // ── Route by confidence grade ──────────────────────
            switch (best.confidence.action) {

              case 'auto_fill':
                // ≥ 80% → fill fields immediately
                options.onResult(best.parsed);
                options.onConfidence?.(best.confidence);
                break;

              case 'confirm':
                // 60-79% → surface preview for agent to confirm
                options.onPreview?.(best);
                break;

              case 'manual':
                // < 60% → try Whisper if we have audio blob
                if (audioBlobRef.current) {
                  triggerWhisperFallback(audioBlobRef.current, lang);
                } else {
                  options.onError(
                    lang === 'ta'
                      ? 'தெளிவாக சொல்லவும்'
                      : 'Low confidence — please speak clearly or type',
                  );
                }
                break;
            }
          } else {
            interim += result[0].transcript;
          }
        }
        setInterimTranscript(interim);

        // FIX 3: Longer silence tolerance (Give 3s not 1.5s in noisy env)
        silenceTimerRef.current = setTimeout(() => {
          if (isListeningRef.current) stopListening();
        }, 3000);
      };

      // ── onerror: Tamil fails → retry English → Whisper ────────
      recognition.onerror = async (err: SpeechRecognitionErrorEvent) => {
        if (err.error === 'no-speech') {
          if (currentLangRef.current === 'ta-IN') {
            // Retry in English
            currentLangRef.current = 'en-IN';
            recognition.lang = 'en-IN';
            try { recognition.start(); return; } catch { /* fall through */ }
          }
          // Both failed → Whisper
          if (audioBlobRef.current) {
            await triggerWhisperFallback(audioBlobRef.current, options.lang);
          } else {
            options.onError('No speech detected — please try again');
          }
        } else {
          options.onError(err.error ?? 'Speech recognition error');
        }
        stopListening();
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch {
      options.onError('Microphone access denied or error occurred');
    }
  };

  // Cleanup on unmount
  useEffect(() => () => { stopListening(); }, [stopListening]);

  return {
    isListening,
    interimTranscript,
    dbLevel,
    isTooNoisy,
    startListening,
    stopListening,
  };
};
