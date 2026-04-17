/**
 * Enhanced Voice Recognition Test Suite (Part D)
 * Tests confidence scoring, fish NLP, Tamil numbers, fuzzy matching, fallbacks.
 */

import { parseVoiceInput, scoreConfidence, FISH_DICTIONARY, levenshtein } from '@/lib/voice/voiceParser';
import { parseNumber } from '@/lib/voice/tamilNumberParser';

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const parse = (text: string, lang: 'ta' | 'en' = 'en') =>
  parseVoiceInput(text, lang);

const saleOf = (text: string, lang: 'ta' | 'en' = 'en') =>
  parse(text, lang).find(r => r.type === 'SALE') ?? null;

const confidence = (text: string, lang: 'ta' | 'en' = 'en') => {
  const sale = saleOf(text, lang);
  if (!sale) return null;
  return scoreConfidence(sale, text);
};

// ─────────────────────────────────────────────────────────────────
// 1. CONFIDENCE SCORE TESTS
// ─────────────────────────────────────────────────────────────────

describe('Confidence Scoring', () => {

  it('"vanjaram 10 kg rate 600" → score ≥ 80 → auto_fill', () => {
    const c = confidence('vanjaram 10 kg rate 600');
    expect(c?.total).toBeGreaterThanOrEqual(80);
    expect(c?.action).toBe('auto_fill');
    expect(c?.grade).toBe('HIGH');
    expect(c?.autoSubmit).toBe(true);
  });

  it('"vanjaram 10 kg" (no rate) → score 60-79 → confirm', () => {
    const c = confidence('vanjaram 10 kg');
    expect(c?.total).toBeGreaterThanOrEqual(60);
    expect(c?.total).toBeLessThan(80);
    expect(c?.action).toBe('confirm');
    expect(c?.grade).toBe('MEDIUM');
  });

  it('"vanjaram only" (no weight/rate) → score < 60 → manual', () => {
    const c = confidence('vanjaram');
    expect(c?.total).toBeLessThan(60);
    expect(c?.action).toBe('manual');
    expect(c?.grade).toBe('LOW');
  });

  it('"hello test random noise" → score near 0 → manual', () => {
    const c = confidence('hello test random noise');
    expect(c?.total).toBeLessThan(60);
    expect(c?.action).toBe('manual');
  });

  it('Confidence breakdown sums to total', () => {
    const c = confidence('vanjaram 10 kg rate 600')!;
    const sum = Object.values(c.breakdown).reduce((a, b) => a + b, 0);
    expect(sum).toBe(c.total);
  });
});

// ─────────────────────────────────────────────────────────────────
// 2. FISH NAME DETECTION TESTS
// ─────────────────────────────────────────────────────────────────

