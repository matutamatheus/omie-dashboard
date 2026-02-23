export type HorizonKey = 'today' | '7d' | '14d' | '30d' | '60d' | '90d' | '6m' | 'custom';

export interface DashboardFilters {
  dateStart: string;       // ISO date string
  dateEnd: string;         // ISO date string
  horizon: HorizonKey;
  contaCorrenteId?: number;
  departamentoId?: number;
  vendedorId?: number;
  statusTitulo?: string[];
}

export interface KPIData {
  recebido: number;
  aReceber: number;
  vencido: number;
}

export interface HorizonData {
  horizon: string;
  label: string;
  previsto: number;
}

export interface TituloRow {
  id: number;
  clienteNome: string;
  clienteCnpjCpf?: string;
  numeroDocumento?: string;
  numeroParcela?: string;
  dataVencimento: string;
  valorDocumento: number;
  saldoEmAberto: number;
  status: string;
  diasAtraso: number;
  contaCorrente?: string;
  vendedor?: string;
  departamento?: string;
}

export interface RecebimentoRow {
  id: number;
  tituloId: number;
  clienteNome: string;
  dataBaixa: string;
  valorBaixado: number;
  valorDesconto: number;
  valorJuros: number;
  valorMulta: number;
  tipoBaixa?: string;
  liquidado: boolean;
  contaCorrente?: string;
}

export interface DimensionOptions {
  contasCorrentes: { id: number; label: string }[];
  departamentos: { id: number; label: string }[];
  vendedores: { id: number; label: string }[];
}

export interface PaginatedResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}
