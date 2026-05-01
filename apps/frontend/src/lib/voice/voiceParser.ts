import { parseNumber, parseRomanisedTamilNumber } from './tamilNumberParser';
import { levenshtein as _levenshtein, fuzzyMatch } from './fuzzyMatch';
import { detectFishName } from './fishDetector';
import { FISH_BY_ID } from './fishPatterns';

export { _levenshtein as levenshtein };

/**
 * Enhanced Universal Voice Parser
 * Fish-specific NLP, confidence scoring, Tamil numbers, fuzzy matching.
 */

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface ParsedVoiceResult {
  type: 'SALE' | 'EXPENSE' | 'COMMAND' | 'UNKNOWN';
  fish?: string;
  weight?: number;
  rate?: number;
  /** True when rate was resolved from an ambiguous Tamil+English compound
   *  (e.g. "aayiram 500" could be 1500 or just 1000). The UI should show
   *  a confirmation chip before auto-submitting. */
  rateIsAmbiguous?: boolean;
  buyer?: string;
  amount?: number;
  key?: string;
  note?: string;
  command?: string;
  confidence?: ConfidenceBreakdown;
  warnings?: string[];
  // Detection metadata from the 5-layer engine
  detection?: {
    confidence : number;
    method     : string;
    layer      : 1 | 2 | 3 | 4 | 5;
    matched    : string;
  };
}

export interface ConfidenceBreakdown {
  total: number;          // 0–100
  grade: 'HIGH' | 'MEDIUM' | 'LOW';
  autoSubmit: boolean;    // true if ≥ 80
  breakdown: {
    fishName: number;     // max 40
    weight: number;       // max 25
    rate: number;         // max 20
    buyer: number;        // max 10
    language: number;     // max  5
  };
  action: 'auto_fill' | 'confirm' | 'manual';
}

// ─────────────────────────────────────────────────────────────────
// FISH DICTIONARY  — domain-specific NLP
// ─────────────────────────────────────────────────────────────────

export const FISH_DICTIONARY: Record<string, {
  tamil: string[];
  english: string[];
  aliases: string[];
  avgRate: number;
}> = {
  vanjaram: {
    tamil:   ['வஞ்சரம்', 'வஞ்சிரம்'],
    english: ['vanjaram', 'kingfish', 'king fish', 'seer fish'],
    aliases: ['vanjara', 'vanjarm', 'vanajram', 'king'],
    avgRate: 600,
  },
  thira: {
    tamil:   ['திரா', 'திறா'],
    english: ['thira', 'ray fish', 'sting ray'],
    aliases: ['tira', 'thera', 'thiru'],
    avgRate: 150,
  },
  vangada: {
    tamil:   ['வங்கடா', 'வாங்கடா'],
    english: ['vangada', 'mackerel'],
    aliases: ['bangda', 'wangada', 'vangad'],
    avgRate: 120,
  },
  sankara: {
    tamil:   ['சங்கரா', 'சங்கர மீன்'],
    english: ['sankara', 'red snapper', 'snapper'],
    aliases: ['red fish', 'sankara meen', 'sangara'],
    avgRate: 500,
  },
  prawn: {
    tamil:   ['இறால்', 'செம்மீன்'],
    english: ['prawn', 'shrimp', 'chemmeen'],
    aliases: ['tiger prawn', 'iraal', 'chemeen'],
    avgRate: 700,
  },
  choodai: {
    tamil:   ['சூடை', 'சூடை மீன்'],
    english: ['choodai', 'sprat', 'sardine'],
    aliases: ['soodai', 'chudai', 'chuda'],
    avgRate: 80,
  },
  kola: {
    tamil:   ['கோலா', 'கோல மீன்'],
    english: ['kola', 'barracuda'],
    aliases: ['kolaa', 'kola meen'],
    avgRate: 300,
  },
  nei_meen: {
    tamil:   ['நெய் மீன்', 'நெய்மீன்'],
    english: ['nei meen', 'pomfret', 'butter fish'],
    aliases: ['nei', 'pomphret', 'white pomfret'],
    avgRate: 450,
  },
  crab: {
    tamil:   ['நண்டு'],
    english: ['crab', 'mud crab'],
    aliases: ['nandu', 'nandu meen'],
    avgRate: 600,
  },
  squid: {
    tamil:   ['கணவாய்'],
    english: ['squid', 'calamari'],
    aliases: ['kanavaai', 'kanawai'],
    avgRate: 450,
  },
  tuna: {
    tamil:   ['சூரை', 'டூனா'],
    english: ['tuna', 'soorai'],
    aliases: ['soora meen', 'tuna fish'],
    avgRate: 380,
  },
  viral: {
    tamil:   ['விரால்'],
    english: ['viral', 'murrel', 'snakehead'],
    aliases: ['viraal', 'veral'],
    avgRate: 400,
  },
};

