import { NextRequest, NextResponse } from 'next/server';
import { runFullSync } from '@/lib/omie/sync-orchestrator';

export const maxDuration = 300; // 5 min timeout for sync

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.SYNC_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.NEXT_PUBLIC_DATA_MODE === 'mock') {
    return NextResponse.json({ message: 'Mock mode - sync skipped' });
  }

  try {
    const result = await runFullSync();
    return NextResponse.json({
      success: result.status === 'success',
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[sync] Fatal error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
