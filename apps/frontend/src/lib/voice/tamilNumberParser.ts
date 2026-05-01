/**
 * Tamil Number Parser Utility
 *
 * Two parsers live here:
 *
 * 1. parseNumber(text, lang) — handles Tamil Unicode script (ஆயிரம் → 1000)
 *    Used for weight extraction when the agent speaks full Tamil.
 *
 * 2. parseRomanisedTamilNumber(tokens) — handles romanised Tamil speech
 *    transcribed by STT in Latin script ("aayiram", "rendu", "nooru", …).
 *    Resolves compound + additive patterns:
 *      ["rendu", "aayiram"]        → 2000  (multiplier × base)
 *      ["rendu", "aayiram", "500"] → 2500  (compound + additive)
 *      ["aayiram", "500"]          → 1500  (base + additive)
 *      ["nooru", "50"]             → 150   (base + additive)
 *    Returns null when no recognisable Tamil numeral is found.
 */

const TAMIL_NUMS: Record<string, number> = {
  "சுழியம்": 0, "பூஜ்யம்": 0,
  "ஒன்று": 1, "ஒன்னு": 1, "ஒரு": 1,
  "இரண்டு": 2, "ரெண்டு": 2, "இரு": 2,
  "மூன்று": 3, "மூணு": 3,
  "நான்கு": 4, "நாலு": 4,
  "ஐந்து": 5, "அஞ்சு": 5,
  "ஆறு": 6,
  "ஏழு": 7,
  "எட்டு": 8,
  "ஒன்பது": 9,
  "பத்து": 10,
  "பதினொன்று": 11, "பதினொன்னு": 11,
  "பனிரெண்டு": 12, "பன்னிரண்டு": 12,
  "பதின்மூன்று": 13, "பதின்மூணு": 13,
  "பதினான்கு": 14, "பதினாலு": 14,
  "பதினைந்து": 15, "பதினஞ்சு": 15,
  "பതിനാறு": 16,
  "பதினேழு": 17,
  "பதினெட்டு": 18,
  "பத்தொன்பது": 19,
  "இருபது": 20,
  "முப்பது": 30,
  "நாற்பது": 40,
  "ஐம்பது": 50,
  "அறுபது": 60,
  "எழுபது": 70,
  "எண்பது": 80,
  "தொண்ணூறு": 90,
  "நூறு": 100,
  "ஆயிரம்": 1000,
  "லட்சம்": 100000,
  "இலட்சம்": 100000,
  "கோடி": 10000000,
};

const TAMIL_ORDINALS: Record<string, number> = {
  "முதல்": 1,
  "முதலாவது": 1,
  "இரண்டாவது": 2,
  "ரெண்டாவது": 2,
  "மூன்றாவது": 3,
  "மூணாவது": 3,
  "நான்காவது": 4,
  "நாலாவது": 4,
  "ஐந்தாவது": 5,
  "அஞ்சாவது": 5,
};

const ENGLISH_NUMS: Record<string, number> = {
  "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
  "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19,
  "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
  "hundred": 100, "thousand": 1000, "lakh": 100000,
};

export const parseNumber = (text: string, lang: 'ta' | 'en'): number | null => {
  const words = text.toLowerCase().split(/[\s-]+/);
  let total = 0;
  let currentGroup = 0;
  let found = false;
  let decimalMode = false;
  let decimalMultiplier = 0.1;

  const dictionary = lang === 'ta' ? TAMIL_NUMS : ENGLISH_NUMS;
  const ordinals = lang === 'ta' ? TAMIL_ORDINALS : {};
  const pointWords = ["point", "புள்ளி", "புள்ளி.", "."];

  for (const word of words) {
    if (!word) continue;
    
    if (pointWords.includes(word)) {
      decimalMode = true;
      found = true;
      continue;
    }

    if (dictionary[word] !== undefined || !isNaN(parseFloat(word))) {
      const val = dictionary[word] !== undefined ? dictionary[word] : parseFloat(word);
      if (decimalMode) {
        total += val * decimalMultiplier;
        decimalMultiplier *= 0.1;
      } else {
        if (val >= 1000) {
          total += (currentGroup || 1) * val;
          currentGroup = 0;
        } else if (val >= 100) {
          currentGroup = (currentGroup || 1) * val;
        } else {
          currentGroup += val;
        }
      }
      found = true;
    } else if (ordinals[word] !== undefined) {
      currentGroup += ordinals[word];
      found = true;
    }
  }

  total += currentGroup;
  return found ? total : null;
};

