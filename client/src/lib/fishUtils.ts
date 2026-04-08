export const FISH_COLORS = [
    "#1A56DB", "#057A55", "#C27803", "#0D9488", "#7C3AED",
    "#E02424", "#D97706", "#059669", "#2563EB", "#DC2626",
];

export interface FishRow {
    fishName?: string;
    fish?: string;
    [key: string]: unknown;
}

export const groupByFish = (rows: FishRow[]) => {
    const map: Record<string, FishRow[]> = {};
    rows.forEach(r => {
        const f = r.fishName || r.fish || "Unknown";
        if (!map[f]) map[f] = [];
        map[f].push(r);
    });
    return map;
};
