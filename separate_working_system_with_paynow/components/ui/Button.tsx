import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/format';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

const variantStyles: Record<string, string> = {
  primary:   'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm',
  secondary: 'bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700 shadow-sm',
  danger:    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
  ghost:     'bg-transparent text-brand-600 hover:bg-brand-50 active:bg-brand-100',
  outline:   'border border-brand-600 text-brand-600 hover:bg-brand-50 active:bg-brand-100',
};

const sizeStyles: Record<string, string> = {
  sm:  'h-9 px-4 text-sm rounded-lg',
  md:  'h-11 px-5 text-base rounded-xl',
  lg:  'h-14 px-6 text-lg rounded-2xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Please wait…</span>
        </>
      ) : children}
    </button>
  );
}
