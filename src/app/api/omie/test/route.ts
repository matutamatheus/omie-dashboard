import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.SYNC_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const APP_KEY = process.env.OMIE_APP_KEY || '';
  const APP_SECRET = process.env.OMIE_APP_SECRET || '';
  const BASE = 'https://app.omie.com.br/api/v1';

  async function probe(endpoint: string, call: string, extraParams: Record<string, unknown> = {}) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call,
          app_key: APP_KEY,
          app_secret: APP_SECRET,
          param: [{ pagina: 1, registros_por_pagina: 1, ...extraParams }],
        }),
      });
      const json = await res.json();
      const keys = Object.keys(json);
      const arrayKeys = keys.filter((k) => Array.isArray(json[k]));
      const sampleKeys = arrayKeys.length > 0 && json[arrayKeys[0]]?.[0]
        ? Object.keys(json[arrayKeys[0]][0]).slice(0, 15)
        : [];
      return {
        status: res.status,
        keys,
        arrayKeys,
        sampleKeys,
        total: json.total_de_registros ?? json.nTotRegistros ?? null,
        fault: json.faultstring || json.message || null,
        sampleData: arrayKeys.length > 0 && json[arrayKeys[0]]?.[0]
          ? json[arrayKeys[0]][0]
          : null,
      };
    } catch (e) {
      return { error: String(e) };
    }
  }

  const results: Record<string, unknown> = {};

  // Test Contas Correntes
  results.contasCorrentes = await probe(BASE + '/geral/contacorrente/', 'ListarContasCorrentes');

  // Test Departamentos
  results.departamentos = await probe(BASE + '/geral/departamentos/', 'ListarDepartamentos');

  // Test Categorias
  results.categorias = await probe(BASE + '/geral/categorias/', 'ListarCategorias');

  // Test MF with various call names
  results.mf_PesquisarLancamentos = await probe(BASE + '/financas/mf/', 'PesquisarLancamentos', { cNatureza: 'REC' });
  results.mf_ListarMovimentos = await probe(BASE + '/financas/mf/', 'ListarMovimentos', { cNatureza: 'REC' });
  results.mf_ListarMovimentosNoNat = await probe(BASE + '/financas/mf/', 'ListarMovimentos');

  // Test ContaReceber to see if it has baixas embedded
  results.contaReceber_sample = await probe(BASE + '/financas/contareceber/', 'ListarContasReceber');

  return NextResponse.json(results);
}
