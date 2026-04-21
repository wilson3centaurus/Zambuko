"use client";

import React from "react";
import { cn } from "../cn";

interface OfflineBannerProps {
  className?: string;
}

export function OfflineBanner({ className }: OfflineBannerProps) {
  const [isOffline, setIsOffline] = React.useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [syncing, setSyncing] = React.useState(false);

  React.useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setSyncing(true);
      setTimeout(() => {
        setIsOffline(false);
        setSyncing(false);
      }, 2000);
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline && !syncing) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm font-medium",
        syncing ? "bg-green-600 text-white" : "bg-amber-500 text-white",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {syncing ? (
        <>
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Syncing data…
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M6.343 8.464a5 5 0 000 7.072M3.515 5.636a9 9 0 000 12.728M12 12h.01" />
          </svg>
          You&apos;re offline. Working from local data.
        </>
      )}
    </div>
  );
}
