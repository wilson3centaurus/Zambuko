'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw, Activity, Terminal, ChevronDown, Search } from 'lucide-react';
import type { Log } from '@/lib/types';
import { Button } from '@/components/ui/Button';

const LOG_TYPES = ['', 'login', 'payment', 'voucher', 'network', 'error', 'mikrotik'] as const;

const LEVEL_CONFIG = {
  info:  { dot: 'bg-blue-400',   text: 'text-blue-400',   badge: 'bg-blue-500/10 text-blue-400',    line: 'hover:bg-blue-500/5'  },
  warn:  { dot: 'bg-amber-400',  text: 'text-amber-400',  badge: 'bg-amber-400/10 text-amber-400',  line: 'hover:bg-amber-400/5' },
  error: { dot: 'bg-red-500',    text: 'text-red-400',    badge: 'bg-red-500/10 text-red-400',       line: 'hover:bg-red-500/5'   },
};

function pad(n: number, len = 2) { return String(n).padStart(len, '0'); }

function formatTs(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}Z`;
}

function LogEntry({ log }: { log: Log }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = LEVEL_CONFIG[log.level];

  return (
    <div className={`group border-b border-slate-800/50 transition-colors ${cfg.line}`}>
      <div
        className="flex items-start gap-3 px-4 py-2.5 cursor-pointer font-mono text-xs"
        onClick={() => log.metadata && setExpanded((v) => !v)}
      >
        {/* timestamp */}
        <span className="text-slate-600 shrink-0 select-none">{formatTs(log.created_at)}</span>

        {/* level dot */}
        <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />

        {/* level badge */}
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${cfg.badge}`}>
          {log.level}
        </span>

        {/* type tag */}
        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 text-[10px] font-semibold uppercase shrink-0">
          {log.type}
        </span>

        {/* message */}
        <span className={`${cfg.text} flex-1 leading-relaxed break-all`}>{log.message}</span>

        {/* expand indicator */}
        {log.metadata && (
          <ChevronDown
            size={12}
            className={`text-slate-600 group-hover:text-slate-400 shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        )}
      </div>

      {/* expanded metadata */}
      {expanded && log.metadata && (
        <div className="mx-4 mb-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/50">
            <Terminal size={11} className="text-slate-600" />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Metadata</span>
          </div>
          <pre className="p-3 text-[11px] text-slate-300 leading-relaxed overflow-auto max-h-56 font-mono whitespace-pre-wrap">
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filterType) qs.set('type', filterType);
    if (filterLevel) qs.set('level', filterLevel);
    const res = await fetch(`/api/admin/logs?${qs.toString()}`).then((r) => r.json());
    if (res.success) { setLogs(res.data); setTotal(res.total); }
    setLoading(false);
  }, [filterType, filterLevel]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 8000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, load]);

  const displayed = search
    ? logs.filter((l) => l.message.toLowerCase().includes(search.toLowerCase()) || l.type.includes(search.toLowerCase()))
    : logs;

  return (
    <div className="p-6 flex flex-col gap-4 max-w-7xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1">Dashboard / System Logs</p>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2">
            <Terminal size={22} className="text-slate-500" />
            System Logs
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} entries indexed</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
              autoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh'}
          </button>
          <Button variant="ghost" size="sm"
            className="border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            onClick={load}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 flex flex-col gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 h-9">
          <Search size={14} className="text-slate-600 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter log messages..."
            className="flex-1 bg-transparent text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Level filter */}
          <div className="flex items-center gap-1">
            <Activity size={12} className="text-slate-600" />
            {(['', 'info', 'warn', 'error'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setFilterLevel(l)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  filterLevel === l
                    ? l === ''
                      ? 'bg-slate-600 text-slate-200'
                      : `${LEVEL_CONFIG[l as keyof typeof LEVEL_CONFIG].badge}`
                    : 'text-slate-600 hover:text-slate-400'
                }`}
              >
                {l && <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_CONFIG[l as keyof typeof LEVEL_CONFIG].dot}`} />}
                {l || 'All levels'}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Type filter */}
          {LOG_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition ${
                filterType === t
                  ? 'bg-slate-600 text-slate-100'
                  : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              {t || 'all_types'}
            </button>
          ))}

          <span className="ml-auto text-xs text-slate-700 font-mono">{displayed.length} shown</span>
        </div>
      </div>

      {/* Log terminal */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
        {/* Terminal title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/60" />
            <span className="w-3 h-3 rounded-full bg-amber-400/60" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/60" />
          </div>
          <span className="ml-2 text-xs text-slate-600 font-mono">connect-hotspot — system.log</span>
          <span className="ml-auto text-[10px] text-slate-700 font-mono">stream://live</span>
        </div>

        {/* Entries */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-700 font-mono text-sm">
            <RefreshCw size={14} className="animate-spin mr-2" /> Loading log stream...
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-700 font-mono text-sm">
            no matching entries
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-26rem)]">
            {displayed.map((log) => <LogEntry key={log.id} log={log} />)}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 bg-slate-900/30">
          <span className="text-[10px] font-mono text-slate-700">Showing newest first &middot; Click entries with metadata to expand</span>
          {autoRefresh && (
            <span className="text-[10px] font-mono text-emerald-700 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse inline-block" />
              polling every 8s
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
