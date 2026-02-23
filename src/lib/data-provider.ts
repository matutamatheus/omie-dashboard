import type {
  KPIData, AgingBucketData, AgingClientData, TrendPoint, HorizonData,
  TituloRow, RecebimentoRow, DimensionOptions, PaginatedResult, DashboardFilters,
} from '@/types/dashboard';
import * as mockProvider from '@/lib/mock/data-provider';

function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_DATA_MODE !== 'real';
}

export async function getKPIs(filters: DashboardFilters): Promise<KPIData> {
  if (isMockMode()) return mockProvider.getKPIs(filters);
  // TODO: implement Supabase provider
  return mockProvider.getKPIs(filters);
}

export async function getAgingBuckets(filters: DashboardFilters): Promise<AgingBucketData[]> {
  if (isMockMode()) return mockProvider.getAgingBuckets(filters);
  return mockProvider.getAgingBuckets(filters);
}

export async function getAgingByClient(filters: DashboardFilters): Promise<AgingClientData[]> {
  if (isMockMode()) return mockProvider.getAgingByClient(filters);
  return mockProvider.getAgingByClient(filters);
}

export async function getTrends(filters: DashboardFilters): Promise<TrendPoint[]> {
  if (isMockMode()) return mockProvider.getTrends(filters);
  return mockProvider.getTrends(filters);
}

export async function getHorizons(filters: DashboardFilters): Promise<HorizonData[]> {
  if (isMockMode()) return mockProvider.getHorizons(filters);
  return mockProvider.getHorizons(filters);
}

export async function getTitulos(
  filters: DashboardFilters,
  page?: number,
  pageSize?: number
): Promise<PaginatedResult<TituloRow>> {
  if (isMockMode()) return mockProvider.getTitulos(filters, page, pageSize);
  return mockProvider.getTitulos(filters, page, pageSize);
}

export async function getRecebimentos(
  filters: DashboardFilters,
  page?: number,
  pageSize?: number
): Promise<PaginatedResult<RecebimentoRow>> {
  if (isMockMode()) return mockProvider.getRecebimentos(filters, page, pageSize);
  return mockProvider.getRecebimentos(filters, page, pageSize);
}

export async function getDimensionOptions(): Promise<DimensionOptions> {
  if (isMockMode()) return mockProvider.getDimensionOptions();
  return mockProvider.getDimensionOptions();
}
