import React, { forwardRef, InputHTMLAttributes } from 'react';
import { LucideIcon } from 'lucide-react';

interface ControlledInputProps extends InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label?: string;
  labelRight?: React.ReactNode;
  icon?: LucideIcon;
  leftElement?: React.ReactNode;
  error?: string;
  rightElement?: React.ReactNode;
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export const ControlledInput = forwardRef<HTMLInputElement, ControlledInputProps>(
  ({ name, label, labelRight, icon: Icon, leftElement, error, rightElement, className, ...props }, ref) => {
    const errorId = `${name}-error`;
    const inputId = props.id || name;

    return (
      <div className="space-y-2 w-full">
        {(label || labelRight) && (
          <div className="flex items-center justify-between">
            {label && (
              <label htmlFor={inputId} className="block text-sm font-semibold text-slate-200 tracking-tight">
                {label}
              </label>
            )}
            {labelRight && <div>{labelRight}</div>}
          </div>
        )}
        <div className="relative group flex items-center">
          {Icon && !leftElement && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-cyan-400 transition-colors">
              <Icon className="h-4 w-4" />
            </div>
          )}
          {leftElement && (
            <div className="absolute left-0 inset-y-0 flex items-center">
              {leftElement}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            name={name}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "block w-full h-12 bg-white/5 border rounded-lg text-white font-medium placeholder:text-slate-500 transition-all text-sm shadow-inner focus:outline-none",
              (Icon && !leftElement) ? "pl-11" : "",
              leftElement ? "pl-14" : (!Icon ? "pl-4" : ""),
              rightElement ? "pr-11" : "pr-4",
              error 
                ? "border-coral-500/80 focus:border-coral-500 focus:ring-2 focus:ring-coral-500/20" 
                : "border-white/10 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30",
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 flex items-center">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <p id={errorId} className="text-xs font-semibold text-coral-300 mt-1.5" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
ControlledInput.displayName = 'ControlledInput';
