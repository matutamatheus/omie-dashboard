export type DateMode = 'vencimento' | 'previsao';
export type HorizonKey = 'today' | '7d' | '14d' | '30d' | '60d' | '90d' | '6m' | 'custom';

export interface DashboardFilters {
  dateStart: string;       // ISO date string
  dateEnd: string;         // ISO date string
  mode: DateMode;
  horizon: HorizonKey;
  contaCorrenteId?: number;
  departamentoId?: number;
  vendedorId?: number;
  statusTitulo?: string[];
}

export interface KPIData {
  recebido: number;
  previsto: number;
  emAtraso: number;
  taxaInadimplencia: number;
  clientesInadimplentes: number;
  churnRecebiveis: number;
}

export interface AgingBucketData {
  bucket: string;
  saldo: number;
  quantidade: number;
}

export interface AgingClientData {
  clienteId: number;
  clienteNome: string;
  emDia: number;
  de1a30: number;
  de31a60: number;
  de61a90: number;
  acima90: number;
  total: number;
}

export interface TrendPoint {
  date: string;
  recebido: number;
  previsto: number;
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
  dataPrevisao?: string;
  valorDocumento: number;
  saldoEmAberto: number;
  caixaRecebido: number;
  descontoConcedido: number;
  status: string;
  diasAtraso: number;
  agingBucket: string;
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
