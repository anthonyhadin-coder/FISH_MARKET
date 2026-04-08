"use client";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = ({ label, error, className, id, ...props }: InputProps) => {
    const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-') || Math.random().toString(36).substring(2, 9)}`;
    return (
        <div className="w-full space-y-1.5">
            {label && (
                <label htmlFor={inputId} className="text-[11px] font-black uppercase tracking-widest ml-1 opacity-70">
                    {label}
                </label>
            )}
            <input
                id={inputId}
                className={cn(
                    "w-full px-4 py-2.5 bg-ocean-900/30 border border-ocean-800 rounded-xl text-ocean-50 placeholder:text-ocean-700 transition-all focus:outline-none focus:ring-2 focus:ring-ocean-500/30 focus:border-ocean-500",
                    error && "border-coral-500 focus:ring-coral-500/30 focus:border-coral-500",
                    className
                )}
                {...props}
            />
            {error && (
                <p role="alert" aria-live="polite" className="text-xs text-coral-400 ml-1 font-semibold animate-in fade-in duration-200">
                    {error}
                </p>
            )}
        </div>
    );
};
