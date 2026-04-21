'use client';

import { useEffect, useState, useCallback } from 'react';
import { Monitor, RefreshCw } from 'lucide-react';
import { DataTable } from '@/components/admin/DataTable';
import { Badge, statusVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { formatDate, formatBytes } from '@/lib/utils/format';
import type { Session } from '@/lib/types';

interface SessionRow extends Session {
  live?: {
    uptime: string;
    'bytes-in': string;
    'bytes-out': string;
    'host-name': string;
  } | null;
}

export default function SessionsPage() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(true);
  const [extendModal, setExtendModal] = useState<string | null>(null);
  const [extendHours, setExtendHours] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = activeOnly ? '?active=true' : '';
    const res = await fetch(`/api/sessions${qs}`).then((r) => r.json());
    if (res.success) { setSessions(res.data); setTotal(res.total); }
    setLoading(false);
  }, [activeOnly]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(sessionId: string, action: string, extra?: object) {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    const json = await res.json();
    if (json.success) {
      toast(action === 'disconnect' ? 'Session disconnected' : 'Session extended', 'success');
      setExtendModal(null);
      load();
    } else {
      toast(json.error, 'error');
    }
  }

  const columns = [
    {
      key: 'voucher', header: 'Voucher',
      render: (s: SessionRow) => {
        const v = s.voucher as { code?: string; package?: { name?: string } } | undefined;
        return (
          <div>
            <code className="font-mono font-bold text-blue-400">{v?.code ?? '—'}</code>
            <p className="text-xs text-slate-500">{(v?.package as { name?: string } | undefined)?.name}</p>
          </div>
        );
      },
    },
    { key: 'ip_address', header: 'IP Address' },
    { key: 'mac_address', header: 'MAC Address' },
    {
      key: 'device_name', header: 'Device',
      render: (s: SessionRow) => s.device_name ?? s.live?.['host-name'] ?? '—',
    },
    {
      key: 'start_time', header: 'Start',
      render: (s: SessionRow) => formatDate(s.start_time),
    },
    {
      key: 'end_time', header: 'Expires',
      render: (s: SessionRow) => s.end_time ? formatDate(s.end_time) : '—',
    },
    {
      key: 'data', header: 'Data',
      render: (s: SessionRow) => {
        const bIn = s.live ? parseInt(s.live['bytes-in'] || '0', 10) : s.bytes_in;
        const bOut = s.live ? parseInt(s.live['bytes-out'] || '0', 10) : s.bytes_out;
        return <span className="text-xs text-slate-500">↓{formatBytes(bIn)} ↑{formatBytes(bOut)}</span>;
      },
    },
    {
      key: 'active', header: 'Status',
      render: (s: SessionRow) => (
        <Badge variant={s.active ? 'success' : 'neutral'} dot>
          {s.active ? 'Active' : 'Ended'}
        </Badge>
      ),
    },
    {
      key: 'actions', header: '',
      render: (s: SessionRow) => s.active ? (
        <div className="flex gap-2">
          <button onClick={() => setExtendModal(s.id)} className="text-xs text-blue-400 hover:underline">Extend</button>
          <button onClick={() => {
            if (confirm('Disconnect this user?')) handleAction(s.id, 'disconnect');
          }} className="text-xs text-red-400 hover:underline">
            Kick
          </button>
        </div>
      ) : null,
    },
  ];

  return (
    <div className="p-6 flex flex-col gap-6 max-w-7xl w-full mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-100">User Sessions</h1>
          <p className="text-sm text-slate-500">{total} sessions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={load}><RefreshCw size={16} /> Refresh</Button>
          <button
            onClick={() => setActiveOnly(!activeOnly)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              activeOnly ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Monitor size={14} className="inline mr-1" />
            {activeOnly ? 'Active Only' : 'All Sessions'}
          </button>
        </div>
      </div>

      <DataTable
        columns={columns as Parameters<typeof DataTable>[0]['columns']}
        data={sessions}
        loading={loading}
        emptyMessage="No sessions found"
      />

      <Modal open={!!extendModal} onClose={() => setExtendModal(null)} title="Extend Session">
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-slate-400 mb-1.5 block">Add Hours</label>
            <input
              type="number" min={1} max={720}
              className="w-full h-11 rounded-xl border border-slate-700 bg-slate-800 text-slate-100 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={extendHours}
              onChange={(e) => setExtendHours(parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <Button className="w-full" onClick={() => handleAction(extendModal!, 'extend', { hours: extendHours })}>
            Extend by {extendHours} Hour{extendHours > 1 ? 's' : ''}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
