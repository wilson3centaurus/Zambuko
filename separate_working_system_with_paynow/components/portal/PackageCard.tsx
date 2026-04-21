import { cn } from '@/lib/utils/format';
import { Package } from '@/lib/types';
import { Clock, Zap, Check } from 'lucide-react';

interface PackageCardProps {
  pkg: Package;
  selected?: boolean;
  onSelect?: (pkg: Package) => void;
}

const ACCENT_COLORS = [
  { bg: 'from-blue-500 to-blue-600',    ring: 'ring-blue-400',   text: 'text-blue-600'   },
  { bg: 'from-emerald-500 to-emerald-600', ring: 'ring-emerald-400', text: 'text-emerald-600' },
  { bg: 'from-purple-500 to-purple-600', ring: 'ring-purple-400', text: 'text-purple-600' },
  { bg: 'from-orange-500 to-amber-500',  ring: 'ring-orange-400', text: 'text-orange-600' },
];

function formatDuration(hours: number): string {
  if (hours < 24) return `${hours} Hour${hours > 1 ? 's' : ''}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} Day${days > 1 ? 's' : ''}`;
  return `${Math.floor(days / 30)} Month${Math.floor(days / 30) > 1 ? 's' : ''}`;
}

export function PackageCard({ pkg, selected = false, onSelect }: PackageCardProps) {
  const colorIndex = pkg.sort_order > 0 ? (pkg.sort_order - 1) % ACCENT_COLORS.length : 0;
  const color = ACCENT_COLORS[colorIndex];

  return (
    <button
      type="button"
      onClick={() => onSelect?.(pkg)}
      className={cn(
        'relative w-full flex flex-col items-start gap-3 p-4 rounded-2xl border-2 text-left',
        'transition-all duration-200 cursor-pointer active:scale-[0.97]',
        'bg-white dark:bg-slate-900',
        selected
          ? `border-transparent ring-2 ${color.ring} shadow-lg`
          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 hover:shadow-md'
      )}
    >
      {selected && (
        <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600">
          <Check size={14} className="text-white stroke-[3]" />
        </span>
      )}

      {/* Pill badge */}
      <span className={cn('px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r', color.bg)}>
        {formatDuration(pkg.duration_hours)}
      </span>

      {/* Price */}
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black text-gray-900 dark:text-white">${pkg.price.toFixed(2)}</span>
      </div>

      {/* Details */}
      <div className="flex flex-col gap-1 w-full">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
          <Zap size={12} className={color.text} />
          <span>{pkg.speed_limit} speed</span>
        </div>
        {pkg.data_limit_mb ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
            <Clock size={12} className={color.text} />
            <span>{Math.round(pkg.data_limit_mb / 1024)} GB data</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
            <Clock size={12} className={color.text} />
            <span>Unlimited data</span>
          </div>
        )}
      </div>
    </button>
  );
}
