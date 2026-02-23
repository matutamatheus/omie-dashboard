import type {
  KPIData, AgingBucketData, AgingClientData, TrendPoint, HorizonData,
  TituloRow, RecebimentoRow, DimensionOptions, PaginatedResult, DashboardFilters,
} from '@/types/dashboard';
import * as mockProvider from '@/lib/mock/data-provider';
import * as supabaseProvider from '@/lib/supabase/data-provider';

function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_DATA_MODE !== 'real';
}

function provider() {
  return isMockMode() ? mockProvider : supabaseProvider;
}

export async function getKPIs(filters: DashboardFilters): Promise<KPIData> {
  return provider().getKPIs(filters);
}

export async function getAgingBuckets(filters: DashboardFilters): Promise<AgingBucketData[]> {
  return provider().getAgingBuckets(filters);
}

export async function getAgingByClient(filters: DashboardFilters): Promise<AgingClientData[]> {
  return provider().getAgingByClient(filters);
}

export async function getTrends(filters: DashboardFilters): Promise<TrendPoint[]> {
  return provider().getTrends(filters);
}

export async function getHorizons(filters: DashboardFilters): Promise<HorizonData[]> {
  return provider().getHorizons(filters);
}

export async function getTitulos(
  filters: DashboardFilters,
  page?: number,
  pageSize?: number
): Promise<PaginatedResult<TituloRow>> {
  return provider().getTitulos(filters, page, pageSize);
}

export async function getRecebimentos(
  filters: DashboardFilters,
  page?: number,
  pageSize?: number
): Promise<PaginatedResult<RecebimentoRow>> {
  return provider().getRecebimentos(filters, page, pageSize);
}

export async function getDimensionOptions(): Promise<DimensionOptions> {
  return provider().getDimensionOptions();
}
