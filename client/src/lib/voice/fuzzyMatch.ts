/**
 * Fuzzy Match Utility
 * Uses Levenshtein distance to find the best match in a list of strings.
 */

export const levenshtein = (a: string, b: string): number => {
    const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
        }
    }
    return matrix[a.length][b.length];
};

export const fuzzyMatch = (input: string, list: string[], threshold = 0.3): string | null => {
    if (!input) return null;
    let bestMatch: string | null = null;
    let minDistance = Infinity;
    const lowerInput = input.toLowerCase();

    for (const item of list) {
        const lowerItem = item.toLowerCase();
        const distance = levenshtein(lowerInput, lowerItem);
        const score = distance / Math.max(lowerInput.length, lowerItem.length);
        if (score < minDistance && score <= threshold) {
            minDistance = score;
            bestMatch = item;
        }
    }
    return bestMatch;
};
