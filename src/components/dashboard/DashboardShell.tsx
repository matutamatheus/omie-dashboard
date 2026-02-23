'use client';

import { useState } from 'react';
import { FilterBar } from '@/components/filters/FilterBar';
import { KPICards } from '@/components/dashboard/KPICards';
import { HorizonBarChart } from '@/components/charts/HorizonBarChart';
import { DailyReceivablesChart } from '@/components/charts/DailyReceivablesChart';
import { TitulosTable } from '@/components/tables/TitulosTable';
import { RecebimentosTable } from '@/components/tables/RecebimentosTable';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { BarChart3 } from 'lucide-react';
import type { DashboardFilters } from '@/types/dashboard';

function getDefaultFilters(): DashboardFilters {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    dateStart: start.toISOString().split('T')[0],
    dateEnd: end.toISOString().split('T')[0],
    horizon: '30d',
  };
}

export function DashboardShell() {
  const [filters, setFilters] = useState<DashboardFilters>(getDefaultFilters);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-primary-600" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                Dashboard Financeiro
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Contas a Receber — Omie ERP
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">
              Produção
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
        <FilterBar filters={filters} onChange={setFilters} />
        <KPICards filters={filters} />
        <HorizonBarChart filters={filters} />
        <DailyReceivablesChart filters={filters} />
        <TitulosTable filters={filters} />
        <RecebimentosTable filters={filters} />
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-700 py-4">
        <p className="text-center text-xs text-gray-400">
          Dashboard Recebimentos Omie — Dados em tempo real
        </p>
      </footer>
    </div>
  );
}
