import { ReactNode } from 'react';
import { cn } from '@/lib/utils/format';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: { value: number; label: string };
  colorClass?: string;
}

export function StatsCard({ title, value, subtitle, icon, trend, colorClass = 'bg-blue-500/10 text-blue-400' }: StatsCardProps) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
        <div className={cn('p-2 rounded-xl', colorClass)}>{icon}</div>
      </div>

      <div>
        <p className="text-3xl font-black text-slate-100">{value}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>

      {trend && (
        <div className={cn(
          'flex items-center gap-1 text-xs font-semibold',
          trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'
        )}>
          <span>{trend.value >= 0 ? '\u2191' : '\u2193'} {Math.abs(trend.value)}%</span>
          <span className="text-slate-600 font-normal">{trend.label}</span>
        </div>
      )}
    </div>
  );
}