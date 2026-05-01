/**
 * Strict Voice Parse Engine
 *
 * Converts a Tamil + English mixed voice transcript into a final,
 * structured sale record with NO user confirmation and NO ambiguity
 * flags. This is the auto-submit path used when confidence ≥ 80.
 *
 * Field mapping rules (in priority order):
 *   Rule 1 — Fish Name : first recognisable word → fish_name
 *   Rule 2 — Weight    : number immediately before "kilo/kg/கிலோ" → weight
 *   Rule 3 — Rate      : number(s) after "rate/ரேட்/விலை/price/@" → rate
 *   Rule 4 — Paid      : number(s) before "kuduthaan/pay/kudutha" → paid
 *
 * Tamil number rules applied in all numeric contexts:
 *   nooru          = 100
 *   aayiram        = 1000
 *   rendu aayiram  = 2 × 1000 = 2000
 *   nooru 50       = 100 + 50  = 150
 *   rendu aayiram 500 = 2000 + 500 = 2500
 *   pathinaayiram  = 10,000  (fused form)
 */

import {
  parseRomanisedTamilNumber,
  ROMANISED_BASES,
  ROMANISED_MULTIPLIERS,
  ROMANISED_FUSED,
} from './tamilNumberParser';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface StrictParseResult {
  fish_name: string;
  weight: number;
  rate: number;
  buyer: string;
  paid: number;
  total: number;
  balance: number;
}

// ─────────────────────────────────────────────────────────────────
// FISH NAME LOOKUP
// ─────────────────────────────────────────────────────────────────

/**
 * Known fish names (romanised Tamil + English).
 * The parser accepts the first token that matches any entry here.
 * If no match, it accepts the first non-keyword token as fish_name.
 */
const KNOWN_FISH = new Set([
  'vanjaram', 'vanjiram', 'kingfish',
  'sankara', 'sangara',
  'nethili', 'nathili', 'anchovy',
  'kaala', 'kala',
  'thira', 'rayfish',
  'vangada', 'mackerel',
  'prawn', 'iraal', 'chemmeen',
  'choodai', 'soodai', 'sardine',
  'kola', 'barracuda',
  'nei', 'pomfret',
  'nandu', 'crab',
  'squid', 'kanavaai',
  'tuna', 'soorai',
  'viral', 'murrel',
  'mathi',
]);

// ─────────────────────────────────────────────────────────────────
// KEYWORD SETS
// ─────────────────────────────────────────────────────────────────

const WEIGHT_UNITS   = new Set(['kilo', 'kg', 'kilogram', 'கிலோ', 'எடை']);
const RATE_ANCHORS   = new Set(['rate', 'ரேட்', 'விலை', 'price', 'at', '@', '₹', 'rs', 'rupee', 'ரூபாய்']);
const PAID_SIGNALS   = new Set(['kuduthaan', 'kudutha', 'kuduthan', 'kuduthaal', 'kuduthanga', 'pay', 'paid', 'kattinan', 'kattinaen']);
const FILLER_VERBS   = new Set(['pannaan', 'pannaanga', 'pannu', 'sonna', 'soll', 'balance', 'sollu', 'therla', 'theriyala']);

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

/** Returns true if the token is a Tamil numeral word or a pure digit string. */
function isNumericToken(token: string): boolean {
  if (/^\d+(\.\d+)?$/.test(token)) return true;
  if (ROMANISED_BASES[token] !== undefined) return true;
  if (ROMANISED_MULTIPLIERS[token] !== undefined) return true;
  if (ROMANISED_FUSED[token] !== undefined) return true;
  return false;
}

/**
 * Resolve the first valid numeric compound from a sequence of numeric tokens.
 * This drops trailing noise (e.g. "rendu aayiram 500 20" -> 2500, ignores 20).
 */
function resolveFirstCompound(tokens: string[]): number {
  if (tokens.length === 0) return 0;
  
  // Try Tamil numeral resolution first
  const tamilResult = parseRomanisedTamilNumber(tokens, 0);
  if (tamilResult !== null) {
    return tamilResult.value;
  }

  // Fallback: pure Arabic digit
  const t = tokens[0];
  if (t !== undefined && /^\d+(\.\d+)?$/.test(t)) {
    return parseFloat(t);
  }

  return 0;
}

// ─────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────

/**
 * strictVoiceParse
 *
 * Converts a raw Tamil+English mixed voice transcript into a final
 * structured sale record. Applies all Tamil number rules and produces
 * computed total and balance.
 *
 * STRICT MODE: always returns a value. Returns 0 for any field not
 * found in the transcript. Never requests confirmation.
 *
 * @param transcript  Raw STT output, e.g. "vanjaram 30 kilo rate rendu aayiram 500 ravi pathinaayiram kuduthaan"
 */
