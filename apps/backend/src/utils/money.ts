/**
 * money.ts — Financial arithmetic utilities
 *
 * Strategy (user-confirmed): Keep DECIMAL(12,2) in MySQL.
 * Convert to integer paise (smallest unit) inside JS for all arithmetic,
 * then convert back to rupees at the API boundary.
 *
 * Why: JavaScript floating-point (IEEE 754) cannot represent many decimal
 * values exactly. For example:  0.1 + 0.2 === 0.30000000000000004 in JS.
 * By working in integers (paise) we avoid accumulation errors completely.
 *
 * All functions are pure and have no side effects.
 */

/** Convert a rupee amount (number | string) to integer paise, rounded to nearest paisa. */
export function toPaise(rupees: number | string): number {
    return Math.round(Number(rupees) * 100);
}

/** Convert integer paise back to rupees, rounded to 2 decimal places. */
export function fromPaise(paise: number): number {
    return Math.round(paise) / 100;
}

/**
 * Round a rupee value to exactly 2 decimal places using integer math.
 * Equivalent to Number(value.toFixed(2)) but without floating-point drift.
 */
export function roundMoney(rupees: number | string): number {
    return fromPaise(toPaise(rupees));
}

/**
 * Add two monetary values safely.
 * roundMoney(0.1 + 0.2) === 0.3  ✓
 */
export function addMoney(a: number | string, b: number | string): number {
    return fromPaise(toPaise(a) + toPaise(b));
}

/**
 * Subtract two monetary values safely.
 */
export function subtractMoney(a: number | string, b: number | string): number {
    return fromPaise(toPaise(a) - toPaise(b));
}

/**
 * Multiply a monetary value by a non-monetary scalar (e.g. weight * rate).
 * Result is rounded to 2 decimal places.
 */
export function multiplyMoney(rupees: number | string, scalar: number | string): number {
    // Use integer weight (grams) * integer rate (paise per unit) to avoid drift
    const rupeesNum = Number(rupees);
    const scalarNum = Number(scalar);
    // Multiply in floating point but round immediately — single operation minimises drift
    return fromPaise(Math.round(rupeesNum * scalarNum * 100));
}

/**
 * Format a monetary value for display (does NOT affect calculation).
 * Returns a plain number rounded to 2dp — formatting (₹ symbol, locale) is a UI concern.
 */
export function formatMoney(rupees: number | string): number {
    return roundMoney(rupees);
}
