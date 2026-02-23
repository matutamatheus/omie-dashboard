export interface DimCliente {
  id: number;
  codigo_integracao?: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj_cpf?: string;
  cidade?: string;
  estado?: string;
  email?: string;
  telefone?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DimContaCorrente {
  id: number;
  descricao: string;
  tipo?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  ativo: boolean;
}

export interface DimDepartamento {
  id: number;
  descricao: string;
  ativo: boolean;
}

export interface DimCategoria {
  id: number;
  descricao: string;
  descricao_padrao?: string;
  ativo: boolean;
}

export interface DimVendedor {
  id: number;
  nome: string;
  email?: string;
  ativo: boolean;
}

export interface FactTituloReceber {
  id: number;
  codigo_integracao?: string;
  cliente_id: number;
  conta_corrente_id?: number;
  departamento_id?: number;
  categoria_id?: number;
  vendedor_id?: number;
  numero_documento?: string;
  numero_parcela?: string;
  data_emissao: string;
  data_vencimento: string;
  data_previsao?: string;
  data_registro?: string;
  valor_documento: number;
  status_titulo: string;
  observacao?: string;
  principal_liquidado: number;
  saldo_em_aberto: number;
  caixa_recebido: number;
  desconto_concedido: number;
  omie_updated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface FactRecebimento {
  id: number;
  codigo_baixa_integracao?: string;
  titulo_id: number;
  conta_corrente_id?: number;
  data_baixa: string;
  valor_baixado: number;
  valor_desconto: number;
  valor_juros: number;
  valor_multa: number;
  tipo_baixa?: string;
  liquidado: boolean;
  observacao?: string;
  created_at: string;
  updated_at: string;
}

export interface FactExtratoCC {
  id: number;
  conta_corrente_id: number;
  data_lancamento: string;
  descricao?: string;
  documento?: string;
  tipo?: string;
  valor: number;
  saldo?: number;
  titulo_id?: number;
  data_conciliacao?: string;
}

export interface BridgeTituloNF {
  titulo_id: number;
  nf_id: number;
  numero_nf?: string;
  serie?: string;
  chave_nfe?: string;
}

export interface AuditSyncRun {
  id: number;
  entity: string;
  started_at: string;
  finished_at?: string;
  status: 'running' | 'success' | 'error';
  records_fetched: number;
  records_upserted: number;
  last_sync_cursor?: string;
  error_message?: string;
}
