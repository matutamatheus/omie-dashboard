'use client';

import { useEffect, useState } from 'react';
import { PeriodSelector } from './PeriodSelector';
import { DimensionFilter } from './DimensionFilter';
import { Download, RotateCcw } from 'lucide-react';
import type { DashboardFilters, DimensionOptions } from '@/types/dashboard';

interface FilterBarProps {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const [dimensions, setDimensions] = useState<DimensionOptions>({
    contasCorrentes: [],
    departamentos: [],
    vendedores: [],
  });
  const [preset, setPreset] = useState('30d');

  useEffect(() => {
    fetch('/api/dashboard/dimensions')
      .then((res) => res.json())
      .then((data) => setDimensions(data))
      .catch(() => null);
  }, []);

  const handleReset = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setPreset('30d');
    onChange({
      dateStart: start.toISOString().split('T')[0],
      dateEnd: end.toISOString().split('T')[0],
      horizon: '30d',
      contaCorrenteId: undefined,
      departamentoId: undefined,
      vendedorId: undefined,
      statusTitulo: undefined,
    });
  };

  const buildExportUrl = (type: string) => {
    const params = new URLSearchParams({
      type,
      dateStart: filters.dateStart,
      dateEnd: filters.dateEnd,
    });
    return `/api/dashboard/export?${params}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PeriodSelector
          selectedPreset={preset}
          dateStart={filters.dateStart}
          dateEnd={filters.dateEnd}
          onPresetChange={(p, start, end) => {
            setPreset(p);
            onChange({ ...filters, dateStart: start, dateEnd: end, horizon: p as never });
          }}
          onCustomChange={(start, end) => {
            setPreset('custom');
            onChange({ ...filters, dateStart: start, dateEnd: end, horizon: 'custom' });
          }}
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <DimensionFilter
          label="Conta Corrente"
          options={dimensions.contasCorrentes}
          value={filters.contaCorrenteId}
          onChange={(v) => onChange({ ...filters, contaCorrenteId: v })}
        />
        <DimensionFilter
          label="Departamento"
          options={dimensions.departamentos}
          value={filters.departamentoId}
          onChange={(v) => onChange({ ...filters, departamentoId: v })}
        />
        <DimensionFilter
          label="Vendedor"
          options={dimensions.vendedores}
          value={filters.vendedorId}
          onChange={(v) => onChange({ ...filters, vendedorId: v })}
        />

        <div className="ml-auto flex items-center gap-2">
          <a
            href={buildExportUrl('titulos')}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            CSV Títulos
          </a>
          <a
            href={buildExportUrl('recebimentos')}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            CSV Recebimentos
          </a>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
