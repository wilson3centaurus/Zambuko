import { cn } from '@/lib/utils/format';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger:  'bg-red-100 text-red-800',
  info:    'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-700',
};

const dotStyles: Record<BadgeVariant, string> = {
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger:  'bg-red-500',
  info:    'bg-blue-500',
  neutral: 'bg-gray-400',
};

interface BadgeProps {
  variant?: BadgeVariant;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'neutral', dot = false, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotStyles[variant])} />}
      {children}
    </span>
  );
}

/** Map common status strings to Badge variants */
export function statusVariant(status: string): BadgeVariant {
  switch (status.toLowerCase()) {
    case 'paid':
    case 'active':
    case 'success':
      return 'success';
    case 'pending':
    case 'unused':
      return 'warning';
    case 'failed':
    case 'disabled':
    case 'expired':
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}
