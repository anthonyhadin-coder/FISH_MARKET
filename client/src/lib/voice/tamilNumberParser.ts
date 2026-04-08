/**
 * Tamil Number Parser Utility
 * Handles literals like ஒன்று -> 1, ஆயிரம் -> 1000, லட்சம் -> 100,000
 * and ordinals like முதல் -> 1, இரண்டாவது -> 2
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
  const words = text.toLowerCase().split(/[\s\-]+/);
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