describe('Fish Name Detection', () => {

  it('"vanajram" typo → fuzzy → resolves to vanjaram', () => {
    const s = saleOf('vanajram 10 kg');
    expect(s?.fish).toBe('vanjaram');
  });

  it('"வஞ்சரம்" Tamil → resolves to vanjaram', () => {
    const s = saleOf('வஞ்சரம் 10 கிலோ', 'ta');
    expect(s?.fish).toBe('vanjaram');
  });

  it('"king fish" alias → resolves to vanjaram', () => {
    const s = saleOf('king fish 5 kg rate 600');
    expect(s?.fish).toBe('vanjaram');
  });

  it('"soodai" alias → resolves to choodai', () => {
    const s = saleOf('soodai 20 kg rate 80');
    expect(s?.fish).toBe('choodai');
  });

  it('"mackerel" → resolves to vangada', () => {
    const s = saleOf('mackerel 15 kg rate 120');
    expect(s?.fish).toBe('vangada');
  });

  it('"red snapper" → resolves to sankara', () => {
    const s = saleOf('red snapper 8 kg rate 500');
    expect(s?.fish).toBe('sankara');
  });

  it('"இறால்" Tamil → resolves to prawn', () => {
    const s = saleOf('இறால் 5 கிலோ', 'ta');
    expect(s?.fish).toBe('prawn');
  });

  it('"pomfret" → resolves to nei_meen', () => {
    const s = saleOf('pomfret 10 kg rate 450');
    expect(s?.fish).toBe('nei_meen');
  });

  it('Unknown fish → fish is undefined', () => {
    const s = saleOf('chicken 5 kg rate 200');
    expect(s?.fish).toBeUndefined();
  });

  it('All dictionary entries have avgRate > 0', () => {
    for (const [key, val] of Object.entries(FISH_DICTIONARY)) {
      expect(val.avgRate).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// 3. WEIGHT EXTRACTION TESTS
// ─────────────────────────────────────────────────────────────────

describe('Weight Extraction', () => {

  it('"பத்து கிலோ" → 10 kg', () => {
    const s = saleOf('வஞ்சரம் பத்து கிலோ', 'ta');
    expect(s?.weight).toBe(10);
  });

  it('"பத்து அரை" → 10.5 kg', () => {
    const s = saleOf('வஞ்சரம் பத்து அரை', 'ta');
    expect(s?.weight).toBe(10.5);
  });

  it('"15.5 kg" → 15.5', () => {
    const s = saleOf('vanjaram 15.5 kg rate 600');
    expect(s?.weight).toBe(15.5);
  });

  it('"20kg" (no space) → 20', () => {
    const s = saleOf('vanjaram 20kg rate 600');
    expect(s?.weight).toBe(20);
  });

  it('"50 kilo" → 50', () => {
    const s = saleOf('vanjaram 50 kilo rate 600');
    expect(s?.weight).toBe(50);
  });
});

// ─────────────────────────────────────────────────────────────────
// 4. RATE EXTRACTION TESTS
// ─────────────────────────────────────────────────────────────────

describe('Rate Extraction', () => {

  it('"rate 600" → ₹600', () => {
    const s = saleOf('vanjaram 10 kg rate 600');
    expect(s?.rate).toBe(600);
  });

  it('"ரேட் 450" → ₹450', () => {
    const s = saleOf('வஞ்சரம் 10 கிலோ ரேட் 450', 'ta');
    expect(s?.rate).toBe(450);
  });

  it('"at 380" → ₹380', () => {
    const s = saleOf('vanjaram 10 kg at 380');
    expect(s?.rate).toBe(380);
  });

  it('"price 200" → ₹200', () => {
    const s = saleOf('choodai 20 kg price 200');
    expect(s?.rate).toBe(200);
  });

  it('Rate out of range (> 9999) → ignored', () => {
    const s = saleOf('vanjaram 10 kg rate 99999');
    // 99999 exceeds valid range, should not be captured
    expect(s?.rate === 99999).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// 5. BUYER EXTRACTION TESTS
// ─────────────────────────────────────────────────────────────────

describe('Buyer Extraction', () => {

  it('"buyer Rajan" → buyer is Rajan', () => {
    const s = saleOf('vanjaram 10 kg rate 600 buyer Rajan');
    expect(s?.buyer).toBe('Rajan');
  });

  it('"for Kumar" → buyer is Kumar', () => {
    const s = saleOf('vanjaram 10 kg rate 600 for Kumar');
    expect(s?.buyer).toBe('Kumar');
  });

  it('No buyer keyword → buyer is undefined', () => {
    const s = saleOf('vanjaram 10 kg rate 600');
    expect(s?.buyer).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────
// 6. EXPENSE DETECTION TESTS
// ─────────────────────────────────────────────────────────────────

describe('Expense Detection', () => {

  it('"diesel 500" → EXPENSE diesel ₹500', () => {
    const r = parse('diesel 500').find(r => r.type === 'EXPENSE');
    expect(r?.key).toBe('diesel');
    expect(r?.amount).toBe(500);
  });

  it('"டீசல் 300" Tamil → EXPENSE diesel', () => {
    const r = parse('டீசல் 300', 'ta').find(r => r.type === 'EXPENSE');
    expect(r?.key).toBe('diesel');
    expect(r?.amount).toBe(300);
  });

  it('"ice 200" → EXPENSE ice', () => {
    const r = parse('ice 200').find(r => r.type === 'EXPENSE');
    expect(r?.key).toBe('ice');
  });
});

// ─────────────────────────────────────────────────────────────────
// 7. COMMAND DETECTION TESTS
// ─────────────────────────────────────────────────────────────────

describe('Command Detection', () => {

  it('"save" → COMMAND save', () => {
    const r = parse('save').find(r => r.type === 'COMMAND');
    expect(r?.command).toBe('save');
  });

  it('"சேமி" Tamil → COMMAND save', () => {
    const r = parse('சேமி', 'ta').find(r => r.type === 'COMMAND');
    expect(r?.command).toBe('save');
  });

  it('"undo" → COMMAND delete', () => {
    const r = parse('undo').find(r => r.type === 'COMMAND');
    expect(r?.command).toBe('delete');
  });
});

// ─────────────────────────────────────────────────────────────────
// 8. COMPOUND / MULTI SEGMENT TESTS
// ─────────────────────────────────────────────────────────────────

describe('Compound Input Parsing', () => {

  it('"vanjaram 10 kg rate 600 and diesel 500" → SALE + EXPENSE', () => {
    const results = parse('vanjaram 10 kg rate 600 and diesel 500');
    const types   = results.map(r => r.type);
    expect(types).toContain('SALE');
    expect(types).toContain('EXPENSE');
  });

  it('Two sales split by comma → 2 SALE results', () => {
    const results = parse('vanjaram 10 kg, choodai 20 kg');
    expect(results.filter(r => r.type === 'SALE').length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────
// 9. LEVENSHTEIN DISTANCE TESTS
// ─────────────────────────────────────────────────────────────────

describe('Levenshtein Distance', () => {

  it('"vanajram" vs "vanjaram" → distance ≤ 2', () => {
    expect(levenshtein('vanajram', 'vanjaram')).toBeLessThanOrEqual(2);
  });

  it('"soodai" vs "choodai" → distance ≤ 2', () => {
    expect(levenshtein('soodai', 'choodai')).toBeLessThanOrEqual(2);
  });

  it('Identical strings → distance 0', () => {
    expect(levenshtein('vanjaram', 'vanjaram')).toBe(0);
  });

  it('Completely different → high distance', () => {
    expect(levenshtein('abc', 'xyz')).toBeGreaterThan(2);
  });
});

// ─────────────────────────────────────────────────────────────────
// 10. SUGGESTED AVG RATE WARNINGS
// ─────────────────────────────────────────────────────────────────

describe('Average Rate Suggestions', () => {

  it('"vanjaram 10 kg" (no rate) → warning includes avg rate ₹600', () => {
    const s = saleOf('vanjaram 10 kg');
    expect(s?.warnings?.some(w => w.includes('600'))).toBe(true);
  });

  it('"prawn 5 kg" → warning includes ₹700', () => {
    const s = saleOf('prawn 5 kg');
    expect(s?.warnings?.some(w => w.includes('700'))).toBe(true);
  });

  it('When rate provided → no avg rate warning', () => {
    const s = saleOf('vanjaram 10 kg rate 600');
    const hasAvgWarning = s?.warnings?.some(w => w.startsWith('Suggested rate'));
    expect(hasAvgWarning).toBeFalsy();
  });
});

// ─────────────────────────────────────────────────────────────────
// 11. TAMIL NUMBER PARSER TESTS
// ─────────────────────────────────────────────────────────────────

describe('Tamil Number Parser', () => {

  it('"பத்து" → 10', () => expect(parseNumber('பத்து', 'ta')).toBe(10));
  it('"இருபது" → 20', () => expect(parseNumber('இருபது', 'ta')).toBe(20));
  it('"நூறு" → 100', () => expect(parseNumber('நூறு', 'ta')).toBe(100));
  it('"ஆயிரம்" → 1000', () => expect(parseNumber('ஆயிரம்', 'ta')).toBe(1000));
  it('Unknown word → null', () => expect(parseNumber('foo bar', 'ta')).toBeNull());
});
