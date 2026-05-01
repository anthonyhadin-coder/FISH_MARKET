import React from 'react';

/* ── Design tokens ───────────────────────────────── */
export const G = {
    bg: "#F0F9FF", surface: "#FFFFFF", card: "#FFFFFF", border: "#E0F2FE",
    accent: "#0369A1", text: "#082F49", muted: "#334155", subtle: "#475569",
    green: "#15803D", red: "#B91C1C", amber: "#B45309", blue: "#1D4ED8",
    inputBg: "#F1F5F9", inputBorder: "#CBD5E1",
};

/* ── UI Components ───────────────────────────────── */
export const Label = ({ c, style, ...props }: { c: string, style?: React.CSSProperties, [key: string]: unknown }) => (
    <div {...props} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: G.muted, marginBottom: 5, textTransform: "uppercase", ...style }}>{c}</div>
);

export const Badge = ({ color = "#6366F1", children, style, ...props }: { color?: string, children: React.ReactNode, style?: React.CSSProperties, [key: string]: unknown }) => (
    <span {...props} style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 99, padding: "2px 9px", fontSize: 11, fontWeight: 700, ...style }}>{children}</span>
);

export const Divider = ({ style, ...props }: { style?: React.CSSProperties, [key: string]: unknown }) => (
    <div {...props} style={{ height: 1, background: `linear-gradient(90deg,transparent,${G.border},transparent)`, ...style }} />
);

/* ── Helpers ─────────────────────────────────────── */
export const fmt = (n?: number | string | null, sym = "₹") => sym + Number(n || 0).toLocaleString("en-IN");

export const dispDate = (dk: string) => {
    try {
        return new Date(dk + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    } catch {
        return String(dk);
    }
};

export const toKey = (d = new Date()) => d.toISOString().split("T")[0];
