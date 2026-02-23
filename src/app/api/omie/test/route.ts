import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.SYNC_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const APP_KEY = process.env.OMIE_APP_KEY || '';
  const APP_SECRET = process.env.OMIE_APP_SECRET || '';
  const BASE = 'https://app.omie.com.br/api/v1';

  async function probe(endpoint: string, call: string, params: Record<string, unknown> = {}) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call,
          app_key: APP_KEY,
          app_secret: APP_SECRET,
          param: [params],
        }),
      });
      const json = await res.json();
      return { status: res.status, data: json };
    } catch (e) {
      return { error: String(e) };
    }
  }

  // Test ListarMovimentos with correct MF pagination
  const mf = await probe(BASE + '/financas/mf/', 'ListarMovimentos', {
    nPagina: 1,
    nRegPorPagina: 2,
    cNatureza: 'R',
  });

  // Also try without cNatureza
  const mf2 = await probe(BASE + '/financas/mf/', 'ListarMovimentos', {
    nPagina: 1,
    nRegPorPagina: 2,
  });

  return NextResponse.json({ mf_with_R: mf, mf_no_filter: mf2 });
}
