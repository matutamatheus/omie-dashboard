export const OMIE_BASE_URL = 'https://app.omie.com.br/api/v1';

export const OMIE_ENDPOINTS = {
  contaReceber: `${OMIE_BASE_URL}/financas/contareceber/`,
  movimentosFinanceiros: `${OMIE_BASE_URL}/financas/mf/`,
  extrato: `${OMIE_BASE_URL}/financas/extrato/`,
  pesquisarTitulos: `${OMIE_BASE_URL}/financas/pesquisartitulos/`,
  clientes: `${OMIE_BASE_URL}/geral/clientes/`,
  departamentos: `${OMIE_BASE_URL}/geral/departamentos/`,
  categorias: `${OMIE_BASE_URL}/geral/categorias/`,
  contasCorrentes: `${OMIE_BASE_URL}/geral/contacorrente/`,
  vendedores: `${OMIE_BASE_URL}/geral/vendedores/`,
  nfConsultar: `${OMIE_BASE_URL}/produtos/nfconsultar/`,
  dfeDocs: `${OMIE_BASE_URL}/produtos/dfedocs/`,
} as const;