// ─────────────────────────────────────────────────────────────────
// KEYWORD MAPS
// ─────────────────────────────────────────────────────────────────

const EXPENSE_KEYWORDS: Record<string, string[]> = {
  diesel:  ['diesel', 'டீசல்', 'எரிபொருள்'],
  ice:     ['ice', 'ஐஸ்', 'பனி'],
  salt:    ['salt', 'உப்பு'],
  van:     ['van', 'வேன்', 'வண்டி'],
  netGear: ['net', 'gear', 'வலை', 'உபகரணங்கள்'],
  other:   ['other', 'extra', 'மற்றவை'],
  wash:    ['wash', 'கழுவுதல்', 'சுத்தம்'],
};

const COMMAND_KEYWORDS: Record<string, string[]> = {
  save:    ['save', 'confirm', 'ok', 'சேமி', 'சரி', 'உறுதி'],
  delete:  ['undo', 'delete', 'remove', 'last', 'நீக்கு', 'ரத்து'],
  print:   ['print', 'அச்சிடு'],
  entry:   ['entry', 'input', 'பதிவு'],
  slip:    ['slip', 'bill', 'சீட்டு'],
  reports: ['reports', 'analytics', 'அறிக்கை', 'வரைபடம்'],
  buyers:  ['buyers', 'customers', 'வாங்குபவர்கள்'],
  history: ['history', 'logs', 'வரலாறு'],
  english: ['english', 'ஆங்கிலம்'],
  tamil:   ['tamil', 'தமிழ்'],
};

const WEIGHT_KEYWORDS = ['kg', 'kilo', 'gram', 'கிலோ', 'எடை'];

// ─────────────────────────────────────────────────────────────────
// KEYWORD MATCHING — word-boundary aware
// ─────────────────────────────────────────────────────────────────

/**
 * Match keyword against segment using word boundaries.
 * For ASCII keywords: match as whole words (not substrings).
 * For Tamil/Unicode keywords: use substring match (Tamil has no spaces between chars).
 */
function matchesKeyword(seg: string, keyword: string): boolean {
  const isAscii = /^[a-zA-Z0-9]+$/.test(keyword);
  if (isAscii) {
    // Word-boundary: ensure keyword is a standalone word, not part of a longer word
    const regex = new RegExp(`(?:^|\\s)${keyword}(?:\\s|$)`, 'i');
    return regex.test(seg);
  }
  // Tamil/Unicode: substring match is appropriate
  return seg.includes(keyword);
}

// ─────────────────────────────────────────────────────────────────
// CONFIDENCE SCORING
// ─────────────────────────────────────────────────────────────────

