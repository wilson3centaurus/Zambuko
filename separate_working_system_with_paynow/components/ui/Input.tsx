import { type InputHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/utils/format';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, hint, leftIcon, rightIcon, className, id, ...props }, ref) {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 text-gray-400 pointer-events-none">{leftIcon}</div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full h-12 rounded-xl border bg-white px-4 text-base text-gray-900 placeholder:text-gray-400',
              'transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
              'disabled:bg-gray-50 disabled:text-gray-500',
              error ? 'border-red-400 focus:ring-red-400' : 'border-gray-200',
              leftIcon && 'pl-11',
              rightIcon && 'pr-11',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 text-gray-400 pointer-events-none">{rightIcon}</div>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {hint && !error && <p className="text-sm text-gray-500">{hint}</p>}
      </div>
    );
  }
);
