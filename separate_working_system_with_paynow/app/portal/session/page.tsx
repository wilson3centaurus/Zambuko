'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SessionTimer } from '@/components/portal/SessionTimer';
import { parseSpeedLimit } from '@/lib/utils/format';
import { useToast } from '@/components/ui/Toast';

interface SessionData {
  voucher: {
    id: string;
    code: string;
    expires_at: string;
    status: string;
  };
  package: {
    name: string;
    duration_hours: number;
    speed_limit: string;
  };
}

export default function SessionPage() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const raw = sessionStorage.getItem('activeVoucher');
    if (!raw) {
      router.replace('/portal');
      return;
    }
    try {
      const data = JSON.parse(raw) as SessionData;
      setSession(data);
    } catch {
      router.replace('/portal');
    }
    setLoading(false);
  }, [router]);

  function handleExpired() {
    setExpired(true);
    toast('Your session has expired. Please buy more time.', 'warning');
  }

  function handleWarning() {
    toast('⚠️ You have less than 5 minutes remaining!', 'warning');
  }

  const cardBase = 'bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm';

  if (loading) {
    return (
      <div className={`${cardBase} rounded-3xl p-10 flex flex-col items-center gap-4`}>
        <div className="w-10 h-10 rounded-full border-4 border-gray-100 dark:border-slate-700 border-t-blue-600 animate-spin" />
        <p className="text-sm text-gray-400 dark:text-slate-500">Loading session…</p>
      </div>
    );
  }

  if (!session) return null;

  const speed = parseSpeedLimit(session.package.speed_limit);

  if (expired) {
    return (
      <div className={`${cardBase} rounded-3xl p-8 flex flex-col items-center gap-5 text-center`}>
        <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <WifiOff size={36} className="text-red-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Session Expired</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Purchase a new package to reconnect.</p>
        </div>
        <Button className="w-full" onClick={() => router.push('/portal')}>
          Buy More Time
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Status card */}
      <div className={`${cardBase} rounded-3xl p-5`}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
            <Wifi size={22} className="text-green-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">Connected</p>
            <h2 className="font-bold text-gray-900 dark:text-white">{session.package.name}</h2>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-green-600 dark:text-green-400">Online</span>
          </div>
        </div>

        <SessionTimer
          expiresAt={session.voucher.expires_at}
          onExpired={handleExpired}
          onWarning={handleWarning}
        />
      </div>

      {/* Details */}
      <div className={`${cardBase} p-4`}>
        <h3 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">Session Details</h3>
        <div className="flex flex-col divide-y divide-gray-100 dark:divide-slate-800">
          {[
            { label: 'Voucher', value: session.voucher.code, mono: true },
            { label: 'Package', value: session.package.name },
            { label: 'Speed', value: `↓${speed.down}  ↑${speed.up}` },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-gray-500 dark:text-slate-400">{row.label}</span>
              <span className={`text-sm font-semibold text-gray-900 dark:text-white ${row.mono ? 'font-mono' : ''}`}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <Button
        variant="secondary"
        className="w-full h-12"
        onClick={() => router.push('/portal')}
      >
        <RefreshCw size={17} /> Buy More Time
      </Button>
    </div>
  );
}
