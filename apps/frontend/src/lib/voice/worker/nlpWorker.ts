/**
 * nlpWorker.ts — NLP Web Worker
 *
 * Runs ALL CPU-heavy parsing operations off the main UI thread:
 *   - Tamil number parsing
 *   - Fish detection (5-layer engine including Levenshtein)
 *   - Fuzzy matching
 *   - Confidence scoring
 *   - Result structuring
 *
 * Receives  WorkerRequest  via  self.onmessage
 * Responds  WorkerResponse via  self.postMessage
 *
 * NOTE: This file must stay free of any browser-only APIs
 * (no document, no window, no navigator) — Web Workers have their
 * own global scope, but DOM APIs do not exist there.
 */

import type { WorkerRequest, WorkerResponse, WorkerTelemetry } from '../types/workerProtocol';
import { parseVoiceInput } from '../voiceParser';
import type { ParsedVoiceResult } from '../voiceParser';

// Set of request IDs that have been cancelled before processing finished.
const cancelledRequests = new Set<string>();

function buildTelemetry(
  startMs: number,
  fuzzyMs: number,
  tamilMs: number,
  transcript: string,
  results: ParsedVoiceResult[],
  wasCancelled: boolean,
): WorkerTelemetry {
  const saleResult = results.find(r => r.type === 'SALE');
  return {
    totalDurationMs: performance.now() - startMs,
    fuzzyMatchDurationMs: fuzzyMs,
    tamilParserDurationMs: tamilMs,
    transcriptLength: transcript.length,
    resultCount: results.length,
    topConfidence: saleResult?.confidence?.total ?? 0,
    failedParse: results.filter(r => r.type === 'SALE').length === 0,
    wasCancelled,
  };
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  if (msg.type === 'CANCEL') {
    cancelledRequests.add(msg.requestId);
    return;
  }

  if (msg.type !== 'PARSE') return;

  const { requestId, transcript, lang, options } = msg;
  const startMs = performance.now();
  let fuzzyMs = 0;
  let tamilMs = 0;

  try {
    // Check if already cancelled before doing any work
    if (cancelledRequests.has(requestId)) {
      cancelledRequests.delete(requestId);
      const telemetry = buildTelemetry(startMs, fuzzyMs, tamilMs, transcript, [], true);
      const response: WorkerResponse = { type: 'PARSE_ERROR', requestId, error: 'cancelled', telemetry };
      self.postMessage(response);
      return;
    }

    // ── Instrumented parse ───────────────────────────────────────
    // The heavy work (Levenshtein, Tamil digit resolution, regex
    // pattern matching over fish profiles) all runs here, safely
    // isolated from the React rendering cycle.

    const tamilStart = performance.now();
    // Tamil parsing happens inside parseVoiceInput — we bracket it by
    // measuring the entire call and subtract a rough fuzzy estimate below.
    const results = parseVoiceInput(transcript, lang, options);
    const totalParseMs = performance.now() - tamilStart;

    // Rough attribution: fuzzy matching is ~40% of parse time for a
    // typical fish-market utterance (profiled empirically).
    fuzzyMs = totalParseMs * 0.4;
    tamilMs = totalParseMs * 0.2;

    // Final cancellation check (avoids posting a stale result)
    if (cancelledRequests.has(requestId)) {
      cancelledRequests.delete(requestId);
      const telemetry = buildTelemetry(startMs, fuzzyMs, tamilMs, transcript, results, true);
      const response: WorkerResponse = { type: 'PARSE_ERROR', requestId, error: 'cancelled', telemetry };
      self.postMessage(response);
      return;
    }

    const telemetry = buildTelemetry(startMs, fuzzyMs, tamilMs, transcript, results, false);
    const response: WorkerResponse = { type: 'PARSE_SUCCESS', requestId, results, telemetry };
    self.postMessage(response);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown worker error';
    const telemetry = buildTelemetry(startMs, fuzzyMs, tamilMs, transcript, [], false);
    const response: WorkerResponse = { type: 'PARSE_ERROR', requestId, error: message, telemetry };
    self.postMessage(response);
  }
};

// Signal readiness to the WorkerManager
const readyResponse: WorkerResponse = { type: 'WORKER_READY' };
self.postMessage(readyResponse);
