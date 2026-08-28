import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, rightElement, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {icon && (
          <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            'flex h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-white placeholder:text-slate-500 outline-none ring-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/25 focus-visible:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-inner shadow-black/40',
            icon && 'pl-11',
            rightElement && 'pr-11',
            className
          )}
          ref={ref}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3.5 flex items-center text-slate-400">
            {rightElement}
          </div>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
