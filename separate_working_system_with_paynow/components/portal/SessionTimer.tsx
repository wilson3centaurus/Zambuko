'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatTimeRemaining, secondsUntilExpiry } from '@/lib/utils/format';
import { AlertTriangle } from 'lucide-react';

interface SessionTimerProps {
  expiresAt: string;
  onExpired?: () => void;
  onWarning?: () => void; // fires at 5min remaining
}

export function SessionTimer({ expiresAt, onExpired, onWarning }: SessionTimerProps) {
  const [remaining, setRemaining] = useState(secondsUntilExpiry(expiresAt));
  const [warned, setWarned] = useState(false);

  const tick = useCallback(() => {
    const secs = secondsUntilExpiry(expiresAt);
    setRemaining(secs);

    if (secs <= 300 && !warned) {
      setWarned(true);
      onWarning?.();
    }

    if (secs <= 0) {
      onExpired?.();
    }
  }, [expiresAt, onExpired, onWarning, warned]);

  useEffect(() => {
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick]);

  const isExpired = remaining <= 0;
  const isWarning = remaining > 0 && remaining <= 300;

  // Calculate percentage for the ring
  const pct = isExpired ? 0 : Math.min(100, (remaining / (secondsUntilExpiry(expiresAt) + 1)) * 100);
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (remaining / Math.max(remaining, 1)) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          {/* Track */}
          <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" strokeWidth="10" />
          {/* Progress */}
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke={isExpired ? '#ef4444' : isWarning ? '#f59e0b' : '#2563eb'}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={isExpired ? circumference : 0}
            className="transition-all duration-1000"
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isExpired ? (
            <span className="text-sm font-bold text-red-600">Expired</span>
          ) : (
            <>
              <span className={`text-2xl font-black ${isWarning ? 'text-yellow-600' : 'text-brand-700'}`}>
                {formatTimeRemaining(expiresAt)}
              </span>
              <span className="text-xs text-gray-400 mt-0.5">remaining</span>
            </>
          )}
        </div>
      </div>

      {isWarning && !isExpired && (
        <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2">
          <AlertTriangle size={16} />
          <span>Less than 5 minutes remaining!</span>
        </div>
      )}
    </div>
  );
}
