import React from 'react';
import { cn } from '../../lib/utils';

export function BentoGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid md:auto-rows-[18rem] grid-cols-1 md:grid-cols-3 gap-4 max-w-7xl mx-auto',
        className
      )}
    >
      {children}
    </div>
  );
}

export function BentoCard({
  className,
  name,
  className_header,
  description,
  Icon,
  background,
  cta,
  onClick,
}: {
  className?: string;
  name: string;
  className_header?: string;
  description: string;
  Icon?: React.ComponentType<{ className?: string }>;
  background?: React.ReactNode;
  cta?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-6 transition-all duration-300 hover:border-indigo-500/40 hover:bg-slate-900/80 hover:shadow-2xl hover:shadow-indigo-500/10 backdrop-blur-xl',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 opacity-30 transition-opacity duration-300 group-hover:opacity-70">
        {background}
      </div>

      {/* Top Header */}
      <div className={cn('z-10 flex flex-col gap-2', className_header)}>
        {Icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-300">
            <Icon className="h-6 w-6" />
          </div>
        )}
        <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-indigo-300 transition-colors">
          {name}
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
          {description}
        </p>
      </div>

      {/* CTA Button / Footer */}
      {cta && (
        <div className="z-10 pt-4 flex items-center gap-2 text-xs font-semibold text-indigo-400 group-hover:text-indigo-300">
          <span>{cta}</span>
          <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </div>
      )}

      {/* Top glowing line */}
      <div className="pointer-events-none absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </div>
  );
}
