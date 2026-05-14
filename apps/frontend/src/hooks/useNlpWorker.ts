/**
 * useNlpWorker.ts — React Hook for Off-Thread NLP Parsing
 *
 * Wraps the WorkerManager in a React-friendly interface:
 *   - Debounced parsing (configurable delay, default 120ms)
 *   - Automatic cancellation of stale requests on new input
 *   - isLoading state for optimistic spinner feedback
 *   - Structured error state
 *   - Optional telemetry callback
 *
 * Usage:
 *   const { parse, isLoading, lastResults } = useNlpWorker({ lang: 'ta' });
 *   parse(transcript);  // fires debounced, off-thread parse
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { nlpWorkerManager } from '../lib/voice/worker/workerManager';
import type { WorkerTelemetryPayload } from '../lib/voice/worker/workerManager';
import type { ParsedVoiceResult } from '../lib/voice/voiceParser';

interface UseNlpWorkerOptions {
  lang: 'ta' | 'en';
  fishList?: string[];
  buyerList?: string[];
  /** Debounce delay in ms before firing the worker. Default 120. */
  debounceMs?: number;
  /** Called when the worker completes a parse (incl. fallback). */
  onResults?: (results: ParsedVoiceResult[]) => void;
  /** Called on parse error or cancellation. */
  onError?: (message: string) => void;
  /** Called with worker performance metrics after each parse. */
  onTelemetry?: (t: WorkerTelemetryPayload) => void;
}

interface UseNlpWorkerReturn {
  /** Trigger a parse — debounced, cancels any in-flight request. */
  parse: (transcript: string) => void;
  /** Cancel the current in-flight parse (if any). */
  cancel: () => void;
  /** True while the worker is processing. */
  isLoading: boolean;
  /** Most recent successful results. */
  lastResults: ParsedVoiceResult[];
  /** Most recent error message, or null. */
  error: string | null;
}

export function useNlpWorker(options: UseNlpWorkerOptions): UseNlpWorkerReturn {
  const [isLoading, setIsLoading]   = useState(false);
  const [lastResults, setLastResults] = useState<ParsedVoiceResult[]>([]);
  const [error, setError]           = useState<string | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestId  = useRef<string | null>(null);

  // Stable refs to avoid stale closure over options
  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; }, [options]);

  const cancel = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (activeRequestId.current) {
      nlpWorkerManager.cancel(activeRequestId.current);
      activeRequestId.current = null;
    }
    setIsLoading(false);
  }, []);

  const parse = useCallback((transcript: string) => {
    // Reset debounce
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    // Cancel any in-flight request immediately
    if (activeRequestId.current) {
      nlpWorkerManager.cancel(activeRequestId.current);
      activeRequestId.current = null;
    }

    if (!transcript.trim()) {
      setIsLoading(false);
      return;
    }

    const delay = optionsRef.current.debounceMs ?? 120;

    debounceTimerRef.current = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      const { lang, fishList, buyerList, onResults, onError, onTelemetry } = optionsRef.current;

      try {
        const results = await nlpWorkerManager.parse(transcript, lang, {
          fishList,
          buyerList,
          onTelemetry: (t) => onTelemetry?.(t),
        });

        setLastResults(results);
        onResults?.(results);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Parse failed';
        if (msg !== 'cancelled') {
          setError(msg);
          onError?.(msg);
        }
      } finally {
        activeRequestId.current = null;
        setIsLoading(false);
      }
    }, delay);
  }, []);

  // Clean up on unmount
  useEffect(() => () => { cancel(); }, [cancel]);

  return { parse, cancel, isLoading, lastResults, error };
}
