'use client';

import { useEffect, useState, useCallback } from 'react';
import { Save, Zap, Smartphone, Database, Plus, X, Package, Clock, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { parseSpeedLimit } from '@/lib/utils/format';
import type { Package as PkgType } from '@/lib/types';

// ── Pricing analysis ─────────────────────────────────────────────────────────

type PriceLevel = 'red' | 'orange' | 'green' | 'yellow';

interface PriceAnalysis {
  level: PriceLevel;
  label: string;
  message: string;
  pph: number;
}

function analyzePricing(price: number, hours: number): PriceAnalysis | null {
  if (!price || !hours || price <= 0 || hours <= 0) return null;
  const pph = price / hours;

  if (pph < 0.008)
    return { level: 'red', label: 'Way too cheap', pph,
      message: `$${pph.toFixed(4)}/hr — not sustainable. Bandwidth costs will likely exceed revenue.` };
  if (pph < 0.035)
    return { level: 'orange', label: 'Below recommended', pph,
      message: `$${pph.toFixed(3)}/hr — very thin margins. Consider raising the price by 15–25%.` };
  if (pph <= 0.40)
    return { level: 'green', label: 'Great pricing', pph,
      message: `$${pph.toFixed(3)}/hr — excellent balance. Attractive for users and profitable for you.` };
  if (pph <= 1.50)
    return { level: 'yellow', label: 'Getting pricey', pph,
      message: `$${pph.toFixed(2)}/hr — on the high end. Users may compare with mobile data rates.` };
  return { level: 'red', label: 'Way too expensive', pph,
    message: `$${pph.toFixed(2)}/hr — users will likely not buy. Consider a longer duration or lower price.` };
}

const ANALYSIS_STYLES: Record<PriceLevel, string> = {
  red:    'bg-red-500/10 border-red-500/20 text-red-400',
  orange: 'bg-amber-400/10 border-amber-400/20 text-amber-400',
  yellow: 'bg-yellow-400/10 border-yellow-400/20 text-yellow-300',
  green:  'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
};
const ANALYSIS_DOTS: Record<PriceLevel, string> = {
  red:    'bg-red-500',
  orange: 'bg-amber-400',
  yellow: 'bg-yellow-400',
  green:  'bg-emerald-400',
};

const DURATION_PRESETS = [
  { label: '1 Hour',   hours: 1   },
  { label: '2 Hours',  hours: 2   },
  { label: '3 Hours',  hours: 3   },
  { label: '6 Hours',  hours: 6   },
  { label: '12 Hours', hours: 12  },
  { label: '1 Day',    hours: 24  },
  { label: '2 Days',   hours: 48  },
  { label: '3 Days',   hours: 72  },
  { label: '1 Week',   hours: 168 },
  { label: 'Custom…',  hours: 0   },
];

const SPEED_PRESETS = [
  { label: '512K – Very Slow',  value: '512K/512K' },
  { label: '1 Mbps – Basic',    value: '1M/1M'     },
  { label: '2 Mbps – Standard', value: '2M/2M'     },
  { label: '5 Mbps – Good',     value: '5M/5M'     },
  { label: '10 Mbps – Fast',    value: '10M/10M'   },
  { label: '20 Mbps – Premium', value: '20M/20M'   },
  { label: 'No limit',          value: ''           },
  { label: 'Custom…',           value: 'custom'     },
];

// ── Quick-start templates ────────────────────────────────────────────────────

type QuickTemplate = {
  tier: 'Budget' | 'Standard' | 'Premium' | 'Special';
  name: string;
  price: number;
  duration_hours: number;
  durationPreset: string;
  speed_limit: string;
  max_devices: number;
  data_limit_mb: number | null;
  tag?: string;
};

const QUICK_TEMPLATES: QuickTemplate[] = [
  { tier: 'Budget',   name: '1 Hr Browse',   price: 0.50, duration_hours: 1,   durationPreset: '1',   speed_limit: '2M/2M',   max_devices: 1, data_limit_mb: null },
  { tier: 'Budget',   name: '3 Hr Session',  price: 1.00, duration_hours: 3,   durationPreset: '3',   speed_limit: '3M/2M',   max_devices: 2, data_limit_mb: null },
  { tier: 'Budget',   name: '6 Hr Pass',     price: 1.75, duration_hours: 6,   durationPreset: '6',   speed_limit: '3M/3M',   max_devices: 2, data_limit_mb: null },
  { tier: 'Standard', name: 'Day Pass',      price: 2.00, duration_hours: 24,  durationPreset: '24',  speed_limit: '5M/5M',   max_devices: 3, data_limit_mb: null },
  { tier: 'Standard', name: '3 Day Pass',    price: 5.00, duration_hours: 72,  durationPreset: '72',  speed_limit: '5M/5M',   max_devices: 3, data_limit_mb: null },
  { tier: 'Premium',  name: 'Weekly Pass',   price: 8.00, duration_hours: 168, durationPreset: '168', speed_limit: '10M/10M', max_devices: 5, data_limit_mb: null },
  { tier: 'Premium',  name: 'Monthly Pass',  price: 15.0, duration_hours: 720, durationPreset: '0',   speed_limit: '10M/10M', max_devices: 5, data_limit_mb: null, tag: 'Best value' },
  { tier: 'Special',  name: 'Student Month', price: 10.0, duration_hours: 720, durationPreset: '0',   speed_limit: '3M/3M',   max_devices: 2, data_limit_mb: 30720, tag: 'Data-capped' },
];

const TIER_STYLES = {
  Budget:   { badge: 'bg-slate-700 text-slate-400', accent: 'text-slate-400', border: 'border-slate-700 hover:border-slate-500' },
  Standard: { badge: 'bg-blue-500/10 text-blue-400',    accent: 'text-blue-400',    border: 'border-blue-500/20 hover:border-blue-400/50' },
  Premium:  { badge: 'bg-purple-500/10 text-purple-400', accent: 'text-purple-400', border: 'border-purple-500/20 hover:border-purple-400/50' },
  Special:  { badge: 'bg-amber-400/10 text-amber-400',  accent: 'text-amber-400',  border: 'border-amber-400/20 hover:border-amber-400/50' },
};

// ── Create Package Form ──────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  description: '',
  price: '',
  durationPreset: '24',
  customDuration: '',
  speedPreset: '5M/5M',
  customSpeed: '',
  maxDevices: '3',
  dataLimitMb: '',
};

