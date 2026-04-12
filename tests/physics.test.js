import { describe, it, expect } from 'vitest';
import { updatePosition, clampCoordinates, simulateZeroGFloat } from '../src/physics';

describe('Antigravity Physics Logic', () => {
    describe('updatePosition', () => {
        it('should correctly update position based on velocity', () => {
            const result = updatePosition(0, 0, 10, 5, 1);
            expect(result.x).toBe(10);
            expect(result.y).toBe(5);
        });

        it('should handle zero-G floating (no velocity change)', () => {
            const result = updatePosition(10, 10, 0, 0, 1);
            expect(result.x).toBe(10);
            expect(result.y).toBe(10);
        });

        it('should NOT return NaN when timeDelta is 0', () => {
            const result = updatePosition(0, 0, 10, 10, 0);
            expect(result.x).not.toBeNaN();
            expect(result.y).not.toBeNaN();
        });
    });

    describe('clampCoordinates', () => {
        it('should clamp values within bounds', () => {
            const result = clampCoordinates(150, -50, 0, 100);
            expect(result.x).toBe(100);
            expect(result.y).toBe(0);
        });

        it('should handle NaN inputs gracefully', () => {
            const result = clampCoordinates(NaN, 50, 0, 100);
            expect(result.x).toBe(0); // Should fall back or handle cleanly
            expect(result.y).toBe(50);
        });
    });

    describe('simulateZeroGFloat', () => {
        it('should calculate floating effect correctly', () => {
            const result = simulateZeroGFloat(100, 5);
            expect(result).toBeLessThan(100);
        });

        it('should handle missing strength parameter (zero-G default)', () => {
            const result = simulateZeroGFloat(100);
            expect(result).not.toBeNaN();
        });
    });
});
