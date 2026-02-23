import type { DashboardFilters } from '@/types/dashboard';

/** Build URLSearchParams from DashboardFilters. */
export function buildFilterParams(filters: DashboardFilters): URLSearchParams {
  const params = new URLSearchParams({
    dateStart: filters.dateStart,
    dateEnd: filters.dateEnd,
  });
  if (filters.contaCorrenteId) params.set('contaCorrenteId', String(filters.contaCorrenteId));
  if (filters.departamentoId) params.set('departamentoId', String(filters.departamentoId));
  if (filters.vendedorId) params.set('vendedorId', String(filters.vendedorId));
  if (filters.statusTitulo?.length) params.set('statusTitulo', filters.statusTitulo.join(','));
  return params;
}
