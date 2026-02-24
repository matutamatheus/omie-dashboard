'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/utils/formatters';
import { buildFilterParams } from '@/lib/utils/filter-params';
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
    const params = buildFilterParams(filters);
    params.set('page', String(page));
    params.set('pageSize', '20');

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
      {label} {sortField === field ? (sortDir === 'asc' ? '\u2191' : '\u2193') : ''}
    </th>
  );

  return (
    <Card className="overflow-hidden">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Titulos em Aberto
          </h3>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {result ? `${result.total} titulos` : ''}
          </span>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
          Lista de todos os titulos (boletos, notas, parcelas) com saldo pendente. Cada linha representa um documento financeiro emitido para um cliente.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-400 dark:text-gray-500">
          <span><strong className="text-gray-500 dark:text-gray-400">Cliente:</strong> Razao social do devedor</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Documento:</strong> Numero do documento fiscal</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Parcela:</strong> Numero da parcela (quando parcelado)</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Vencimento:</strong> Data limite para pagamento</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Valor:</strong> Valor original do documento</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Saldo:</strong> Quanto ainda falta pagar</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Dias Atraso:</strong> Dias desde o vencimento (0 = em dia)</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Status:</strong> Situacao atual do titulo no Omie</span>
          <span><strong className="text-gray-500 dark:text-gray-400">Vendedor:</strong> Responsavel pela venda</span>
        </div>
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
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{row.vendedor || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 px-3">
            <span className="text-xs text-gray-400">
              Pagina {page} de {totalPages}
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
