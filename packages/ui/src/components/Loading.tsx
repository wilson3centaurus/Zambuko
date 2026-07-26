import { cn } from "../cn";

type LoadingSpinnerProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  inverse?: boolean;
};

const spinnerSizes = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-9 w-9 border-[3px]",
} as const;

export function LoadingSpinner({
  label = "Loading",
  size = "md",
  className,
  inverse = false,
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label || "Loading"}
      className={cn(
        "flex items-center justify-center gap-2 py-4 text-sm font-medium",
        inverse ? "text-slate-300" : "text-slate-500 dark:text-slate-300",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block animate-spin rounded-full border-current border-t-transparent",
          spinnerSizes[size]
        )}
      />
      {label && <span>{label}</span>}
    </div>
  );
}

type CardSkeletonProps = {
  className?: string;
  lines?: number;
  dark?: boolean;
};

export function CardSkeleton({ className, lines = 2, dark = false }: CardSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading card"
      className={cn(
        "animate-pulse rounded-2xl border p-5 shadow-sm",
        dark
          ? "border-slate-700 bg-slate-800"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
        className
      )}
    >
      <div className={cn("h-3 w-24 rounded", dark ? "bg-slate-700" : "bg-slate-200 dark:bg-slate-700")} />
      <div className={cn("mt-4 h-8 w-16 rounded", dark ? "bg-slate-700" : "bg-slate-200 dark:bg-slate-700")} />
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "mt-3 h-2 rounded",
            index === lines - 1 ? "w-2/3" : "w-full",
            dark ? "bg-slate-700" : "bg-slate-100 dark:bg-slate-800"
          )}
        />
      ))}
    </div>
  );
}
