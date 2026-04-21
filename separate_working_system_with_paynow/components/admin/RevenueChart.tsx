'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface RevenueChartProps {
  data: Array<{ date: string; revenue: number }>;
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickFormatter={(v: string) => format(parseISO(v), 'dd MMM')}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickFormatter={(v: number) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #1e293b',
              background: '#0f172a',
              color: '#f1f5f9',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              fontSize: 13,
            }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
            labelFormatter={(label) => format(parseISO(label as string), 'dd MMM yyyy')}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#3b82f6"
            strokeWidth={2.5}
            fill="url(#revenueGrad)"
            dot={false}
            activeDot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#0f172a' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
