'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/utils/formatters';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TituloRow, DashboardFilters, PaginatedResult } from '@/types/dashboard';

interface Props {
  filters: DashboardFilters;
}

export function TitulosTable({ filters }: Props) {
  const [result, setResult] = useState<PaginatedResult<TituloRow> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<string>('diasAtraso');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      dateStart: filters.dateStart,
      dateEnd: filters.dateEnd,
      mode: filters.mode,
      page: String(page),
      pageSize: '20',
    });

    fetch(`/api/dashboard/titulos?${params}`)
      .then((r) => r.json())
      .then(setResult)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters, page]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const rows = result?.rows || [];
  const sortedRows = [...rows].sort((a, b) => {
    const aVal = (a as unknown as Record<string, unknown>)[sortField];
    const bVal = (b as unknown as Record<string, unknown>)[sortField];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return sortDir === 'asc'
      ? String(aVal || '').localeCompare(String(bVal || ''))
      : String(bVal || '').localeCompare(String(aVal || ''));
  });

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 1;

  const SortHeader = ({ field, label }: { field: string; label: string }) => (
    <th
      onClick={() => handleSort(field)}
      className="text-left py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 text-xs select-none"
    >
      {label} {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Títulos em Aberto
        </h3>
        <span className="text-xs text-gray-400">
          {result ? `${result.total} títulos` : ''}
        </span>
      </div>

      {loading ? (
        <div className="h-48 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <SortHeader field="clienteNome" label="Cliente" />
                  <SortHeader field="numeroDocumento" label="Documento" />
                  <SortHeader field="numeroParcela" label="Parcela" />
                  <SortHeader field="dataVencimento" label="Vencimento" />
                  <SortHeader field="valorDocumento" label="Valor" />
                  <SortHeader field="saldoEmAberto" label="Saldo" />
                  <SortHeader field="diasAtraso" label="Dias Atraso" />
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500 dark:text-gray-400 text-xs">Status</th>
                  <SortHeader field="vendedor" label="Vendedor" />
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="py-2 px-3 text-gray-800 dark:text-gray-200 max-w-[200px] truncate">
                      {row.clienteNome}
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{row.numeroDocumento}</td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{row.numeroParcela}</td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{row.dataVencimento}</td>
                    <td className="py-2 px-3 text-right text-gray-800 dark:text-gray-200">{formatCurrency(row.valorDocumento)}</td>
                    <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(row.saldoEmAberto)}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={row.diasAtraso > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-400'}>
                        {row.diasAtraso}
                      </span>
                    </td>
                    <td className="py-2 px-3"><StatusBadge status={row.status} /></td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{row.vendedor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 px-3">
            <span className="text-xs text-gray-400">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