// ─────────────────────────────────────────────────────────────────
// ROMANISED TAMIL NUMBER PARSER
// Resolves STT output in Latin script: "rendu aayiram 500" → 2500
// ─────────────────────────────────────────────────────────────────

/**
 * Map of romanised Tamil base-number words → numeric value.
 * These are the denomination anchors a speaker uses as the
 * "place value" (100s, 1000s, lakhs).
 */
export const ROMANISED_BASES: Record<string, number> = {
  // Tens
  pathu: 10, patthu: 10, pattu: 10,
  // Hundreds
  nooru: 100, nuru: 100, noothu: 100,
  // Thousands
  aayiram: 1000, aairam: 1000, ayiram: 1000, aayram: 1000, aaiyiram: 1000,
  // Lakhs
  latcham: 100000, laksham: 100000, lacham: 100000,
};

/**
 * Map of romanised Tamil multiplier words → numeric value.
 * Multipliers precede a base: "rendu aayiram" = 2 × 1000 = 2000.
 */
export const ROMANISED_MULTIPLIERS: Record<string, number> = {
  onnu: 1, oru: 1,
  rendu: 2, randu: 2, irandu: 2,
  moonu: 3, moonnu: 3, munnu: 3,
  naalu: 4, naangu: 4,
  aanju: 5, anju: 5,
  aaru: 6,
  yezhu: 7, ezhu: 7,
  ettu: 8,
  ombodhu: 9, ombodu: 9,
  patthu: 10, pathu: 10,
  padhinonnu: 11,
  pannirendu: 12,
  pathimoonu: 13,
  pathinaalu: 14,
  pathinaanju: 15, pathinanju: 15,
  pathinaaru: 16,
  pathinezhu: 17,
  pathinettu: 18,
  pathombodhu: 19,
  irubadhu: 20, irupadu: 20,
  muppadu: 30,
  naarpadu: 40,
  ambadu: 50, aimbadu: 50,
  arubadu: 60,
  ezhubadu: 70,
  embadu: 80,
  thonnooru: 90,
};

/**
 * Common compound fused forms (spoken as one word by some speakers).
 * Checked FIRST before token-by-token resolution to handle fused speech.
 * e.g. "pathinaayiram" (10×1000 = 10,000) is heard as a single token.
 */
export const ROMANISED_FUSED: Record<string, number> = {
  // Hundreds
  ainnuuru: 500, ainnuru: 500, ainnooru: 500,
  irunooru: 200, munnuuru: 300,
  // Thousands  
  pathinaayiram: 10000, pathinayiram: 10000, pathinaairam: 10000,
  irubathaayiram: 20000, irupathaayiram: 20000,
  muppathaayiram: 30000,
  // Formal compound: "aayirathu ainnooru" = 1500
  'aayirathu ainnooru': 1500, 'aayirathu ainnuru': 1500,
  'aayirathu irunooru': 1200, 'aayirathu munnuuru': 1300,
};

export interface RomanisedParseResult {
  /** The resolved numeric value. */
  value: number;
  /** Number of tokens consumed from the start of the input array. */
  tokensConsumed: number;
  /** True when the result is unambiguous (pure Tamil form). */
  isAmbiguous: boolean;
  /** Human-readable trace of how the value was resolved. */
  trace: string;
}