type FormState = typeof EMPTY_FORM;

interface CreateFormProps {
  onCreated: () => void;
  onCancel: () => void;
  prefill?: Partial<FormState>;
}

function CreatePackageForm({ onCreated, onCancel, prefill }: CreateFormProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({ ...EMPTY_FORM, ...prefill });
  const [creating, setCreating] = useState(false);

  const isCustomDuration = form.durationPreset === '0';
  const isCustomSpeed = form.speedPreset === 'custom';

  const effectiveDuration = isCustomDuration
    ? parseInt(form.customDuration) || 0
    : parseInt(form.durationPreset);
  const effectiveSpeed = isCustomSpeed ? form.customSpeed : form.speedPreset;

  const analysis = analyzePricing(parseFloat(form.price), effectiveDuration);

  function set(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.price || !effectiveDuration) return;

    setCreating(true);
    const res = await fetch('/api/admin/network', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price),
        duration_hours: effectiveDuration,
        speed_limit: effectiveSpeed || '5M/5M',
        max_devices: parseInt(form.maxDevices) || 3,
        data_limit_mb: form.dataLimitMb ? parseInt(form.dataLimitMb) : null,
        active: true,
      }),
    });
    const json = await res.json();
    setCreating(false);

    if (json.success) {
      toast(`Package "${form.name}" created!`, 'success');
      onCreated();
    } else {
      toast(json.error || 'Failed to create package', 'error');
    }
  }

  const inputCls = 'h-10 rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full';
  const selectCls = `${inputCls} cursor-pointer`;
  const labelCls = 'text-xs font-semibold text-slate-500 mb-1 block';

  return (
    <form onSubmit={handleCreate} className="bg-slate-900 rounded-2xl border-2 border-blue-500/20 p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-black text-slate-100 text-lg">Create New Package</h3>
          <p className="text-xs text-slate-500 mt-0.5">Fill in details and watch the pricing analysis update live</p>
        </div>
        <button type="button" onClick={onCancel} className="p-2 rounded-xl hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Package name */}
        <div className="sm:col-span-2">
          <label className={labelCls}>Package Name *</label>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Daily Browsing, Student Pack…"
            className={inputCls}
            required
          />
        </div>

        {/* Price */}
        <div>
          <label className={labelCls}>Price (USD) *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">$</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
              placeholder="0.50"
              className={`${inputCls} pl-7`}
              required
            />
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className={labelCls}>Duration *</label>
          <select
            value={form.durationPreset}
            onChange={(e) => set('durationPreset', e.target.value)}
            className={selectCls}
          >
            {DURATION_PRESETS.map((d) => (
              <option key={d.hours} value={String(d.hours)}>{d.label}</option>
            ))}
          </select>
          {isCustomDuration && (
            <input
              type="number"
              min="1"
              value={form.customDuration}
              onChange={(e) => set('customDuration', e.target.value)}
              placeholder="Hours (e.g. 36)"
              className={`${inputCls} mt-2`}
            />
          )}
        </div>

        {/* Speed */}
        <div>
          <label className={labelCls}>Speed Limit</label>
          <select
            value={form.speedPreset}
            onChange={(e) => set('speedPreset', e.target.value)}
            className={selectCls}
          >
            {SPEED_PRESETS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {isCustomSpeed && (
            <input
              type="text"
              value={form.customSpeed}
              onChange={(e) => set('customSpeed', e.target.value)}
              placeholder="e.g. 3M/1M"
              className={`${inputCls} mt-2 font-mono`}
            />
          )}
        </div>

        {/* Max devices */}
        <div>
          <label className={labelCls}>Max Devices</label>
          <select
            value={form.maxDevices}
            onChange={(e) => set('maxDevices', e.target.value)}
            className={selectCls}
          >
            {[1, 2, 3, 5, 8, 10].map((n) => (
              <option key={n} value={String(n)}>{n} device{n > 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>

        {/* Data cap */}
        <div>
          <label className={labelCls}>Data Cap (MB) — optional</label>
          <input
            type="number"
            min="10"
            value={form.dataLimitMb}
            onChange={(e) => set('dataLimitMb', e.target.value)}
            placeholder="Leave blank for unlimited"
            className={inputCls}
          />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className={labelCls}>Description — optional</label>
          <input
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Short description shown to customers"
            className={inputCls}
          />
        </div>
      </div>

      {/* ── Pricing analysis ── */}
      {analysis && (
        <div className={`mt-5 flex gap-3 items-start p-4 rounded-xl border text-sm ${ANALYSIS_STYLES[analysis.level]}`}>
          <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${ANALYSIS_DOTS[analysis.level]}`} />
          <div>
            <p className="font-bold">{analysis.label} — ${analysis.pph.toFixed(analysis.pph < 0.1 ? 4 : 2)}/hr</p>
            <p className="mt-0.5 leading-snug opacity-90">{analysis.message}</p>
          </div>
        </div>
      )}

      {!analysis && form.price && (
        <p className="mt-3 text-xs text-slate-600 text-center">Set a duration to see pricing analysis</p>
      )}

      <div className="flex gap-3 justify-end mt-5">
        <button type="button" onClick={onCancel} className="h-10 px-5 rounded-xl border border-slate-700 text-sm font-medium text-slate-400 hover:bg-slate-800 transition">
          Cancel
        </button>
        <Button type="submit" loading={creating} disabled={!form.name || !form.price || !effectiveDuration}>
          <Plus size={15} /> Create Package
        </Button>
      </div>
    </form>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function NetworkPage() {
  const { toast } = useToast();
  const [packages, setPackages] = useState<PkgType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<PkgType>>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [prefill, setPrefill] = useState<Partial<FormState> | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/network').then((r) => r.json());
    if (res.success) setPackages(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openWithTemplate(t: QuickTemplate) {
    setPrefill({
      name: t.name,
      price: String(t.price),
      durationPreset: t.durationPreset,
      customDuration: t.durationPreset === '0' ? String(t.duration_hours) : '',
      speedPreset: SPEED_PRESETS.find((s) => s.value === t.speed_limit) ? t.speed_limit : 'custom',
      customSpeed: SPEED_PRESETS.find((s) => s.value === t.speed_limit) ? '' : t.speed_limit,
      maxDevices: String(t.max_devices),
      dataLimitMb: t.data_limit_mb ? String(t.data_limit_mb) : '',
    });
    setShowCreate(true);
    // scroll to form
    setTimeout(() => document.getElementById('create-form')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function updateEdit(pkgId: string, field: keyof PkgType, value: unknown) {
    setEdits((prev) => ({
      ...prev,
      [pkgId]: { ...prev[pkgId], [field]: value },
    }));
  }

  async function savePackage(pkg: PkgType) {
    const changes = edits[pkg.id];
    if (!changes || Object.keys(changes).length === 0) return;

    setSaving(pkg.id);
    const res = await fetch('/api/admin/network', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pkg.id, ...changes }),
    });
    const json = await res.json();
    setSaving(null);

    if (json.success) {
      toast(`${pkg.name} settings saved`, 'success');
      setEdits((prev) => { const n = { ...prev }; delete n[pkg.id]; return n; });
      load();
    } else {
      toast(json.error, 'error');
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-20 text-slate-600">
        Loading packages...
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-5xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">Dashboard / Packages</p>
          <h1 className="text-2xl font-black text-slate-100">Network &amp; Packages</h1>
          <p className="text-sm text-slate-500">Create packages and configure speed limits per plan</p>
        </div>
        {!showCreate && (
          <Button onClick={() => { setPrefill(undefined); setShowCreate(true); }}>
            <Plus size={16} /> New Package
          </Button>
        )}
      </div>

      {/* ── Quick-start templates ── */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package size={16} className="text-slate-500" />
          <h2 className="text-sm font-bold text-slate-300">Quick-Start Templates</h2>
          <span className="text-xs text-slate-600 ml-1">— pre-calculated, click to pre-fill the form</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {QUICK_TEMPLATES.map((t) => {
            const ts = TIER_STYLES[t.tier];
            return (
              <button
                key={t.name}
                onClick={() => openWithTemplate(t)}
                className={`group relative text-left bg-slate-800 border rounded-xl p-3.5 transition-all ${ts.border}`}
              >
                <div className="flex items-start justify-between gap-1 mb-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ts.badge}`}>{t.tier}</span>
                  {t.tag && <span className="text-[9px] font-bold text-slate-600 bg-slate-900 px-1.5 py-0.5 rounded-full">{t.tag}</span>}
                </div>
                <p className="text-sm font-bold text-slate-200 leading-tight">{t.name}</p>
                <p className={`text-lg font-black mt-1 ${ts.accent}`}>${t.price.toFixed(2)}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="flex items-center gap-1 text-[10px] text-slate-600">
                    <Clock size={9} />{t.duration_hours >= 720 ? `${t.duration_hours / 720}mo` : t.duration_hours >= 24 ? `${t.duration_hours / 24}d` : `${t.duration_hours}h`}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-600">
                    <Gauge size={9} />{t.speed_limit || 'unlimited'}
                  </span>
                </div>
                <div className="mt-2.5 text-[10px] font-semibold text-slate-600 group-hover:text-slate-400 transition">
                  Click to pre-fill &rarr;
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Create package form */}
      {showCreate && (
        <div id="create-form">
          <CreatePackageForm
            prefill={prefill}
            onCreated={() => { setShowCreate(false); setPrefill(undefined); load(); }}
            onCancel={() => { setShowCreate(false); setPrefill(undefined); }}
          />
        </div>
      )}

      {/* Existing packages */}
      <div>
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Your Packages ({packages.length})</h2>
        <div className="flex flex-col gap-3">
          {packages.map((pkg) => {
            const current = { ...pkg, ...edits[pkg.id] };
            const speed = parseSpeedLimit(current.speed_limit);
            const hasChanges = !!edits[pkg.id];

            return (
              <div key={pkg.id} className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-200">{pkg.name}</h3>
                    <p className="text-sm text-slate-500">${pkg.price} &mdash; {pkg.duration_hours}h</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${current.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-600'}`}>
                      {current.active ? 'Active' : 'Inactive'}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={current.active}
                        onChange={(e) => updateEdit(pkg.id, 'active', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <Zap size={12} /> Speed Limit
                    </label>
                    <input
                      type="text"
                      value={current.speed_limit}
                      onChange={(e) => updateEdit(pkg.id, 'speed_limit', e.target.value)}
                      placeholder="5M/5M"
                      className="h-10 rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-600">{'\u2193'}{speed.down} / {'\u2191'}{speed.up}</p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <Smartphone size={12} /> Max Devices
                    </label>
                    <input
                      type="number" min={1} max={10}
                      value={current.max_devices}
                      onChange={(e) => updateEdit(pkg.id, 'max_devices', parseInt(e.target.value, 10))}
                      className="h-10 rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <Database size={12} /> Data Limit (MB)
                    </label>
                    <input
                      type="number" min={0}
                      value={current.data_limit_mb ?? ''}
                      onChange={(e) => updateEdit(pkg.id, 'data_limit_mb', e.target.value ? parseInt(e.target.value, 10) : null)}
                      placeholder="Unlimited"
                      className="h-10 rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-600">Empty = unlimited</p>
                  </div>
                </div>

                {hasChanges && (
                  <div className="flex justify-end mt-4">
                    <Button size="sm" onClick={() => savePackage(pkg)} loading={saving === pkg.id}>
                      <Save size={14} /> Save Changes
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {packages.length === 0 && !showCreate && (
            <div className="text-center py-16 text-slate-600 bg-slate-900 rounded-2xl border border-slate-800">
              <Package size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold">No packages yet</p>
              <p className="text-xs mt-1">Click <strong>New Package</strong> above or pick a template to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}