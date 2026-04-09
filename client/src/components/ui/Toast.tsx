"use client";
import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useRef,
    useEffect,
    ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

const TOAST_DURATION = 5000; // ms — FIX 4: 5-second auto-dismiss

interface ToastItem {
    id: string; // FIX 1: use string UUID instead of number ms timestamp to prevent duplicate keys
    message: string;
    type: ToastType;
}

interface ToastContextType {
    toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};

// Global singleton — lets api.ts call showToast() outside of the React tree.
let externalToast: (message: string, type?: ToastType) => void = () => {};
export const showToast = (message: string, type?: ToastType) =>
    externalToast(message, type);

// ── Individual Toast Card ──────────────────────────────────────────────────────
// Handles its own countdown timer.  The timer PAUSES when the user hovers (FIX 4).
// A CSS progress bar visually shows the remaining time (FIX 4).
// role="alert" + aria-live="assertive" ensure screen readers announce it (FIX 5).
function ToastCard({
    toast: t,
    onRemove,
}: {
    toast: ToastItem;
    onRemove: (id: string) => void;
}) {
    const [progress, setProgress] = useState(100); // 100% → 0%
    const [, setHovered] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startedAt = useRef(0);
    const elapsed = useRef(0);

    const startTimer = useCallback(() => {
        startedAt.current = Date.now();
        intervalRef.current = setInterval(() => {
            const totalElapsed = elapsed.current + (Date.now() - startedAt.current);
            const pct = Math.max(
                0,
                100 - (totalElapsed / TOAST_DURATION) * 100
            );
            setProgress(pct);
            if (pct <= 0) {
                clearInterval(intervalRef.current!);
                onRemove(t.id);
            }
        }, 50); // ~20 fps is smooth enough
    }, [t.id, onRemove]);

    const pauseTimer = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            // Accumulate elapsed time so the countdown resumes correctly.
            elapsed.current += Date.now() - startedAt.current;
        }
    }, []);

    useEffect(() => {
        startTimer();
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [startTimer]);

    const handleMouseEnter = () => {
        setHovered(true);
        pauseTimer(); // FIX 4: Pause countdown on hover
    };

    const handleMouseLeave = () => {
        setHovered(false);
        startTimer(); // FIX 4: Resume countdown when hover ends
    };

    const colorMap: Record<ToastType, string> = {
        success: 'bg-green-600 border-green-500',
        error:   'bg-red-600 border-red-500',
        info:    'bg-ocean-900 border-ocean-800',
    };

    const progressColorMap: Record<ToastType, string> = {
        success: 'bg-green-300',
        error:   'bg-red-300',
        info:    'bg-teal-400',
    };

    return (
        <motion.div
            // FIX 5: role="alert" + aria-live="assertive" → screen reader announces immediately
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            data-testid="toast"
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`
                pointer-events-auto relative flex flex-col overflow-hidden
                rounded-2xl shadow-2xl border
                ${colorMap[t.type]}
            `}
        >
            {/* Main row */}
            <div className="flex items-center gap-3 px-6 py-4">
                {t.type === 'success' && <CheckCircle className="w-5 h-5 shrink-0" />}
                {t.type === 'error'   && <AlertCircle className="w-5 h-5 shrink-0" />}
                {t.type === 'info'    && <Info         className="w-5 h-5 shrink-0" />}

                <span className="text-sm font-bold tracking-tight text-white leading-snug flex-1">
                    {t.message}
                </span>

                {/* FIX 4: Manual close button (existing requirement) */}
                <button
                    aria-label="Dismiss notification"
                    onClick={() => onRemove(t.id)}
                    className="ml-2 p-1 hover:bg-white/10 rounded-lg transition-colors shrink-0"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* FIX 4: Progress bar — counts down from 100% to 0%, pauses on hover */}
            <div className="h-[3px] w-full bg-white/20">
                <div
                    className={`h-full transition-none ${progressColorMap[t.type]}`}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </motion.div>
    );
}

// ── Provider ───────────────────────────────────────────────────────────────────
export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const toast = useCallback(
        (message: string, type: ToastType = 'info') => {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            setToasts((prev) => [...prev, { id, message, type }]);
        },
        []
    );

    useEffect(() => {
        externalToast = toast;
    }, [toast]);

    return (
        <ToastContext value={{ toast }}>
            {children}
            {/* FIX 5: The container is aria-hidden so only individual ToastCards
                (which each carry role="alert") are announced by screen readers. */}
            <div
                aria-hidden="true"
                className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none"
            >
                <AnimatePresence>
                    {toasts.map((t) => (
                        <ToastCard key={t.id} toast={t} onRemove={removeToast} />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext>
    );
};
