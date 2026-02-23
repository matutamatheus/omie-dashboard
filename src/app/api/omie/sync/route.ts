import { NextRequest, NextResponse } from 'next/server';
import { syncAllDimensions } from '@/lib/omie/sync-dimensions';
import { syncContaReceber } from '@/lib/omie/sync-contareceber';
import { syncRecebimentos } from '@/lib/omie/sync-recebimentos';

export const maxDuration = 60;

type StepName = 'dimensions' | 'titulos' | 'recebimentos' | 'all';

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.SYNC_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.NEXT_PUBLIC_DATA_MODE === 'mock') {
    return NextResponse.json({ message: 'Mock mode - sync skipped' });
  }

  const step = (request.nextUrl.searchParams.get('step') || 'all') as StepName;

  try {
    if (step === 'dimensions' || step === 'all') {
      const dims = await syncAllDimensions();
      if (step === 'dimensions') {
        return NextResponse.json({ success: true, step: 'dimensions', dimensions: dims });
      }
    }

    if (step === 'titulos' || step === 'all') {
      const titulos = await syncContaReceber();
      if (step === 'titulos') {
        return NextResponse.json({ success: true, step: 'titulos', ...titulos });
      }
    }

    if (step === 'recebimentos') {
      const receb = await syncRecebimentos();
      return NextResponse.json({ success: true, step: 'recebimentos', ...receb });
    }

    // 'all' skips recebimentos (too large for serverless timeout)
    return NextResponse.json({ success: true, step: 'all', message: 'Dimensions + titles synced. Run step=recebimentos separately.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[sync] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
