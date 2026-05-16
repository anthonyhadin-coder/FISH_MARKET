/**
 * workerProtocol.ts — Type-Safe Worker Message Protocol
 *
 * Discriminated unions for all messages flowing between the main
 * thread and the NLP Web Worker.  Zero `any` — fully inferred.
 */

import type { ParsedVoiceResult } from '../voiceParser';

// Re-export for consumers that import from this central types file
export type { ParsedVoiceResult, ConfidenceBreakdown } from '../voiceParser';

// ─────────────────────────────────────────────────────────────────
// WORKER → MAIN THREAD
// ─────────────────────────────────────────────────────────────────

export interface WorkerParseSuccess {
  type: 'PARSE_SUCCESS';
  requestId: string;
  results: ParsedVoiceResult[];
  telemetry: WorkerTelemetry;
}

export interface WorkerParseError {
  type: 'PARSE_ERROR';
  requestId: string;
  error: string;
  telemetry: WorkerTelemetry;
}

export interface WorkerReady {
  type: 'WORKER_READY';
}

export type WorkerResponse = WorkerParseSuccess | WorkerParseError | WorkerReady;

// ─────────────────────────────────────────────────────────────────
// MAIN THREAD → WORKER
// ─────────────────────────────────────────────────────────────────

export interface ParseRequest {
  type: 'PARSE';
  requestId: string;
  transcript: string;
  lang: 'ta' | 'en';
  options?: {
    fishList?: string[];
    buyerList?: string[];
  };
}

export interface CancelRequest {
  type: 'CANCEL';
  requestId: string;
}

export type WorkerRequest = ParseRequest | CancelRequest;

// ─────────────────────────────────────────────────────────────────
// TELEMETRY SCHEMA
// ─────────────────────────────────────────────────────────────────

export interface WorkerTelemetry {
  /** Total time from receiving message to posting response (ms) */
  totalDurationMs: number;
  /** Time spent in fuzzy matching / Levenshtein (ms) */
  fuzzyMatchDurationMs: number;
  /** Time spent in Tamil number parsing (ms) */
  tamilParserDurationMs: number;
  /** Length of the raw transcript string */
  transcriptLength: number;
  /** Number of results produced */
  resultCount: number;
  /** Highest confidence score produced, or 0 */
  topConfidence: number;
  /** True when the parser returned zero SALE results */
  failedParse: boolean;
  /** True when the request was cancelled before completion */
  wasCancelled: boolean;
}
