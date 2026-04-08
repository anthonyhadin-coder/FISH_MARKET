/**
 * fishPatterns.ts — Master Fish Profile Database
 * Tamil Nadu Harbor Fish — Complete NLP Pattern Database
 *
 * Covers:
 *  - All Tamil regional dialect variants
 *  - English standard + phonetic spellings
 *  - Boat agent slang & shortcuts
 *  - Confused-with pairs for disambiguation
 *  - Regex speech patterns
 *  - Market price ranges for context resolution
 *  - Frequency weights for fallback ranking
 */

export interface FishProfile {
  id           : string;
  tamilNames   : string[];
  englishNames : string[];
  boatSlang    : string[];
  phoneticForms: string[];
  confusedWith : string[];
  patterns     : RegExp[];
  priceRange   : [number, number];
  frequency    : 'very_high' | 'high' | 'medium' | 'low';
}

export const FISH_PROFILES: FishProfile[] = [

  // ─── VANJARAM — King Fish / Seer Fish ────────────────────────────────
  {
    id          : 'vanjaram',
    tamilNames  : ['வஞ்சரம்', 'வஞ்சிரம்', 'வஞ்சரா', 'வஞ்சிர மீன்'],
    englishNames: ['vanjaram', 'king fish', 'kingfish', 'seer fish', 'seerfish',
                   'king seer', 'spanish mackerel'],
    boatSlang   : ['king', 'vanjara', 'vanjarm', 'sword fish', 'sword', 'vj', 'kinga'],
    phoneticForms: ['vanjaram', 'vunjaram', 'wanjaram', 'vanjram', 'vanjarum',
                    'banjarum', 'vanjaro', 'wangaram', 'vanajram', 'vanjaram'],
    confusedWith: ['vangada', 'sankara'],
    patterns    : [
      /v[ao]n[jg][ae]r[ao]m?/i,
      /king\s*fish/i,
      /seer\s*fish/i,
      /sword\s*fish/i,
    ],
    priceRange  : [400, 900],
    frequency   : 'very_high',
  },

  // ─── THIRA — Ray Fish / Stingray ──────────────────────────────────────
  {
    id          : 'thira',
    tamilNames  : ['திரா', 'திறா', 'திரா மீன்', 'திருக்கை'],
    englishNames: ['thira', 'ray fish', 'sting ray', 'stingray', 'skate fish', 'eagle ray'],
    boatSlang   : ['thiru', 'thira fish', 'ray', 'flat fish', 'tira', 'thera'],
    phoneticForms: ['thira', 'theera', 'thiru', 'tira', 'thera', 'theara', 'dhira', 'dhiru'],
    confusedWith: ['tilapia', 'viral'],
    patterns    : [
      /th[ie]r[au]/i,
      /ray\s*fish/i,
      /sting\s*ray/i,
      /திர[ா]/,
    ],
    priceRange  : [100, 250],
    frequency   : 'very_high',
  },

  // ─── VANGADA — Indian Mackerel ───────────────────────────────────────
  {
    id          : 'vangada',
    tamilNames  : ['வங்கடா', 'வாங்கடா', 'வங்கட மீன்', 'கானாங்கெழுத்தி'],
    englishNames: ['vangada', 'mackerel', 'indian mackerel', 'short mackerel'],
    boatSlang   : ['bangda', 'bangara', 'wangada', 'vangad', 'makeral', 'mac'],
    phoneticForms: ['vangada', 'wangada', 'bangada', 'vangata', 'vangara', 'wangara', 'bangata'],
    confusedWith: ['vanjaram', 'sankara'],
    patterns    : [
      /v[ao]ng[ao]d[ao]/i,
      /mackerel/i,
      /bangd[ao]/i,
    ],
    priceRange  : [80, 180],
    frequency   : 'very_high',
  },

  // ─── SANKARA — Red Snapper ───────────────────────────────────────────
  {
    id          : 'sankara',
    tamilNames  : ['சங்கரா', 'சங்கர மீன்', 'செம்மீன்', 'சங்கரன்'],
    englishNames: ['sankara', 'red snapper', 'snapper', 'ruby snapper', 'crimson snapper'],
    boatSlang   : ['red fish', 'sangara', 'sankaram', 'red', 'sankar'],
    phoneticForms: ['sankara', 'sangara', 'sankaram', 'shangara', 'sankra', 'sangra'],
    confusedWith: ['vanjaram', 'vangada'],
    patterns    : [
      /s[ae]n[gk][ae]r[ao]/i,
      /red\s*snapper/i,
      /snapper/i,
    ],
    priceRange  : [350, 700],
    frequency   : 'high',
  },

  // ─── PRAWN — Iraal / Chemmeen ────────────────────────────────────────
  {
    id          : 'prawn',
    tamilNames  : ['இறால்', 'இறால் மீன்', 'செம்மீன்', 'ஆறல்'],
    englishNames: ['prawn', 'shrimp', 'tiger prawn', 'king prawn', 'chemmeen', 'jumbo prawn'],
    boatSlang   : ['iraal', 'chembu', 'chemmeen', 'tiger', 'jinga', 'jhinga'],
    phoneticForms: ['prawn', 'prown', 'praan', 'iraal', 'iraaal', 'eeraal', 'jhinga', 'jinga',
                    'chemeen', 'chemmeen'],
    confusedWith: ['crab'],
    patterns    : [
      /pr[ao]{1,2}n/i,
      /shrimp/i,
      /இறால்/,
      /chemmeen/i,
      /tiger\s*prawn/i,
    ],
    priceRange  : [400, 1200],
    frequency   : 'very_high',
  },

  // ─── CHOODAI — Sprat / Sardine ──────────────────────────────────────
  {
    id          : 'choodai',
    tamilNames  : ['சூடை', 'சூடை மீன்', 'நெத்திலி', 'கோலி'],
    englishNames: ['choodai', 'sprat', 'sardine', 'whitebait', 'anchovy', 'herring'],
    boatSlang   : ['soodai', 'chudai', 'chuda', 'nethal', 'nethili', 'small fish', 'kozhi'],
    phoneticForms: ['choodai', 'soodai', 'chudai', 'chudaa', 'shoodai', 'suda', 'chooda'],
    confusedWith: ['nethili'],
    patterns    : [
      /ch[ou]{1,2}d[ae]i?/i,
      /s[ou]{1,2}d[ae]i?/i,
      /sardine/i,
      /sprat/i,
      /சூடை/,
    ],
    priceRange  : [40, 120],
    frequency   : 'very_high',
  },

  // ─── NEI MEEN — Pomfret / Butter Fish ─────────────────────────────
  {
    id          : 'nei_meen',
    tamilNames  : ['நெய் மீன்', 'நெய்மீன்', 'வெண்மீன்', 'வாவல்'],
    englishNames: ['nei meen', 'pomfret', 'white pomfret', 'butter fish', 'silver pomfret'],
    boatSlang   : ['nei', 'vaaval', 'vaval', 'pomfert', 'butter', 'white fish', 'vaavel'],
    phoneticForms: ['nei meen', 'nay meen', 'vaaval', 'vaval', 'pomfret', 'pomfert',
                    'pomphret', 'pumfret', 'nei', 'pomphret'],
    confusedWith: ['sankara'],
    patterns    : [
      /nei\s*meen/i,
      /pomfr[ae]t/i,
      /v[ao]{1,2}v[ae]l/i,
      /butter\s*fish/i,
      /நெய்\s*மீன்/,
    ],
    priceRange  : [300, 600],
    frequency   : 'high',
  },

  // ─── NETHILI — Anchovy ──────────────────────────────────────────────
  {
    id          : 'nethili',
    tamilNames  : ['நெத்திலி', 'நெத்திலி மீன்', 'கொண்டல்', 'அயிலை'],
    englishNames: ['nethili', 'anchovy', 'anchovies', 'stolephorus'],
    boatSlang   : ['nethal', 'nethali', 'nithili', 'small', 'tiny fish'],
    phoneticForms: ['nethili', 'nethali', 'nethily', 'nithili', 'nethal', 'netheel'],
    confusedWith: ['choodai'],
    patterns    : [
      /neth[ai]l[iy]/i,
      /anchov/i,
      /நெத்திலி/,
    ],
    priceRange  : [30, 80],
    frequency   : 'high',
  },

  // ─── KOLA — Barracuda ───────────────────────────────────────────────
  {
    id          : 'kola',
    tamilNames  : ['கோலா', 'கோல மீன்', 'கோலா மீன்', 'கோளா'],
    englishNames: ['kola', 'barracuda', 'sea pike', 'great barracuda'],
    boatSlang   : ['kolaa', 'kola meen', 'bara', 'pike', 'baracuda'],
    phoneticForms: ['kola', 'kolaa', 'koola', 'cola', 'kolla', 'gola'],
    confusedWith: ['viral'],
    patterns    : [
      /ko{1,2}l[ao]{1,2}/i,
      /barracuda/i,
      /கோலா/,
    ],
    priceRange  : [200, 400],
    frequency   : 'high',
  },

  // ─── VIRAL — Murrel / Snakehead ─────────────────────────────────────
  {
    id          : 'viral',
    tamilNames  : ['விரால்', 'விரால் மீன்', 'கோரவை', 'விரா'],
    englishNames: ['viral', 'murrel', 'snakehead', 'great snakehead', 'giant snakehead'],
    boatSlang   : ['viraal', 'veral', 'snake', 'koravai', 'vira'],
    phoneticForms: ['viral', 'viraal', 'veral', 'wiraal', 'wiral', 'biraal'],
    confusedWith: ['kola', 'thira'],
    patterns    : [
      /v[ie]r[ae]{1,2}l/i,
      /murrel/i,
      /snakehead/i,
      /விரால்/,
    ],
    priceRange  : [300, 500],
    frequency   : 'medium',
  },

  // ─── TUNA — Soorai ──────────────────────────────────────────────────
  {
    id          : 'tuna',
    tamilNames  : ['சூரை', 'சூரை மீன்', 'டூனா', 'கீச்சான்'],
    englishNames: ['tuna', 'soorai', 'skipjack', 'yellowfin tuna', 'bonito'],
    boatSlang   : ['soora meen', 'tuna fish', 'soori', 'yellow fin', 'skip'],
    phoneticForms: ['tuna', 'toona', 'soorai', 'soora', 'suurai', 'sourai', 'tuuna'],
    confusedWith: ['vanjaram'],
    patterns    : [
      /tu{1,2}n[ao]/i,
      /s[ou]{1,2}r[ae][iy]?/i,
      /skipjack/i,
      /சூரை/,
    ],
    priceRange  : [250, 500],
    frequency   : 'high',
  },

  // ─── CRAB — Nandu ───────────────────────────────────────────────────
  {
    id          : 'crab',
    tamilNames  : ['நண்டு', 'நண்டு மீன்', 'காடை நண்டு', 'கடல் நண்டு'],
    englishNames: ['crab', 'mud crab', 'blue crab', 'sea crab', 'nandu'],
    boatSlang   : ['nandu', 'nandu meen', 'nandoo', 'kaadai', 'mud'],
    phoneticForms: ['crab', 'craab', 'krab', 'nandu', 'nantu', 'nando'],
    confusedWith: ['prawn'],
    patterns    : [
      /cr[ao]{1,2}b/i,
      /n[ae]nd[ou]/i,
      /mud\s*crab/i,
      /நண்டு/,
    ],
    priceRange  : [400, 800],
    frequency   : 'high',
  },

  // ─── SQUID — Kanavaai ───────────────────────────────────────────────
  {
    id          : 'squid',
    tamilNames  : ['கணவாய்', 'கணவாய் மீன்', 'ஊசி மீன்'],
    englishNames: ['squid', 'calamari', 'cuttlefish', 'cuttle'],
    boatSlang   : ['kanavaai', 'kanawai', 'oosi meen', 'oosi', 'needle fish'],
    phoneticForms: ['squid', 'squeed', 'kanavaai', 'kanavai', 'calamari',
                    'cuttlefish', 'kanawai'],
    confusedWith: ['viral'],
    patterns    : [
      /squ[ie]+d/i,
      /calamari/i,
      /k[ae]nav[ae]{1,2}[iy]/i,
      /கணவாய்/,
    ],
    priceRange  : [300, 600],
    frequency   : 'medium',
  },
];

// ── O(1) Lookup Maps ──────────────────────────────────────────────────────────

/** Map: fish id → profile */
export const FISH_BY_ID = new Map<string, FishProfile>(
  FISH_PROFILES.map(f => [f.id, f])
);

/** Map: any known name/alias/slang → fish id */
export const FISH_NAME_INDEX = new Map<string, string>(
  FISH_PROFILES.flatMap(f => [
    ...f.tamilNames.map(n => [n.toLowerCase(), f.id] as [string, string]),
    ...f.englishNames.map(n => [n.toLowerCase(), f.id] as [string, string]),
    ...f.boatSlang.map(n => [n.toLowerCase(), f.id] as [string, string]),
    ...f.phoneticForms.map(n => [n.toLowerCase(), f.id] as [string, string]),
  ])
);
