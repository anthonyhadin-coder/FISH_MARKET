import { useState, useRef, useCallback, useEffect } from 'react';
import api from '../lib/api/api';
import { parseVoiceInput, ParsedVoiceResult } from '../lib/voice/voiceParser';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface VoiceNoteRecorderOptions {
  lang: 'ta' | 'en';
  fishList?: string[];
  buyerList?: string[];
  onResult?: (results: ParsedVoiceResult[], transcript: string) => void;
  onError?: (error: string) => void;
}

/**
 * useVoiceNoteRecorder
 *
 * Records the entire boat session as a single audio note (no short-utterance timeouts).
 * Supports pause/resume. On stop, sends audio to the Whisper /voice/transcribe endpoint
 * and parses all sale entries from the returned transcript.
 *
 * State machine: idle → recording ⇆ paused → processing → idle
 */
export const useVoiceNoteRecorder = (options: VoiceNoteRecorderOptions) => {
  const [isRecording, setIsRecording]     = useState(false);
  const [isPaused,    setIsPaused]        = useState(false);
  const [isProcessing, setIsProcessing]   = useState(false);
  const [elapsedSeconds, setElapsedSecs]  = useState(0);
  const [dbLevel,     setDbLevel]         = useState(0);

  const mediaRecRef    = useRef<MediaRecorder | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const dataArrayRef   = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const chunksRef      = useRef<BlobPart[]>([]);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const animFrameRef   = useRef<number | null>(null);
  // Keep a stable ref to options so callbacks don't go stale
  const optionsRef     = useRef(options);
  useEffect(() => { optionsRef.current = options; }, [options]);

  // ── Internal cleanup ────────────────────────────────────────────
  const stopAudioInfrastructure = useCallback(() => {
    if (timerRef.current)    clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    dataArrayRef.current = null;
    setDbLevel(0);
  }, []);

  // ── Waveform animation loop ─────────────────────────────────────
  const startWaveform = useCallback(() => {
    const tick = () => {
      if (!analyserRef.current || !dataArrayRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      const avg = dataArrayRef.current.reduce((a, b) => a + b, 0) / dataArrayRef.current.length;
      setDbLevel(avg);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  // ── Start recording ────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
        },
      });
      streamRef.current = stream;

      // Audio analysis pipeline
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      audioCtx.createMediaStreamSource(stream).connect(analyser);

      // MediaRecorder — collect data every 100ms for smooth pause/resume
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.start(100);
      mediaRecRef.current = mr;

      setIsRecording(true);
      setIsPaused(false);
      setElapsedSecs(0);

      // Elapsed time counter
      timerRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000);
      startWaveform();

      if (window.navigator?.vibrate) window.navigator.vibrate(50);
    } catch {
      optionsRef.current.onError?.(
        optionsRef.current.lang === 'ta'
          ? 'மைக்ரோஃபோன் அணுகல் மறுக்கப்பட்டது'
          : 'Microphone access denied or unavailable',
      );
    }
  }, [startWaveform]);

  // ── Pause ──────────────────────────────────────────────────────
  const pauseRecording = useCallback(() => {
    if (mediaRecRef.current?.state === 'recording') {
      mediaRecRef.current.pause();
      setIsPaused(true);
      if (timerRef.current)    clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setDbLevel(0);
      if (window.navigator?.vibrate) window.navigator.vibrate([50, 50]);
    }
  }, []);

  // ── Resume ─────────────────────────────────────────────────────
  const resumeRecording = useCallback(() => {
    if (mediaRecRef.current?.state === 'paused') {
      mediaRecRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000);
      startWaveform();
      if (window.navigator?.vibrate) window.navigator.vibrate(50);
    }
  }, [startWaveform]);

  // ── Stop & transcribe ──────────────────────────────────────────
  const stopRecording = useCallback(async () => {
    if (!mediaRecRef.current || mediaRecRef.current.state === 'inactive') return;

    setIsRecording(false);
    setIsPaused(false);
    stopAudioInfrastructure();
    setIsProcessing(true);

    try {
      // Wait for the recorder to fully stop and flush remaining data
      await new Promise<void>(resolve => {
        const mr = mediaRecRef.current!;
        if (mr.state !== 'inactive') {
          mr.onstop = () => resolve();
          mr.stop();
        } else {
          resolve();
        }
      });

      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

      if (blob.size < 500) {
        optionsRef.current.onError?.(
          optionsRef.current.lang === 'ta'
            ? 'ஒலி பதிவாகவில்லை — மீண்டும் முயற்சிக்கவும்'
            : 'No audio recorded — please try again',
        );
        setIsProcessing(false);
        return;
      }

      // BUG-009 FIX: Front-end protection matching backend 25MB limit
      const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
      if (blob.size > MAX_AUDIO_BYTES) {
        optionsRef.current.onError?.(
          optionsRef.current.lang === 'ta'
            ? 'ஒலிப்பதிவு மிகவும் பெரியது (அதிகபட்சம் 25MB). சிறிய பகுதிகளாக பதிவு செய்யவும்.'
            : 'Audio file too large (max 25MB). Please try shorter segments.'
        );
        setIsProcessing(false);
        return;
      }

      // Send to Whisper endpoint
      const formData = new FormData();
      formData.append('audio', blob, 'voice_note.webm');
      formData.append('lang', optionsRef.current.lang);
      formData.append('domain', 'fish_market');

      const res = await api.post('/voice/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000, // Whisper can take up to 2 min for long notes
      });

      const transcript = (res.data.transcript as string || '').trim();
      if (!transcript) {
        throw new Error('empty_transcript');
      }

      // Parse all entries from the full transcript in one pass
      const results = parseVoiceInput(transcript, optionsRef.current.lang, {
        fishList:  optionsRef.current.fishList,
        buyerList: optionsRef.current.buyerList,
      });

      optionsRef.current.onResult?.(results, transcript);
    } catch (err: unknown) {
      const e = err as { message?: string; response?: { data?: { message?: string } } };
      const serverMsg = e.response?.data?.message;
      const isEmptyTranscript = e.message === 'empty_transcript';

      optionsRef.current.onError?.(
        serverMsg
          ?? (isEmptyTranscript
            ? (optionsRef.current.lang === 'ta' ? 'ஒன்றும் கேட்கவில்லை — தெளிவாக பேசவும்' : 'Nothing heard — please speak clearly')
            : (optionsRef.current.lang === 'ta' ? 'குரல் அடையாளம் தோல்வியடைந்தது' : 'Voice transcription failed')),
      );
    } finally {
      setIsProcessing(false);
      chunksRef.current = [];
      setElapsedSecs(0);
    }
  }, [stopAudioInfrastructure]);

  // BUG-013 FIX: Auto-stop recording at 10 minutes to prevent unbounded memory/duration
  useEffect(() => {
    if (elapsedSeconds >= 600 && isRecording && !isPaused) {
      stopRecording();
      optionsRef.current.onError?.(
        optionsRef.current.lang === 'ta'
          ? 'அதிகபட்ச நேரமான 10 நிமிடம் முடிந்தது. பதிவிறக்கம் செய்யப்படுகிறது.'
          : 'Maximum duration of 10 minutes reached. Processing...'
      );
    }
  }, [elapsedSeconds, isRecording, isPaused, stopRecording]);

  // Cleanup on unmount
  useEffect(() => () => stopAudioInfrastructure(), [stopAudioInfrastructure]);

  return {
    isRecording,
    isPaused,
    isProcessing,
    elapsedSeconds,
    dbLevel,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  };
};
