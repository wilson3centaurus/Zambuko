import { ReactNode } from 'react';
import { cn } from '@/lib/utils/format';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  loading?: boolean;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  emptyMessage = 'No data available',
  loading = false,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-600 text-sm">
        <svg className="animate-spin h-6 w-6 mr-3 text-blue-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Loading…
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-600 text-sm">
        {emptyMessage}
      </div>
    );
  }

  function getCellValue(row: T, col: Column<T>): ReactNode {
    if (col.render) return col.render(row);
    const key = col.key as keyof T;
    const val = row[key];
    if (val === null || val === undefined) return <span className="text-slate-600">—</span>;
    return String(val);
  }

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={cn(
                  'px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {data.map((row) => (
            <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
              {columns.map((col) => (
                <td
                  key={String(col.key)}
                  className={cn('px-4 py-3 text-slate-300 whitespace-nowrap', col.className)}
                >
                  {getCellValue(row, col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
