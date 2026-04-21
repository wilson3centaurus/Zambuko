'use client';

import { useEffect, useState, useCallback } from 'react';
import { Filter } from 'lucide-react';
import { DataTable } from '@/components/admin/DataTable';
import { Badge, statusVariant } from '@/components/ui/Badge';
import { formatDate, formatCurrency, maskPhone } from '@/lib/utils/format';
import type { Transaction } from '@/lib/types';

export default function PaymentsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const qs = filterStatus ? `?status=${filterStatus}` : '';
    const res = await fetch(`/api/payments${qs}`).then((r) => r.json());
    if (res.success) { setTransactions(res.data); setTotal(res.total); }
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    {
      key: 'reference', header: 'Reference',
      render: (t: Transaction) => <code className="font-mono text-xs text-gray-700">{t.reference}</code>,
    },
    {
      key: 'phone', header: 'Phone',
      render: (t: Transaction) => maskPhone(t.phone),
    },
    {
      key: 'package', header: 'Package',
      render: (t: Transaction) => (t.package as { name?: string } | undefined)?.name ?? '—',
    },
    {
      key: 'amount', header: 'Amount',
      render: (t: Transaction) => <span className="font-bold">{formatCurrency(t.amount)}</span>,
    },
    {
      key: 'status', header: 'Status',
      render: (t: Transaction) => <Badge variant={statusVariant(t.status)} dot>{t.status}</Badge>,
    },
    {
      key: 'voucher', header: 'Voucher',
      render: (t: Transaction) => {
        const v = t.voucher as { code?: string } | undefined;
        return v?.code
          ? <code className="font-mono text-xs text-brand-600">{v.code}</code>
          : <span className="text-gray-300">—</span>;
      },
    },
    {
      key: 'created_at', header: 'Date',
      render: (t: Transaction) => formatDate(t.created_at),
    },
  ];

  return (
    <div className="p-6 flex flex-col gap-6 max-w-7xl w-full mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500">{total} transactions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'paid', 'failed', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              filterStatus === s
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns as Parameters<typeof DataTable>[0]['columns']}
        data={transactions}
        loading={loading}
        emptyMessage="No transactions found"
      />
    </div>
  );
}