export function strictVoiceParse(transcript: string): StrictParseResult {
  const tokens = transcript
    .toLowerCase()
    .split(/\s+/)
    .map(t => t.replace(/[,.!?]+$/, ''))
    .filter(Boolean);

  let fish_name = '';
  let weight    = 0;
  let rate      = 0;
  let buyer     = '';
  let paid      = 0;

  type NumericGroup = { startIdx: number; endIdx: number; tokens: string[]; value: number };
  const numericGroups: NumericGroup[] = [];

  let i = 0;
  let rateAnchorIdx = -1;
  let paidSignalIdx = -1;

  // ── 1. Single Pass Tokenization & Context Detection ────────────────────────
  while (i < tokens.length) {
    const t = tokens[i]!;

    // Detect Fish Name (first eligible token)
    if (fish_name === '') {
      if (KNOWN_FISH.has(t)) {
        fish_name = t.charAt(0).toUpperCase() + t.slice(1);
      } else if (
        !isNumericToken(t) &&
        !WEIGHT_UNITS.has(t) &&
        !RATE_ANCHORS.has(t) &&
        !PAID_SIGNALS.has(t) &&
        !FILLER_VERBS.has(t)
      ) {
        fish_name = t.charAt(0).toUpperCase() + t.slice(1);
      }
    }

    // Detect Field Anchors
    if (RATE_ANCHORS.has(t) && rateAnchorIdx === -1) {
      rateAnchorIdx = i;
    }

    if (PAID_SIGNALS.has(t) && paidSignalIdx === -1) {
      paidSignalIdx = i;
    }

    // Collect Contiguous Numeric Groups
    if (isNumericToken(t)) {
      const startIdx = i;
      const groupTokens: string[] = [];
      while (i < tokens.length && isNumericToken(tokens[i]!)) {
        groupTokens.push(tokens[i]!);
        i++;
      }
      const value = resolveFirstCompound(groupTokens);
      numericGroups.push({ startIdx, endIdx: i - 1, tokens: groupTokens, value });
      continue; // i is now at the next non-numeric token
    }

    i++;
  }

  // ── 2. Field Assignment by Priority Rules ──────────────────────────────────

  // Weight: number before kilo/kg
  for (let idx = 0; idx < tokens.length; idx++) {
    if (WEIGHT_UNITS.has(tokens[idx]!)) {
      const weightGroup = numericGroups.find(g => g.endIdx === idx - 1);
      if (weightGroup) {
        weight = weightGroup.value;
        weightGroup.value = -1; // mark consumed
      } else if (idx + 1 < tokens.length) {
        const weightGroupNext = numericGroups.find(g => g.startIdx === idx + 1);
        if (weightGroupNext) {
          weight = weightGroupNext.value;
          weightGroupNext.value = -1;
        }
      }
      break;
    }
  }

  // Rate: numbers after "rate"
  if (rateAnchorIdx !== -1) {
    const rateGroup = numericGroups.find(g => g.startIdx === rateAnchorIdx + 1);
    if (rateGroup) {
      rate = rateGroup.value;
      rateGroup.value = -1;
    }
  }

  // Buyer: first name after rate
  if (rateAnchorIdx !== -1) {
    for (let idx = rateAnchorIdx + 1; idx < tokens.length; idx++) {
      // STOP processing after payment signal
      if (paidSignalIdx !== -1 && idx > paidSignalIdx) {
        break;
      }
      
      const t = tokens[idx]!;
      if (
        !isNumericToken(t) &&
        !WEIGHT_UNITS.has(t) &&
        !RATE_ANCHORS.has(t) &&
        !PAID_SIGNALS.has(t) &&
        !FILLER_VERBS.has(t)
      ) {
        buyer = t.charAt(0).toUpperCase() + t.slice(1);
        break;
      }
    }
  }

  // Paid: strict positional extraction
  if (paidSignalIdx !== -1) {
    // IF payment signal exists -> take LAST numeric group BEFORE signal
    const groupsBeforeSignal = numericGroups.filter(g => g.endIdx < paidSignalIdx && g.value !== -1);
    if (groupsBeforeSignal.length > 0) {
      paid = groupsBeforeSignal[groupsBeforeSignal.length - 1]!.value;
    } else {
      // EXCEPTION: If no numeric group before signal -> take FIRST numeric group AFTER signal
      const groupsAfterSignal = numericGroups.filter(g => g.startIdx > paidSignalIdx && g.value !== -1);
      if (groupsAfterSignal.length > 0) {
        paid = groupsAfterSignal[0]!.value;
      }
    }
  } else {
    // ELSE -> take LAST numeric group in entire sentence (unconsumed)
    const unconsumedGroups = numericGroups.filter(g => g.value !== -1);
    if (unconsumedGroups.length > 0) {
      paid = unconsumedGroups[unconsumedGroups.length - 1]!.value;
    }
  }

  // ── 3. Computations ────────────────────────────────────────────────────────
  const total   = parseFloat((weight * rate).toFixed(2));
  const balance = parseFloat((total - paid).toFixed(2));

  return { fish_name, weight, rate, buyer, paid, total, balance };
}