/**
 * parseRomanisedTamilNumber
 *
 * Scans a token array (already lowercased, split on whitespace) and
 * resolves the FIRST Tamil numeral group found, along with any
 * immediately adjacent additive English integer.
 *
 * Resolution priority:
 *   1. Fused compound words   ("pathinaayiram" → 10000)
 *   2. Multiplier × Base      ("rendu aayiram" → 2000)
 *   3. Base only              ("aayiram" → 1000)
 *   4. Additive trailing int  (result + parseFloat(nextToken) if it is a
 *                              pure digit string and < base value)
 *
 * @param tokens  Lowercased token array, e.g. ["rate","rendu","aayiram","500","muthu"]
 * @param startAt Index to begin scanning from (default 0)
 * @returns RomanisedParseResult or null if no Tamil numeral found
 */
export function parseRomanisedTamilNumber(
  tokens: string[],
  startAt = 0,
): RomanisedParseResult | null {
  const t0 = tokens[startAt];
  if (!t0) return null;

  // ── 1. Single-token fused check (must come before multi-word to avoid
  //       the multi-word loop reporting tokensConsumed > 1 for a 1-word match)
  if (ROMANISED_FUSED[t0] !== undefined) {
    return {
      value          : ROMANISED_FUSED[t0],
      tokensConsumed : 1,
      isAmbiguous    : false,
      trace          : `fused("${t0}") → ${ROMANISED_FUSED[t0]}`,
    };
  }

  // ── 2. Multi-word fused forms (2-token and 3-token lookahead only) ────────
  for (let len = 3; len >= 2; len--) {
    const slice = tokens.slice(startAt, startAt + len).join(' ');
    if (ROMANISED_FUSED[slice] !== undefined) {
      const value = ROMANISED_FUSED[slice];
      return {
        value,
        tokensConsumed : len,
        isAmbiguous    : false,
        trace          : `fused("${slice}") → ${value}`,
      };
    }
  }

  // ── 3. Multiplier × Base compound ────────────────────────────────────────
  const multiplierVal = ROMANISED_MULTIPLIERS[t0];
  const t1 = tokens[startAt + 1];

  if (multiplierVal !== undefined && t1 !== undefined) {
    const baseVal = ROMANISED_BASES[t1];
    if (baseVal !== undefined) {
      const compound = multiplierVal * baseVal;
      let tokensConsumed = 2;
      let value = compound;
      let isAmbiguous = false;
      let trace = `multiplier("${t0}"=${multiplierVal}) × base("${t1}"=${baseVal}) = ${compound}`;

      // ── 4. Additive trailing integer after compound ──────────────────────
      const t2 = tokens[startAt + 2];
      if (t2 !== undefined) {
        const additiveCandidate = parseFloat(t2);
        const isPureNumeric = /^\d+(\.\d+)?$/.test(t2);
        if (isPureNumeric && additiveCandidate < compound) {
          value = compound + additiveCandidate;
          tokensConsumed = 3;
          isAmbiguous = true;
          trace += ` + additive("${t2}"=${additiveCandidate}) = ${value}`;
        }
      }

      return { value, tokensConsumed, isAmbiguous, trace };
    }
  }

  // ── 5. Base only (no preceding multiplier) ────────────────────────────────
  const baseVal0 = ROMANISED_BASES[t0];
  if (baseVal0 !== undefined) {
    let tokensConsumed = 1;
    let value = baseVal0;
    let isAmbiguous = false;
    let trace = `base("${t0}"=${baseVal0})`;

    const t1next = tokens[startAt + 1];
    if (t1next !== undefined) {
      const additiveCandidate = parseFloat(t1next);
      const isPureNumeric = /^\d+(\.\d+)?$/.test(t1next);
      if (isPureNumeric && additiveCandidate < baseVal0) {
        value = baseVal0 + additiveCandidate;
        tokensConsumed = 2;
        isAmbiguous = true;
        trace += ` + additive("${t1next}"=${additiveCandidate}) = ${value}`;
      }
    }

    return { value, tokensConsumed, isAmbiguous, trace };
  }

  return null;
}
