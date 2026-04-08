export const FISH: Record<string, string[]> = {
  en: ["Thira", "Malavai", "P.Ula", "Iral", "Kavala", "Vanjaram", "Seela", "Nethili",
    "Mathi", "Pomfret", "Shark", "Kori", "Viral", "Katla", "Ayala", "Sankara", "Vela", "Kiluvai"],
  ta: ["திரா", "மலவை", "P.உலா", "இறால்", "கவலா", "வஞ்சிரம்", "சீலா", "நெத்திலி",
    "மத்தி", "ஆவோலி", "சுறா", "கோரி", "விரால்", "கட்லா", "அயலா", "சங்கரா", "வேலா", "கிளுவை"],
};

export const getAllFish = () => {
  return [...FISH.en, ...FISH.ta];
};

export const getSuggestions = (query: string, lang: 'en' | 'ta') => {
  if (!query) return [];
  const list = FISH[lang];
  return list.filter(f => f.toLowerCase().startsWith(query.toLowerCase())).slice(0, 6);
};
