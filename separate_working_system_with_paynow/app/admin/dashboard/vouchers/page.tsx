'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Download, Eye, EyeOff, Hash } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils/format';
import type { Voucher, Package, VoucherStatus } from '@/lib/types';

// ── Status style map ──────────────────────────────────────────────────────────

const STATUS_STYLES: Record<VoucherStatus, { row: string; dot: string; badge: string; label: string }> = {
  unused:   { row: 'border-l-2 border-l-emerald-500 bg-emerald-500/5',   dot: 'bg-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400', label: 'Unused'   },
  active:   { row: 'border-l-2 border-l-amber-400   bg-amber-400/5',     dot: 'bg-amber-400',   badge: 'bg-amber-400/10 text-amber-400',    label: 'Active'   },
  expired:  { row: 'border-l-2 border-l-red-500     bg-red-500/5',       dot: 'bg-red-500',     badge: 'bg-red-500/10 text-red-400',        label: 'Expired'  },
  disabled: { row: 'border-l-2 border-l-slate-700   bg-transparent',     dot: 'bg-slate-600',   badge: 'bg-slate-800 text-slate-500',       label: 'Disabled' },
};

export default function VouchersPage() {
  const { toast } = useToast();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPackage, setFilterPackage] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [genForm, setGenForm] = useState({ packageId: '', quantity: 10, secret: '' });
  const [generating, setGenerating] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [revealAll, setRevealAll] = useState(false);
  const [voucherSecretRequired, setVoucherSecretRequired] = useState(false);

  const loadVouchers = useCallback(async () => {
    setLoading(true);
    const qs = filterStatus ? `?status=${filterStatus}` : '';
    const [vRes, pRes, sRes] = await Promise.all([
      fetch(`/api/vouchers${qs}`).then((r) => r.json()),
      fetch('/api/admin/network').then((r) => r.json()),
      fetch('/api/admin/settings').then((r) => r.json()),
    ]);
    if (vRes.success) { setVouchers(vRes.data); setTotal(vRes.total); }
    if (pRes.success) setPackages(pRes.data);
    if (sRes.success) setVoucherSecretRequired(!!sRes.data.voucher_secret);
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { loadVouchers(); }, [loadVouchers]);

  const filtered = filterPackage
    ? vouchers.filter((v) => v.package_id === filterPackage)
    : vouchers;

  const countByStatus = (s: string) => vouchers.filter((v) => v.status === s).length;

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function isRevealed(id: string) { return revealAll || revealed.has(id); }

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch('/api/vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(genForm),
    });
    const json = await res.json();
    setGenerating(false);
    if (json.success) {
      toast(`Generated ${json.data.count} vouchers successfully`, 'success');
      setModalOpen(false);
      setGenForm((f) => ({ ...f, secret: '' }));
      loadVouchers();
    } else {
      toast(json.error, 'error');
    }
  }

  async function handleDisable(id: string) {
    if (!confirm('Disable this voucher? Any active session will be disconnected.')) return;
    const res = await fetch(`/api/vouchers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'disabled' }),
    });
    const json = await res.json();
    if (json.success) { toast('Voucher disabled', 'success'); loadVouchers(); }
    else toast(json.error, 'error');
  }

  function exportCSV() {
    const rows = ['Code,Package,Price,Status,Created,Used,Expires'];
    vouchers.forEach((v) => {
      rows.push([
        v.code,
        v.package?.name ?? v.package_id,
        v.package?.price ?? '',
        v.status,
        formatDate(v.created_at),
        v.used_at ? formatDate(v.used_at) : '',
        v.expires_at ? formatDate(v.expires_at) : '',
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'vouchers.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const inputCls = 'h-10 rounded-xl bg-slate-800 border border-slate-700 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="p-6 flex flex-col gap-6 max-w-7xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1">Dashboard / Vouchers</p>
          <h1 className="text-2xl font-black text-slate-100">Vouchers</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} total vouchers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={exportCSV}
            className="border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800">
            <Download size={16} /> Export CSV
          </Button>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Generate
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Status filter */}
        <div className="flex gap-1.5">
          {(['', 'unused', 'active', 'expired', 'disabled'] as const).map((s) => {
            const style = s ? STATUS_STYLES[s as VoucherStatus] : null;
            const count = s ? countByStatus(s) : vouchers.length;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  filterStatus === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {style && <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />}
                {s ? style!.label : 'All'}
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-xs ${filterStatus === s ? 'bg-white/20' : 'bg-slate-700 text-slate-500'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="h-5 w-px bg-slate-800 mx-1" />

        {/* Package filter */}
        <div className="flex items-center gap-2">
          <Hash size={13} className="text-slate-600" />
          <select
            value={filterPackage}
            onChange={(e) => setFilterPackage(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-sm text-slate-400 rounded-xl px-3 h-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All packages</option>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setRevealAll((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 transition"
          >
            {revealAll ? <EyeOff size={13} /> : <Eye size={13} />}
            {revealAll ? 'Hide all codes' : 'Reveal all codes'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {['#', 'Code', 'Package', 'Status', 'Created', 'Expires', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-600">Loading vouchers...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-600">No vouchers found</td></tr>
              ) : filtered.map((v, idx) => {
                const st = STATUS_STYLES[v.status];
                const show = isRevealed(v.id);
                return (
                  <tr
                    key={v.id}
                    className={`border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors group ${st.row}`}
                  >
                    <td className="px-4 py-3 text-slate-600 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code
                          className={`font-mono text-sm tracking-wider text-slate-200 transition-all duration-200 cursor-pointer select-none ${
                            show ? '' : 'blur-sm'
                          }`}
                          onClick={() => toggleReveal(v.id)}
                          title={show ? 'Click to hide' : 'Click to reveal'}
                        >
                          {v.code}
                        </code>
                        <button
                          onClick={() => toggleReveal(v.id)}
                          className="opacity-0 group-hover:opacity-100 transition p-1 rounded text-slate-600 hover:text-slate-300"
                        >
                          {show ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{v.package?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${st.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(v.created_at)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {v.expires_at ? formatDate(v.expires_at) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {(v.status === 'unused' || v.status === 'active') && (
                        <button
                          onClick={() => handleDisable(v.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition"
                        >
                          Disable
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-slate-500 px-1">
        <span className="font-semibold text-slate-600 uppercase tracking-wider">Status key:</span>
        {(Object.entries(STATUS_STYLES) as [VoucherStatus, typeof STATUS_STYLES[VoucherStatus]][]).map(([key, s]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        ))}
        <span className="ml-auto text-slate-600 italic">Click a code to reveal it</span>
      </div>

      {/* Generate modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Generate Vouchers"
        className="!bg-slate-900 border border-slate-800">
        <div className="flex flex-col gap-4 px-6 pb-6">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Package</label>
            <select
              className={`${inputCls} w-full`}
              value={genForm.packageId}
              onChange={(e) => setGenForm((f) => ({ ...f, packageId: e.target.value }))}
            >
              <option value="">Select a package...</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>{p.name} &ndash; ${p.price}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Quantity (max 500)</label>
            <input
              type="number" min={1} max={500}
              className={inputCls}
              value={genForm.quantity}
              onChange={(e) => setGenForm((f) => ({ ...f, quantity: parseInt(e.target.value, 10) || 1 }))}
            />
          </div>
          {voucherSecretRequired && (
            <div>
              <label className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5 block">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                Voucher Secret Key (required)
              </label>
              <input
                type="password"
                className={inputCls}
                value={genForm.secret}
                onChange={(e) => setGenForm((f) => ({ ...f, secret: e.target.value }))}
                placeholder="Enter the secret passphrase…"
                autoComplete="off"
              />
            </div>
          )}
          <Button
            className="w-full"
            onClick={handleGenerate}
            loading={generating}
            disabled={!genForm.packageId}
          >
            Generate Vouchers
          </Button>
        </div>
      </Modal>
    </div>
  );
}