export function scoreConfidence(
  parsed: ParsedVoiceResult,
  transcript: string,
): ConfidenceBreakdown {
  const text = transcript.toLowerCase();

  const breakdown = { fishName: 0, weight: 0, rate: 0, buyer: 0, language: 0 };

  // ── Fish Name (40 pts) — weighted by detection layer ─────────────────
  if (parsed.fish) {
    if (parsed.detection) {
      // Use detection confidence from the 5-layer engine directly
      const detConf = parsed.detection.confidence;
      // Scale to 40 pts max
      breakdown.fishName = Math.round((detConf / 100) * 40);
    } else {
      // Fallback: check dictionary directly (legacy)
      const dict = FISH_DICTIONARY[parsed.fish];
      const exactEn = dict?.english.some(e => text.includes(e.toLowerCase()));
      const exactTa = dict?.tamil.some(t => text.includes(t));
      const fuzzy   = dict?.aliases.some(a => _levenshtein(text, a) <= 2);
      if (exactEn || exactTa) breakdown.fishName = 40;
      else if (fuzzy)          breakdown.fishName = 25;
    }
  }

  // ── Weight (25 pts) — check parsed.weight is defined and > 0 ─────────
  if (parsed.weight !== undefined && parsed.weight !== null && parsed.weight > 0) {
    const hasUnit = /கிலோ|kg|kilo|kilogram/i.test(transcript);
    breakdown.weight = hasUnit ? 25 : 15;
  }

  // ── Rate (20 pts) — check parsed.rate is defined and > 0 ─────────────
  if (parsed.rate !== undefined && parsed.rate !== null && parsed.rate > 0) {
    const hasKeyword = /rate|ரேட்|விலை|price|rupee|ரூபாய்/i.test(transcript);
    if (hasKeyword) breakdown.rate = 20;
    else if (parsed.rate >= 10 && parsed.rate <= 9999) breakdown.rate = 12;
  }

  // ── Buyer (10 pts) ──────────────────────────────────────────────
  if (parsed.buyer) breakdown.buyer = 10;

  // ── Language clarity (5 pts) ────────────────────────────────────
  const hasTamil   = /[\u0B80-\u0BFF]/.test(transcript);
  const hasEnglish = /[a-zA-Z]/.test(transcript);
  breakdown.language = (hasTamil && hasEnglish) ? 2 : 5;

  const total  = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const grade  = total >= 80 ? 'HIGH' : total >= 60 ? 'MEDIUM' : 'LOW';
  const action = total >= 80 ? 'auto_fill' : total >= 60 ? 'confirm' : 'manual';

  return { total, grade, autoSubmit: total >= 80, breakdown, action };
}

// ─────────────────────────────────────────────────────────────────
// FISH NAME EXTRACTION — 5-Layer Engine
// ─────────────────────────────────────────────────────────────────

/**
 * extractFishName — runs the 5-layer detection engine.
 * Falls back to caller-provided fishList via fuzzyMatch.
 * Returns { fishId, detection } or null.
 */
