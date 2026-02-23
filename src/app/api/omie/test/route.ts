import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.SYNC_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Count rows in key tables
  const [titCount, recCount] = await Promise.all([
    supabaseAdmin.from('fact_titulo_receber').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('fact_recebimento').select('id', { count: 'exact', head: true }),
  ]);

  // Sample 3 recebimentos
  const { data: sampleRec } = await supabaseAdmin
    .from('fact_recebimento')
    .select('omie_codigo_lancamento, titulo_id, valor_baixado')
    .limit(3);

  // Sample 3 titulos
  const { data: sampleTit } = await supabaseAdmin
    .from('fact_titulo_receber')
    .select('id, omie_codigo_titulo, valor_documento, saldo_em_aberto, caixa_recebido')
    .limit(3);

  // Check if any recebimento omie_codigo_lancamento matches any titulo omie_codigo_titulo
  const { data: sampleRecIds } = await supabaseAdmin
    .from('fact_recebimento')
    .select('omie_codigo_lancamento')
    .limit(10);

  const recIds = (sampleRecIds ?? []).map(r => r.omie_codigo_lancamento);

  // Check if those IDs exist in titulos
  const { data: matchingTitulos } = await supabaseAdmin
    .from('fact_titulo_receber')
    .select('id, omie_codigo_titulo')
    .in('omie_codigo_titulo', recIds.length > 0 ? recIds : [-1]);

  // Count distinct status_titulo values
  const { data: statuses } = await supabaseAdmin
    .from('fact_titulo_receber')
    .select('status_titulo')
    .limit(10000);

  const statusCounts: Record<string, number> = {};
  for (const row of statuses ?? []) {
    statusCounts[row.status_titulo] = (statusCounts[row.status_titulo] || 0) + 1;
  }

  return NextResponse.json({
    titulos_count: titCount.count,
    recebimentos_count: recCount.count,
    sample_recebimentos: sampleRec,
    sample_titulos: sampleTit,
    recebimento_ids_sample: recIds,
    matching_titulos_for_rec_ids: matchingTitulos,
    status_titulo_distribution: statusCounts,
  });
}
