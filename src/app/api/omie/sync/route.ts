import { NextRequest, NextResponse } from 'next/server';
import {
  syncClientes,
  syncContasCorrentes,
  syncDepartamentos,
  syncCategorias,
  syncVendedores,
} from '@/lib/omie/sync-dimensions';
import { syncContaReceber } from '@/lib/omie/sync-contareceber';
import { syncRecebimentos } from '@/lib/omie/sync-recebimentos';

export const maxDuration = 60;

const VALID_STEPS = [
  'clientes',
  'contas_correntes',
  'departamentos',
  'categorias',
  'vendedores',
  'titulos',
  'recebimentos',
] as const;

type StepName = (typeof VALID_STEPS)[number];

function getPageParams(request: NextRequest) {
  const fromPage = parseInt(request.nextUrl.searchParams.get('fromPage') || '1', 10);
  const toPage = request.nextUrl.searchParams.get('toPage')
    ? parseInt(request.nextUrl.searchParams.get('toPage')!, 10)
    : undefined;
  return { fromPage, toPage };
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.SYNC_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.NEXT_PUBLIC_DATA_MODE === 'mock') {
    return NextResponse.json({ message: 'Mock mode - sync skipped' });
  }

  const step = request.nextUrl.searchParams.get('step') as StepName | null;

  if (!step || !VALID_STEPS.includes(step)) {
    return NextResponse.json({
      error: 'Missing or invalid step parameter',
      validSteps: VALID_STEPS,
      usage: 'POST /api/omie/sync?step=clientes&fromPage=1&toPage=20',
    }, { status: 400 });
  }

  try {
    let result: unknown;
    const { fromPage, toPage } = getPageParams(request);

    switch (step) {
      case 'clientes':
        result = await syncClientes(fromPage, toPage);
        break;
      case 'contas_correntes':
        result = { entity: 'dim_conta_corrente', records: await syncContasCorrentes() };
        break;
      case 'departamentos':
        result = { entity: 'dim_departamento', records: await syncDepartamentos() };
        break;
      case 'categorias':
        result = { entity: 'dim_categoria', records: await syncCategorias() };
        break;
      case 'vendedores':
        result = { entity: 'dim_vendedor', records: await syncVendedores() };
        break;
      case 'titulos':
        result = await syncContaReceber(fromPage, toPage);
        break;
      case 'recebimentos':
        result = await syncRecebimentos(fromPage, toPage);
        break;
    }

    return NextResponse.json({
      success: true,
      step,
      ...(result && typeof result === 'object' ? result : { result }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[sync] Error in step=${step}:`, message);
    return NextResponse.json({ success: false, step, error: message }, { status: 500 });
  }
}