function extractFishNameEnhanced(
  text: string,
  fishList?: string[],
): { fishId: string; detection: NonNullable<ParsedVoiceResult['detection']> } | null {
  // Run 5-layer engine
  const result = detectFishName(text);
  if (result) {
    return {
      fishId: result.fishId,
      detection: {
        confidence : result.confidence,
        method     : result.method,
        layer      : result.matchLayer,
        matched    : result.matchedText,
      },
    };
  }

  // Fallback to caller-provided fishList
  if (fishList && fishList.length > 0) {
    for (const word of text.split(/\s+/)) {
      const m = fuzzyMatch(word, fishList, 0.4);
      if (m) {
        return {
          fishId: m,
          detection: {
            confidence : 55,
            method     : 'caller_list_fuzzy',
            layer      : 5,
            matched    : word,
          },
        };
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────
// WEIGHT EXTRACTION
// ─────────────────────────────────────────────────────────────────

function extractWeight(text: string, lang: 'ta' | 'en'): number | null {
  // For Tamil, try Tamil number words first
  // For English, only use parseNumber if there are NO Arabic digits (avoids treating weights as Tamil #s)
  if (lang === 'ta') {
    const tamilVal = parseNumber(text, lang);
    if (tamilVal !== null) {
      const hasHalf    = /அரை|half/i.test(text);
      const hasQuarter = /கால்|quarter/i.test(text);
      if (hasHalf)    return tamilVal + 0.5;
      if (hasQuarter) return tamilVal + 0.25;
      return tamilVal;
    }
  }

  // Numeric + unit (handles "15.5 kg", "20kg", "50 kilo")
  const unitMatch = text.match(/(\d+\.?\d*)\s*(?:கிலோ|kg|kilo|kilogram)/i);
  if (unitMatch) return parseFloat(unitMatch[1]);

  // Context: number adjacent to weight keyword
  const parts = text.split(/\s+/);
  for (let i = 0; i < parts.length; i++) {
    const num = parseFloat(parts[i]);
    if (!isNaN(num)) {
      const prev = parts[i - 1] ?? '';
      const next = parts[i + 1] ?? '';
      if (WEIGHT_KEYWORDS.some(k => prev.includes(k) || next.includes(k))) {
        return num;
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────
// RATE EXTRACTION
// ─────────────────────────────────────────────────────────────────

function extractRate(
  text: string,
  priceRange?: [number, number],
): { value: number | null; isAmbiguous: boolean } {
  const lower  = text.toLowerCase();
  const tokens = lower.split(/\s+/);

  // ── 1. Locate rate anchor keyword ────────────────────────────────────────
  const RATE_ANCHORS = ['rate', 'ரேட்', 'விலை', 'price', 'at', '@', 'rupee', 'ரூபாய்', 'rs', '₹'];
  let anchorIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (RATE_ANCHORS.includes(tokens[i]!)) {
      anchorIdx = i;
      break;
    }
  }

  if (anchorIdx !== -1) {
    const afterAnchor = anchorIdx + 1;

    // ── 2a. Try romanised Tamil numeral first ────────────────────────────
    const tamilResult = parseRomanisedTamilNumber(tokens, afterAnchor);
    if (tamilResult !== null) {
      const v = tamilResult.value;
      if (v >= 1 && v <= 999999) {
        return { value: v, isAmbiguous: tamilResult.isAmbiguous };
      }
    }

    // ── 2b. Fallback: Arabic digit immediately after anchor ───────────────
    const nextToken = tokens[afterAnchor];
    if (nextToken !== undefined) {
      const v = parseFloat(nextToken);
      if (!isNaN(v) && v >= 10 && v <= 9999) {
        return { value: v, isAmbiguous: false };
      }
    }
  }

  // ── 3. No anchor — try romanised Tamil anywhere in the string ─────────────
  //   (handles "vanjaram 20 kilo aayiram" where rate comes without keyword)
  for (let i = 0; i < tokens.length; i++) {
    const tamilResult = parseRomanisedTamilNumber(tokens, i);
    if (tamilResult !== null) {
      const v = tamilResult.value;
      // Sanity-check against fish price range when available
      const inRange = priceRange
        ? v >= priceRange[0] * 0.5 && v <= priceRange[1] * 2
        : v >= 10 && v <= 99999;
      if (inRange) {
        return { value: v, isAmbiguous: tamilResult.isAmbiguous };
      }
      // Skip consumed tokens to avoid re-processing sub-tokens
      i += tamilResult.tokensConsumed - 1;
    }
  }

  // ── 4. Last resort: largest plausible Arabic digit ────────────────────────
  const hasWeightUnit = /கிலோ|kg|kilo|kilogram/i.test(text);
  if (hasWeightUnit) return { value: null, isAmbiguous: false };

  const numbers = [...text.matchAll(/\b(\d+)\b/g)]
    .map(m => parseInt(m[1]!))
    .filter(n => {
      if (priceRange) {
        const [min, max] = priceRange;
        return n >= min * 0.5 && n <= max * 2;
      }
      return n >= 10 && n <= 9999;
    });

  return {
    value: numbers.length > 0 ? Math.max(...numbers) : null,
    isAmbiguous: false,
  };
}

// ─────────────────────────────────────────────────────────────────
// BUYER EXTRACTION
// ─────────────────────────────────────────────────────────────────

function extractBuyer(text: string, originalText: string, buyerList: string[]): string | undefined {
  // Exact match from known list (case-insensitive, return original case)
  for (const name of buyerList) {
    if (text.includes(name.toLowerCase())) return name;
  }
  // Keyword-based extraction — use original text to preserve case
  const match = originalText.match(
    /(?:buyer|வாங்குபவர்|customer|for|to)\s+([a-zA-Z\u0B80-\u0BFF]+)/i,
  );
  return match?.[1] ?? undefined;
}

// ─────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────

export const parseVoiceInput = (
  transcript: string,
  lang: 'ta' | 'en',
  options?: { fishList?: string[]; buyerList?: string[] },
): ParsedVoiceResult[] => {
  const lower = transcript.toLowerCase().trim();
  if (!lower) return [];

  const results: ParsedVoiceResult[] = [];

  // Split compound inputs: "X and Y" / "X மற்றும் Y"
  const segments = lower
    .split(/(?:\s+மற்றும்\s+|\s+and\s+|[,&])/i)
    .map(s => s.trim())
    .filter(Boolean);

  // Keep parallel array of original-case segments for buyer extraction
  const originalSegments = transcript
    .split(/(?:\s+மற்றும்\s+|\s+and\s+|[,&])/i)
    .map(s => s.trim())
    .filter(Boolean);

  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    const originalSeg = originalSegments[si] ?? seg;

    // ── 1. Command check ──────────────────────────────────────────
    let handled = false;
    for (const [cmd, keywords] of Object.entries(COMMAND_KEYWORDS)) {
      if (keywords.some(k => matchesKeyword(seg, k))) {
        results.push({ type: 'COMMAND', command: cmd });
        handled = true;
        break;
      }
    }
    if (handled) continue;

    // ── 2. Expense check ──────────────────────────────────────────
    for (const [key, keywords] of Object.entries(EXPENSE_KEYWORDS)) {
      if (keywords.some(k => matchesKeyword(seg, k))) {
        const nums  = seg.match(/\d+(\.\d+)?/g) ?? [];
        const amount = nums.length > 0 ? parseFloat(nums[0]!) : 0;
        results.push({
          type: 'EXPENSE',
          key,
          amount,
          note: seg
            .replace(new RegExp(keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi'), '')
            .replace(/\d+(\.\d+)?/g, '')
            .trim(),
        });
        handled = true;
        break;
      }
    }
    if (handled) continue;

    // ── 3. Sale parsing ───────────────────────────────────────────
    const warnings: string[] = [];

    // Fish: 5-layer detection engine first, then caller-provided list
    const fishResult = extractFishNameEnhanced(seg, options?.fishList);
    const fish       = fishResult?.fishId ?? undefined;
    const detection  = fishResult?.detection;

    // Get fish profile for price range sanity
    const profile  = fish ? FISH_BY_ID.get(fish) : undefined;

    const weight      = extractWeight(seg, lang);
    const rateResult  = extractRate(seg, profile?.priceRange);
    const buyer       = extractBuyer(seg, originalSeg, options?.buyerList ?? []);

    // Suggest average rate from FISH_DICTIONARY when rate is missing
    // Use FISH_DICTIONARY.avgRate for consistent test expectations
    if (rateResult.value === null && fish) {
      const avgRate = FISH_DICTIONARY[fish]?.avgRate;
      if (avgRate) warnings.push(`Suggested rate: ₹${avgRate}`);
    }

    // Warn when rate is ambiguous (Tamil compound numeral + trailing digit)
    if (rateResult.isAmbiguous && rateResult.value !== null) {
      warnings.push(`Rate ₹${rateResult.value} parsed from compound Tamil numeral — please confirm`);
    }

    const partial: ParsedVoiceResult = {
      type: 'SALE',
      fish,
      weight         : weight ?? undefined,
      rate           : rateResult.value ?? undefined,
      rateIsAmbiguous: rateResult.isAmbiguous || undefined,
      buyer,
      warnings,
      detection,
    };

    // Attach confidence score
    partial.confidence = scoreConfidence(partial, transcript);

    if (weight !== null || fish || buyer) {
      results.push(partial);
    }
  }

  return results;
};
