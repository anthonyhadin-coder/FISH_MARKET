export function updatePosition(x, y, velocityX, velocityY, timeDelta) {
    if (timeDelta <= 0) return { x, y };

    let newX = x + velocityX * timeDelta;
    let newY = y + velocityY * timeDelta;

    if (isNaN(newX) || isNaN(newY)) return { x, y };

    return { x: newX, y: newY };
}

export function clampCoordinates(x, y, minBoundary, maxBoundary) {
    const validX = isNaN(x) ? minBoundary : x;
    const validY = isNaN(y) ? minBoundary : y;

    return {
        x: Math.max(minBoundary, Math.min(validX, maxBoundary)),
        y: Math.max(minBoundary, Math.min(validY, maxBoundary))
    };
}

export function simulateZeroGFloat(uiElementY, floatStrength = 1.0) {
    let newY = uiElementY - (floatStrength * 0.1);
    return isNaN(newY) ? uiElementY : newY;
}
