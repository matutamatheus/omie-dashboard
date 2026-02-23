import { z } from 'zod';

// Conta a Receber
export const ContaReceberSchema = z.object({
  codigo_lancamento_omie: z.number(),
  codigo_lancamento_integracao: z.string().optional().default(''),
  codigo_cliente_fornecedor: z.number(),
  codigo_categoria: z.string().optional().default(''),
  data_emissao: z.string().optional().default(''),
  data_vencimento: z.string(),
  data_previsao: z.string().optional().default(''),
  data_registro: z.string().optional().default(''),
  valor_documento: z.number(),
  status_titulo: z.string(),
  numero_documento: z.string().optional().default(''),
  numero_parcela: z.string().optional().default(''),
  numero_documento_fiscal: z.string().optional().default(''),
  chave_nfe: z.string().optional().default(''),
  id_conta_corrente: z.number().optional(),
  codigo_vendedor: z.number().optional(),
  observacao: z.string().optional().default(''),
  distribuicao: z.array(z.object({
    codigo_departamento: z.string().optional(),
    percentual: z.number().optional(),
    valor: z.number().optional(),
  })).optional().default([]),
}).passthrough();

export type ContaReceber = z.infer<typeof ContaReceberSchema>;

export const ListarContasReceberResponseSchema = z.object({
  pagina: z.number(),
  total_de_paginas: z.number(),
  registros: z.number(),
  total_de_registros: z.number(),
  conta_receber_cadastro: z.array(ContaReceberSchema).default([]),
});

// Cliente
export const ClienteSchema = z.object({
  codigo_cliente_omie: z.number(),
  codigo_cliente_integracao: z.string().optional().default(''),
  razao_social: z.string(),
  nome_fantasia: z.string().optional().default(''),
  cnpj_cpf: z.string().optional().default(''),
  cidade: z.string().optional().default(''),
  estado: z.string().optional().default(''),
  email: z.string().optional().default(''),
  telefone1_numero: z.string().optional().default(''),
  inativo: z.string().optional().default('N'),
}).passthrough();

export type OmieCliente = z.infer<typeof ClienteSchema>;

// Movimento Financeiro (ListarMovimentos on /financas/mf/)
export const MovimentoFinanceiroSchema = z.object({
  nCodMovimento: z.number().optional(),
  nCodTitulo: z.number().optional(),
  nCodCliente: z.number().optional(),
  cNumDocumento: z.string().optional().default(''),
  cNumParcela: z.string().optional().default(''),
  dDtEmissao: z.string().optional().default(''),
  dDtVencimento: z.string().optional().default(''),
  dDtPagamento: z.string().optional().default(''),
  dDtPrevisao: z.string().optional().default(''),
  dDtCredito: z.string().optional().default(''),
  dDtConcilia: z.string().optional().default(''),
  nValorTitulo: z.number().optional().default(0),
  nValorPago: z.number().optional().default(0),
  nDesconto: z.number().optional().default(0),
  nJuros: z.number().optional().default(0),
  nMulta: z.number().optional().default(0),
  cStatus: z.string().optional().default(''),
  cNatureza: z.string().optional().default(''),
  nCodCC: z.number().optional(),
  nCodBaixa: z.number().optional(),
}).passthrough();

export type MovimentoFinanceiro = z.infer<typeof MovimentoFinanceiroSchema>;

// Conta Corrente - field names match real Omie API response
export const ContaCorrenteSchema = z.object({
  nCodCC: z.number(),
  descricao: z.string(),
  tipo_conta_corrente: z.string().optional().default(''),
  codigo_banco: z.string().optional().default(''),
  codigo_agencia: z.string().optional().default(''),
  numero_conta_corrente: z.string().optional().default(''),
  inativo: z.string().optional().default('N'),
}).passthrough();

export type OmieContaCorrente = z.infer<typeof ContaCorrenteSchema>;

// Departamento - codigo is a string in the API
export const DepartamentoSchema = z.object({
  codigo: z.string(),
  descricao: z.string(),
  inativo: z.string().optional().default('N'),
}).passthrough();

export type OmieDepartamento = z.infer<typeof DepartamentoSchema>;

// Categoria - codigo is a string (e.g. "1.01.01")
export const CategoriaSchema = z.object({
  codigo: z.string(),
  descricao: z.string(),
  descricao_padrao: z.string().optional().default(''),
  conta_inativa: z.string().optional().default('N'),
}).passthrough();

export type OmieCategoria = z.infer<typeof CategoriaSchema>;

// Vendedor
export const VendedorSchema = z.object({
  codigo: z.number(),
  nome: z.string(),
  email: z.string().optional().default(''),
  inativo: z.string().optional().default('N'),
}).passthrough();

export type OmieVendedor = z.infer<typeof VendedorSchema>;

// Extrato
export const ExtratoMovSchema = z.object({
  nCodMov: z.number().optional(),
  dDtLanc: z.string().optional().default(''),
  cDescricao: z.string().optional().default(''),
  cDocumento: z.string().optional().default(''),
  cOperacao: z.string().optional().default(''),
  nValor: z.number().optional().default(0),
  nSaldo: z.number().optional().default(0),
  nCodCliente: z.number().optional(),
  dDataConciliacao: z.string().optional().default(''),
}).passthrough();

export type ExtratoMov = z.infer<typeof ExtratoMovSchema>;
