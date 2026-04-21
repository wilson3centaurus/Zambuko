'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Smartphone, CheckCircle2, XCircle, Loader2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Package } from '@/lib/types';

type FlowStep = 'form' | 'waiting' | 'success' | 'failed';

interface BuyForm { phone: string; packageId: string }

const card = 'bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl shadow-sm';

export default function BuyPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);
  const [step, setStep] = useState<FlowStep>('form');
  const [form, setForm] = useState<BuyForm>({ phone: '', packageId: params.get('pkg') ?? '' });
  const [error, setError] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch('/api/packages')
      .then((r) => r.json())
      .then((j) => { if (j.success) setPackages(j.data); })
      .catch(() => {});
  }, []);

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  useEffect(() => () => stopPolling(), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setElapsed(0);

    const res = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const json = await res.json();
    if (!json.success) { setError(json.error); return; }

    setStep('waiting');
    startPolling(json.data.reference, json.data.pollInterval);
  }

  function startPolling(ref: string, interval: number) {
    const MAX_ATTEMPTS = 72; // ~6 minutes at 5s interval
    let attempts = 0;

    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);

    pollRef.current = setInterval(async () => {
      try {
        attempts++;
        if (attempts > MAX_ATTEMPTS) {
          stopPolling();
          setStep('failed');
          return;
        }
        const res = await fetch(`/api/payments/status/${encodeURIComponent(ref)}`);
        const json = await res.json();
        if (!json.success) return;

        const { status, voucherCode: code } = json.data;

        if (status === 'paid') {
          stopPolling();
          setVoucherCode(code ?? '');
          setStep('success');
          sessionStorage.setItem('pendingVoucher', code ?? '');
        } else if (status === 'failed' || status === 'cancelled') {
          stopPolling();
          setStep('failed');
        }
      } catch { /* ignore */ }
    }, interval);
  }

  if (step === 'waiting') {
    return (
      <div className={`${card} p-8 flex flex-col items-center gap-6 text-center`}>
        <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
          <Loader2 size={36} className="animate-spin text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Waiting for Payment</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-2 leading-relaxed">
            Check your EcoCash for a payment prompt and enter your PIN to confirm.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-slate-500">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          Checking payment status…
          <span className="ml-1 font-mono text-xs tabular-nums">
            {String(Math.floor(elapsed / 60)).padStart(2,'0')}:{String(elapsed % 60).padStart(2,'0')}
          </span>
        </div>
        <button
          onClick={() => { stopPolling(); setStep('failed'); }}
          className="text-xs text-gray-400 underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className={`${card} p-8 flex flex-col items-center gap-5 text-center`}>
        <div className="w-20 h-20 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
          <CheckCircle2 size={40} className="text-green-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Payment Successful!</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Your voucher code:</p>
        </div>
        <div className="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl px-6 py-5">
          <p className="text-3xl font-black tracking-widest font-mono text-blue-700 dark:text-blue-300">
            {voucherCode.slice(0, 4)}-{voucherCode.slice(4)}
          </p>
          <p className="text-xs text-blue-400 dark:text-blue-500 mt-1">Screenshot or write this down</p>
        </div>
        <Button className="w-full" onClick={() => router.push(`/portal?code=${voucherCode}`)}>Connect Now</Button>
      </div>
    );
  }

  if (step === 'failed') {
    return (
      <div className={`${card} p-8 flex flex-col items-center gap-5 text-center`}>
        <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <XCircle size={40} className="text-red-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Payment Failed</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">You have not been charged.</p>
        </div>
        <Button className="w-full" onClick={() => setStep('form')}>Try Again</Button>
        <button onClick={() => router.push('/portal')} className="text-sm text-gray-400 underline">Back to Home</button>
      </div>
    );
  }

  const selected = packages.find((p) => p.id === form.packageId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 mb-3 transition"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">Buy WiFi Access</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Pay with EcoCash – instant connection</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Package selector */}
        <div className={`${card} p-4`}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Select Package</h3>
          <div className="grid grid-cols-2 gap-2">
            {packages.filter((p) => p.active).map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setForm((f) => ({ ...f, packageId: pkg.id }))}
                className={`rounded-2xl p-3 text-left transition border-2 ${
                  form.packageId === pkg.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 hover:border-gray-200'
                }`}
              >
                <p className="font-black text-xl text-gray-900 dark:text-white">${pkg.price.toFixed(2)}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{pkg.name}</p>
              </button>
            ))}
          </div>
          {selected && (
            <p className="text-xs text-blue-600 dark:text-blue-400 text-center mt-3 font-medium">
              {selected.duration_hours}h · {selected.speed_limit} speed
            </p>
          )}
        </div>

        {/* Phone input */}
        <div className={`${card} p-4`}>
          <label className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2 block">EcoCash Number</label>
          <div className="relative">
            <Smartphone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="0771234567"
              className="w-full h-12 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 pl-10 pr-4 text-gray-900 dark:text-white text-sm placeholder:text-gray-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              required
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">Enter your EcoCash mobile number</p>
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={!form.packageId || !form.phone}
        >
          Pay with EcoCash
        </Button>
      </form>
    </div>
  );
}
