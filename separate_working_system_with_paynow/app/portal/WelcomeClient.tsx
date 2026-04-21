'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { PackageCard } from '@/components/portal/PackageCard';
import type { Package } from '@/lib/types';

interface Props { packages: Package[] }

type Tab = 'voucher' | 'buy';

export function WelcomeClient({ packages }: Props) {
  const [tab, setTab] = useState<Tab>('buy');
  const router = useRouter();

  function handleSelectPackage(pkg: Package) {
    router.push(`/portal/buy?pkg=${pkg.id}`);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Hero */}
      <div className="pt-1 pb-0.5">
        <h1 className="text-2xl font-black leading-tight text-gray-900 dark:text-white">
          Stay Connected,<br />Stay Ahead.
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1.5">
          Pay with EcoCash &middot; Connect instantly.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-2xl bg-gray-200 dark:bg-slate-800 p-1 gap-1">
        {(['buy', 'voucher'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === t
                ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
            }`}
          >
            {t === 'buy' ? 'Buy Access' : 'Enter Voucher'}
          </button>
        ))}
      </div>

      {tab === 'buy' ? (
        <BuyTab packages={packages} onSelect={handleSelectPackage} />
      ) : (
        <VoucherTab />
      )}
    </div>
  );
}

function BuyTab({ packages, onSelect }: { packages: Package[]; onSelect: (p: Package) => void }) {
  if (packages.length === 0) {
    return (
      <div className="py-10 text-center text-gray-400 dark:text-slate-500">
        <p className="font-semibold">No packages available</p>
        <p className="text-sm mt-1">Please check back later.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {packages.map((pkg) => (
        <PackageCard key={pkg.id} pkg={pkg} onSelect={onSelect} />
      ))}
    </div>
  );
}

function VoucherTab() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  function handleVoucherInput(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 8);
    setCode(raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw);
    setError('');
  }

  const rawCode = code.replace('-', '');
  const isComplete = rawCode.length === 8;
  const chars = rawCode.split('');

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!isComplete) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/vouchers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: rawCode }),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error || 'Invalid voucher');
      } else {
        sessionStorage.setItem('activeVoucher', JSON.stringify(json.data));
        if (json.data.mikrotikRedirectUrl) {
          window.location.href = json.data.mikrotikRedirectUrl;
        } else {
          router.push('/portal/session');
        }
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleConnect}
      className="flex flex-col gap-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm"
    >
      <div>
        <h2 className="font-bold text-gray-900 dark:text-white">Enter Voucher Code</h2>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Type your 8-character code below</p>
      </div>

      {/* Slot display */}
      <div className="flex items-center justify-center gap-1.5 select-none" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-10 h-12 rounded-xl flex items-center justify-center text-xl font-black font-mono transition-all ${
              chars[i]
                ? 'bg-blue-600 text-white shadow-md scale-105'
                : 'border-2 border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-gray-300 dark:text-slate-600'
            }`}
          >
            {chars[i] || '-'}
          </div>
        ))}
        <div className="px-1 text-gray-400 dark:text-slate-500 font-bold text-lg">&mdash;</div>
        {[4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className={`w-10 h-12 rounded-xl flex items-center justify-center text-xl font-black font-mono transition-all ${
              chars[i]
                ? 'bg-blue-600 text-white shadow-md scale-105'
                : 'border-2 border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-gray-300 dark:text-slate-600'
            }`}
          >
            {chars[i] || '-'}
          </div>
        ))}
      </div>

      <input
        type="text"
        value={code}
        onChange={handleVoucherInput}
        placeholder="Type code here..."
        maxLength={9}
        className="w-full h-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-4 text-center text-sm font-mono tracking-widest text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
      />

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}

      <Button
        type="submit"
        loading={loading}
        disabled={!isComplete || loading}
        className="w-full"
      >
        Connect to WiFi
      </Button>
    </form>
  );
}
