"use client";

import React from "react";
import { cn } from "../cn";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "emergency";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-semibold rounded-lg transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px";

  const variants = {
    primary:
      "bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500 shadow-sm",
    secondary:
      "bg-white text-brand-700 border border-brand-200 hover:bg-brand-50 focus-visible:ring-brand-400",
    ghost:
      "text-brand-700 hover:bg-brand-50 focus-visible:ring-brand-400",
    danger:
      "bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-500 shadow-sm",
    emergency:
      "bg-emergency-600 text-white hover:bg-emergency-700 focus-visible:ring-emergency-500 shadow-emergency",
  };

  const sizes = {
    sm: "min-h-9 text-sm px-3 py-1.5 gap-1.5",
    md: "min-h-11 text-sm px-4 py-2.5 gap-2",
    lg: "min-h-12 text-base px-6 py-3 gap-2.5",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
