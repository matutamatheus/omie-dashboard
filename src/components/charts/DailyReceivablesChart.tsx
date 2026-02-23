'use client';

import { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { Card } from '@/components/ui/Card';
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/formatters';
import { buildFilterParams } from '@/lib/utils/filter-params';
import type { DailyReceivable, DashboardFilters } from '@/types/dashboard';

type RangeKey = '6m-past' | '3m-past' | '1m-past' | '1m-future' | '3m-future' | '6m-future' | 'all';

const RANGE_OPTIONS: { key: RangeKey; label: string; monthsBack: number; monthsForward: number }[] = [
  { key: '6m-past', label: '-6m', monthsBack: 6, monthsForward: 0 },
  { key: '3m-past', label: '-3m', monthsBack: 3, monthsForward: 0 },
  { key: '1m-past', label: '-1m', monthsBack: 1, monthsForward: 0 },
  { key: '1m-future', label: '+1m', monthsBack: 0, monthsForward: 1 },
  { key: '3m-future', label: '+3m', monthsBack: 0, monthsForward: 3 },
  { key: '6m-future', label: '+6m', monthsBack: 0, monthsForward: 6 },
  { key: 'all', label: 'Tudo', monthsBack: 6, monthsForward: 6 },
];

function getRange(opt: typeof RANGE_OPTIONS[number]): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - opt.monthsBack);
  const end = new Date(now);
  end.setMonth(end.getMonth() + opt.monthsForward);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

interface Props {
  filters: DashboardFilters;
}

export function DailyReceivablesChart({ filters }: Props) {
  const [data, setData] = useState<DailyReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeKey, setRangeKey] = useState<RangeKey>('all');

  const selectedRange = useMemo(
    () => RANGE_OPTIONS.find((o) => o.key === rangeKey)!,
    [rangeKey],
  );

  useEffect(() => {
    setLoading(true);
    const params = buildFilterParams(filters);
    const { start, end } = getRange(selectedRange);
    params.set('rangeStart', start);
    params.set('rangeEnd', end);

    fetch(`/api/dashboard/daily-receivables?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters, selectedRange]);

  const totalSaldo = useMemo(() => data.reduce((sum, d) => sum + d.saldo, 0), [data]);
  const totalRecebido = useMemo(() => data.reduce((sum, d) => sum + d.recebido, 0), [data]);

  const todayLabel = `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  return (
    <Card>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Vencimentos por Dia
          </h3>
          {!loading && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              A receber: <span className="font-semibold text-blue-600 dark:text-blue-400">{formatCompactCurrency(totalSaldo)}</span>
              {' · '}Recebido: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCompactCurrency(totalRecebido)}</span>
              {' · '}{data.length} dias
            </p>
          )}
        </div>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRangeKey(opt.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                rangeKey === opt.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="h-72 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      ) : data.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Nenhum vencimento no período selecionado</p>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              stroke="#9ca3af"
              interval={data.length > 60 ? Math.floor(data.length / 20) : data.length > 30 ? Math.floor(data.length / 15) : 0}
              angle={data.length > 15 ? -45 : 0}
              textAnchor={data.length > 15 ? 'end' : 'middle'}
              height={data.length > 15 ? 50 : 30}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
              tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}K`}
            />
            <Tooltip
              formatter={(value: any, name: any) => [
                formatCurrency(Number(value || 0)),
                name === 'recebido' ? 'Recebido' : 'A Receber',
              ]}
              labelFormatter={(label) => `Data: ${label}`}
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#f3f4f6',
                fontSize: 12,
              }}
            />
            <Legend
              formatter={(value) => (value === 'recebido' ? 'Recebido' : 'A Receber')}
              wrapperStyle={{ fontSize: 11 }}
            />
            {(rangeKey === 'all' || rangeKey.includes('past')) && (
              <ReferenceLine
                x={todayLabel}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{ value: 'Hoje', position: 'top', fontSize: 10, fill: '#ef4444' }}
              />
            )}
            <Bar dataKey="recebido" radius={[2, 2, 0, 0]} fill="#10b981" />
            <Bar dataKey="saldo" radius={[2, 2, 0, 0]} fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
