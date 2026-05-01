"use client";
import { motion } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    isLoading?: boolean;
}

export const Button = ({ className, variant = 'primary', isLoading, children, ...props }: ButtonProps) => {
    const variants = {
        primary: "bg-ocean-700 text-white hover:bg-ocean-600 shadow-lg shadow-ocean-900/20",
        secondary: "bg-coral-600 text-white hover:bg-coral-500 shadow-lg shadow-coral-900/20",
        outline: "border-2 border-ocean-700 text-ocean-400 hover:bg-ocean-700/10",
        ghost: "text-ocean-300 hover:bg-ocean-900/40"
    };

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
                "px-6 py-2.5 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-ocean-500/50 disabled:opacity-50 disabled:cursor-not-allowed",
                variants[variant],
                className
            )}
            {...(props as Record<string, unknown>)}
        >
            {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
            ) : children}
        </motion.button>
    );
};
