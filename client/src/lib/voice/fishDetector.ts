/**
 * fishDetector.ts — 5-Layer Fish Name Detection Engine
 *
 * Layer 1: Exact index match   → 100% confidence
 * Layer 2: Regex pattern match → 95% confidence
 * Layer 3: Tamil Unicode match → 95% confidence
 * Layer 4: Fuzzy Levenshtein  → 70-90% confidence
 * Layer 5: Context/price/freq → 60-65% confidence
 *
 * Designed for noisy Tamil Nadu fish markets with fast,
 * dialect-mixed speech from boat agents.
 */

import {
  FISH_PROFILES,
  FISH_NAME_INDEX,
} from './fishPatterns';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface DetectionResult {
  fishId      : string;
  confidence  : number;       // 0–100
  matchLayer  : 1 | 2 | 3 | 4 | 5;
  matchedText : string;
  method      : string;
}

// ─────────────────────────────────────────────────────────────────
// LEVENSHTEIN DISTANCE
// ─────────────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  // Fast bail-out — no point computing if lengths differ too much
  if (Math.abs(a.length - b.length) > 3) return Infinity;

  const dp: number[][] = Array.from(
    { length: b.length + 1 },
    (_, i) => [i]
  );
  for (let j = 0; j <= a.length; j++) dp[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      dp[i][j] =
        b[i - 1] === a[j - 1]
          ? dp[i - 1][j - 1]
          : Math.min(
              dp[i - 1][j - 1] + 1, // substitution
              dp[i][j - 1] + 1,      // insertion
              dp[i - 1][j] + 1       // deletion
            );
    }
  }
  return dp[b.length][a.length];
}

// ─────────────────────────────────────────────────────────────────
// CONFUSION RESOLVER (Layer 5)
// ─────────────────────────────────────────────────────────────────

function resolveConfusion(
  text : string,
  words: string[],
): DetectionResult | null {
  // ── Strategy A: Price context ────────────────────────────────
  // If a price number is mentioned, find which fish fits that range
  const priceMatch = text.match(/\b(\d{2,5})\b/);
  if (priceMatch) {
    const price = parseInt(priceMatch[1]);
    const candidates = FISH_PROFILES.filter(
      f => price >= f.priceRange[0] && price <= f.priceRange[1]
    );
    if (candidates.length === 1) {
      return {
        fishId     : candidates[0].id,
        confidence : 65,
        matchLayer : 5,
        matchedText: text,
        method     : 'price_context',
      };
    }
  }

  // ── Strategy B: Prefix frequency-based fallback ──────────────
  // "very_high" frequency fish ranked first — most likely in market
  const byFrequency = FISH_PROFILES.filter(f => f.frequency === 'very_high');
  for (const fish of byFrequency) {
    if (
      words.some(w =>
        w.length > 2 &&
        fish.phoneticForms.some(p => p.startsWith(w.slice(0, 3)))
      )
    ) {
      return {
        fishId     : fish.id,
        confidence : 60,
        matchLayer : 5,
        matchedText: words.join(' '),
        method     : 'prefix_frequency',
      };
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────
// MAIN DETECTOR — 5 Layers
// ─────────────────────────────────────────────────────────────────

export function detectFishName(
  transcript: string,
): DetectionResult | null {
  const text  = transcript.toLowerCase().trim();
  const words = text.split(/\s+/);

  // ═══════════════════════════════════════════════════════════════
  // LAYER 1 — Exact Index Match (100%)
  // Fastest path — straight O(1) Map lookup.
  // Checks: single words, then bigrams (two-word fish names)
  // ═══════════════════════════════════════════════════════════════

  // Single word exact match
  for (const word of words) {
    const fishId = FISH_NAME_INDEX.get(word);
    if (fishId) {
      return {
        fishId,
        confidence : 100,
        matchLayer : 1,
        matchedText: word,
        method     : 'exact_index',
      };
    }
  }

  // Bigram exact match (e.g., "king fish", "nei meen", "red snapper")
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    const fishId = FISH_NAME_INDEX.get(bigram);
    if (fishId) {
      return {
        fishId,
        confidence : 100,
        matchLayer : 1,
        matchedText: bigram,
        method     : 'bigram_exact',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYER 2 — Regex Pattern Match (95%)
  // Fish-specific speech-to-text correction patterns.
  // Handles slurred speech forms and phonetic approximations.
  // ═══════════════════════════════════════════════════════════════

  for (const profile of FISH_PROFILES) {
    for (const pattern of profile.patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          fishId     : profile.id,
          confidence : 95,
          matchLayer : 2,
          matchedText: match[0],
          method     : 'regex_pattern',
        };
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYER 3 — Tamil Unicode Substring Match (95%)
  // Direct Tamil script matching in case the STT engine returns
  // Tamil characters (Google STT does this when lang = 'ta-IN').
  // ═══════════════════════════════════════════════════════════════

  const hasTamil = /[\u0B80-\u0BFF]/.test(text);
  if (hasTamil) {
    for (const profile of FISH_PROFILES) {
      for (const tamilName of profile.tamilNames) {
        if (text.includes(tamilName.toLowerCase())) {
          return {
            fishId     : profile.id,
            confidence : 95,
            matchLayer : 3,
            matchedText: tamilName,
            method     : 'tamil_unicode',
          };
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYER 4 — Fuzzy Levenshtein Match (70–90%)
  // Handles: slurring, fast speech, STT transcription noise.
  // Strict for short words (≤4 chars: max distance 1)
  // Lenient for long words (>4 chars: max distance 2)
  // Checks phoneticForms + boatSlang for each profile.
  // ═══════════════════════════════════════════════════════════════

  let bestMatch: DetectionResult | null = null;
  let bestDist  = Infinity;

  for (const word of words) {
    if (word.length < 3) continue; // Skip noise tokens

    for (const profile of FISH_PROFILES) {
      const candidateForms = [
        ...profile.phoneticForms,
        ...profile.boatSlang,
      ];

      for (const form of candidateForms) {
        const dist    = levenshtein(word, form);
        const maxDist = word.length <= 4 ? 1 : 2; // Strict for short words

        if (dist <= maxDist && dist < bestDist) {
          bestDist  = dist;
          const confidence =
            dist === 0 ? 90 :
            dist === 1 ? 80 : 70;

          bestMatch = {
            fishId     : profile.id,
            confidence,
            matchLayer : 4,
            matchedText: word,
            method     : `fuzzy_lev${dist}`,
          };
        }
      }
    }
  }

  if (bestMatch) return bestMatch;

  // ═══════════════════════════════════════════════════════════════
  // LAYER 5 — Context / Price / Frequency Fallback (60–65%)
  // Last resort: use price context or market frequency to guess.
  // ═══════════════════════════════════════════════════════════════

  return resolveConfusion(text, words);
}
