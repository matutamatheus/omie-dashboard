import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.SYNC_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check vendedor and departamento data
  const { data: vendedores } = await supabaseAdmin
    .from('dim_vendedor')
    .select('id, omie_codigo, nome, ativo')
    .limit(10);

  const { data: departamentos } = await supabaseAdmin
    .from('dim_departamento')
    .select('id, omie_codigo, descricao, ativo')
    .limit(10);

  // Check how many titulos have vendedor_id and departamento_id set
  const { data: titulosWithVendedor } = await supabaseAdmin
    .from('fact_titulo_receber')
    .select('id, vendedor_id, departamento_id')
    .not('vendedor_id', 'is', null)
    .limit(5);

  const { data: titulosWithDept } = await supabaseAdmin
    .from('fact_titulo_receber')
    .select('id, vendedor_id, departamento_id')
    .not('departamento_id', 'is', null)
    .limit(5);

  const { count: totalTitulos } = await supabaseAdmin
    .from('fact_titulo_receber')
    .select('id', { count: 'exact', head: true });

  const { count: titulosWithVendedorCount } = await supabaseAdmin
    .from('fact_titulo_receber')
    .select('id', { count: 'exact', head: true })
    .not('vendedor_id', 'is', null);

  const { count: titulosWithDeptCount } = await supabaseAdmin
    .from('fact_titulo_receber')
    .select('id', { count: 'exact', head: true })
    .not('departamento_id', 'is', null);

  // Sample a titulo with its joins to check names
  const { data: sampleTitulo } = await supabaseAdmin
    .from('fact_titulo_receber')
    .select(`
      id, omie_codigo_titulo, vendedor_id, departamento_id,
      dim_vendedor(id, omie_codigo, nome),
      dim_departamento(id, omie_codigo, descricao)
    `)
    .not('vendedor_id', 'is', null)
    .limit(3);

  // Probe Omie API for a sample conta a receber to check vendedor/departamento fields
  const APP_KEY = process.env.OMIE_APP_KEY || '';
  const APP_SECRET = process.env.OMIE_APP_SECRET || '';
  const BASE = 'https://app.omie.com.br/api/v1';

  let sampleOmieTitulo = null;
  try {
    const res = await fetch(BASE + '/financas/contareceber/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call: 'ListarContasReceber',
        app_key: APP_KEY,
        app_secret: APP_SECRET,
        param: [{ pagina: 1, registros_por_pagina: 2 }],
      }),
    });
    const json = await res.json();
    sampleOmieTitulo = json.conta_receber_cadastro?.slice(0, 2);
  } catch (e) {
    sampleOmieTitulo = { error: String(e) };
  }

  return NextResponse.json({
    vendedores,
    departamentos,
    totalTitulos,
    titulosWithVendedorCount,
    titulosWithDeptCount,
    sampleTitulosWithVendedor: titulosWithVendedor,
    sampleTitulosWithDept: titulosWithDept,
    sampleTituloJoined: sampleTitulo,
    sampleOmieTitulo,
  });
}
