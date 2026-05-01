/**
 * Strict Voice Parser Test Suite
 * Tests the strictVoiceParse() engine against all Tamil number rules,
 * field mapping rules, and calculated fields.
 */

import { strictVoiceParse } from '@/lib/voice/strictVoiceParser';

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const parse = (t: string) => strictVoiceParse(t);

// ─────────────────────────────────────────────────────────────────
// 1. FISH NAME — Rule 1
// ─────────────────────────────────────────────────────────────────

describe('Rule 1 — Fish Name extraction', () => {

  it('Known fish first word → correct fish_name', () => {
    expect(parse('vanjaram 20 kilo rate 600').fish_name).toBe('Vanjaram');
  });

  it('Unknown fish name (unregistered) → capitalised as-is', () => {
    expect(parse('koduva 10 kilo rate 300').fish_name).toBe('Koduva');
  });

  it('Tamil fish alias → capitalised first token', () => {
    expect(parse('nethili 5 kilo rate 100').fish_name).toBe('Nethili');
  });
});

// ─────────────────────────────────────────────────────────────────
// 2. WEIGHT — Rule 2
// ─────────────────────────────────────────────────────────────────

describe('Rule 2 — Weight extraction (number before kilo)', () => {

  it('"20 kilo" → weight = 20', () => {
    expect(parse('vanjaram 20 kilo rate 600').weight).toBe(20);
  });

  it('"50 kg" → weight = 50', () => {
    expect(parse('sankara 50 kg rate 500').weight).toBe(50);
  });

  it('"15.5 kilo" → weight = 15.5', () => {
    expect(parse('nethili 15.5 kilo rate 100').weight).toBe(15.5);
  });

  it('"100 kilo" → weight = 100', () => {
    expect(parse('vanjaram 100 kilo rate 600').weight).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────
// 3. RATE — Rule 3 (Tamil number rules critical)
// ─────────────────────────────────────────────────────────────────

describe('Rule 3 — Rate extraction with Tamil number rules', () => {

  // English-only
  it('"rate 600" → rate = 600', () => {
    expect(parse('vanjaram 10 kilo rate 600').rate).toBe(600);
  });

  // RULE 1: rendu aayiram → 2 × 1000 = 2000
  it('RULE 1: "rate rendu aayiram" → rate = 2000', () => {
    expect(parse('sankara 30 kilo rate rendu aayiram ravi 5000 kuduthaan').rate).toBe(2000);
  });

  // RULE 2: nooru 50 → 100 + 50 = 150
  it('RULE 2: "rate nooru 50" → rate = 150', () => {
    expect(parse('nethili 15 kilo rate nooru 50 senthil 1000 kuduthaan').rate).toBe(150);
  });

  // RULE 3: rendu aayiram 500 → 2000 + 500 = 2500
  it('RULE 3: "rate rendu aayiram 500" → rate = 2500', () => {
    expect(parse('sankara 30 kilo rate rendu aayiram 500 muthu 10000 kuduthaan').rate).toBe(2500);
  });

  // RULE 4: always combine Tamil + English
  it('RULE 4: "rate aayiram 500" → rate = 1500', () => {
    expect(parse('vanjaram 20 kilo rate aayiram 500 ravi 10000 kuduthaan').rate).toBe(1500);
  });

  it('"rate moonu aayiram" → rate = 3000', () => {
    expect(parse('prawn 5 kilo rate moonu aayiram kumar 10000 kuduthaan').rate).toBe(3000);
  });

  it('"rate pathinaayiram" (fused) → rate = 10000', () => {
    expect(parse('vanjaram 10 kilo rate pathinaayiram ravi 50000 kuduthaan').rate).toBe(10000);
  });

  it('"rate nooru" → rate = 100', () => {
    expect(parse('choodai 25 kilo rate nooru murugan 1000 kuduthaan').rate).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────
// 4. PAID — Rule 4
// ─────────────────────────────────────────────────────────────────

describe('Rule 4 — Paid extraction (numbers before kuduthaan/pay)', () => {

  it('"5000 kuduthaan" → paid = 5000', () => {
    expect(parse('vanjaram 10 kilo rate 600 ravi 5000 kuduthaan').paid).toBe(5000);
  });

  it('"pathinaayiram kuduthaan" (fused 10000) → paid = 10000', () => {
    expect(parse('sankara 30 kilo rate 500 muthu pathinaayiram kuduthaan').paid).toBe(10000);
  });

  it('"rendu aayiram kuduthaan" → paid = 2000', () => {
    expect(parse('nethili 5 kilo rate 150 senthil rendu aayiram kuduthaan').paid).toBe(2000);
  });

  it('"rendu aayiram 500 kuduthaan" → paid = 2500', () => {
    expect(parse('vanjaram 20 kilo rate 600 ravi rendu aayiram 500 kuduthaan').paid).toBe(2500);
  });

  it('"8000 pay pannaan" → paid = 8000', () => {
    expect(parse('kaala 25 kilo rate 400 raju 8000 pay').paid).toBe(8000);
  });

  it('"aayiram 500 kuduthaan" → paid = 1500', () => {
    expect(parse('choodai 10 kilo rate 80 muthu aayiram 500 kuduthaan').paid).toBe(1500);
  });

  // EXCEPTION RULE: Payment signal BEFORE number
  it('EXCEPTION: "kuduthaan 5000" → paid = 5000 (first group after signal)', () => {
    expect(parse('vanjaram 10 kilo rate 600 ravi kuduthaan 5000').paid).toBe(5000);
  });

  it('EXCEPTION: "pay 4000" → paid = 4000 (first group after signal)', () => {
    expect(parse('sankara 5 kilo rate 500 senthil pay 4000').paid).toBe(4000);
  });
});

// ─────────────────────────────────────────────────────────────────
// 5. TOTAL & BALANCE — Derived fields
// ─────────────────────────────────────────────────────────────────

describe('Derived fields — total = weight × rate, balance = total - paid', () => {

  it('10 × 600 = 6000 total; paid 4000 → balance 2000', () => {
    const r = parse('vanjaram 10 kilo rate 600 ravi 4000 kuduthaan');
    expect(r.total).toBe(6000);
    expect(r.balance).toBe(2000);
  });

  it('30 × 2500 = 75000 total; paid 10000 → balance 65000', () => {
    const r = parse('sankara 30 kilo rate rendu aayiram 500 muthu pathinaayiram kuduthaan');
    expect(r.total).toBe(75000);
    expect(r.balance).toBe(65000);
  });

  it('15 × 150 = 2250 total; paid rendu aayiram (2000) → balance 250', () => {
    const r = parse('nethili 15 kilo rate nooru 50 senthil rendu aayiram kuduthaan');
    expect(r.total).toBe(2250);
    expect(r.balance).toBe(250);
  });

  it('Fully paid — balance = 0', () => {
    const r = parse('vanjaram 10 kilo rate 600 ravi 6000 kuduthaan');
    expect(r.total).toBe(6000);
    expect(r.paid).toBe(6000);
    expect(r.balance).toBe(0);
  });

  it('No paid → balance = total', () => {
    const r = parse('vanjaram 10 kilo rate 600');
    expect(r.paid).toBe(0);
    expect(r.balance).toBe(r.total);
  });
});

// ─────────────────────────────────────────────────────────────────
// 6. FULL TRANSCRIPT INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────────

describe('Full transcript integration', () => {

  it('Clean English transcript', () => {
    const r = parse('vanjaram 10 kilo rate 600 buyer ravi 4000 kuduthaan');
    expect(r.fish_name).toBe('Vanjaram');
    expect(r.weight).toBe(10);
    expect(r.rate).toBe(600);
    expect(r.paid).toBe(4000);
    expect(r.total).toBe(6000);
    expect(r.balance).toBe(2000);
  });

  it('Full Tamil numeral transcript — rendu aayiram 500 rate, pathinaayiram paid', () => {
    const r = parse('sankara 30 kilo rate rendu aayiram 500 muthu pathinaayiram kuduthaan');
    expect(r.fish_name).toBe('Sankara');
    expect(r.weight).toBe(30);
    expect(r.rate).toBe(2500);
    expect(r.paid).toBe(10000);
    expect(r.total).toBe(75000);
    expect(r.balance).toBe(65000);
  });

  it('Mixed Tamil base + English additive', () => {
    const r = parse('kaala 25 kilo rate nooru 50 senthil rendu aayiram 500 kuduthaan');
    expect(r.fish_name).toBe('Kaala');
    expect(r.weight).toBe(25);
    expect(r.rate).toBe(150);
    expect(r.paid).toBe(2500);
    expect(r.total).toBe(3750);
    expect(r.balance).toBe(1250);
  });

  it('Simple transcript with "pay" signal', () => {
    const r = parse('nethili 20 kilo rate 80 raju 1000 pay');
    expect(r.fish_name).toBe('Nethili');
    expect(r.weight).toBe(20);
    expect(r.rate).toBe(80);
    expect(r.paid).toBe(1000);
    expect(r.total).toBe(1600);
    expect(r.balance).toBe(600);
  });

  it('Prawn high rate — moonu aayiram', () => {
    const r = parse('prawn 5 kilo rate moonu aayiram kumar 8000 kuduthaan');
    expect(r.fish_name).toBe('Prawn');
    expect(r.weight).toBe(5);
    expect(r.rate).toBe(3000);
    expect(r.paid).toBe(8000);
    expect(r.total).toBe(15000);
    expect(r.balance).toBe(7000);
  });

  it('No rate in transcript → rate = 0, total = 0', () => {
    const r = parse('vanjaram 10 kilo ravi 1000 kuduthaan');
    expect(r.weight).toBe(10);
    expect(r.rate).toBe(0);
    expect(r.total).toBe(0);
  });

  it('No weight in transcript → weight = 0', () => {
    const r = parse('vanjaram rate 600 ravi 1000 kuduthaan');
    expect(r.weight).toBe(0);
    expect(r.rate).toBe(600);
  });

  it('Noise handling: trailing numbers after payment signal are ignored', () => {
    const r = parse('vanjaram 10 kilo rate 600 ravi 5000 kuduthaan 20 30');
    expect(r.paid).toBe(5000); // 5000 is before kuduthaan. 20 and 30 are ignored.
  });

  it('Noise handling: numbers after EXCEPTION payment rule are ignored', () => {
    const r = parse('sankara 5 kilo rate 500 senthil pay 4000 500');
    expect(r.paid).toBe(4000); // 4000 is first after pay. 500 is ignored.
  });
});
