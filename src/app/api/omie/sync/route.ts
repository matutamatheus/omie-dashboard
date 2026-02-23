import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.SYNC_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.NEXT_PUBLIC_DATA_MODE === 'mock') {
    return NextResponse.json({ message: 'Mock mode - sync skipped' });
  }

  // TODO: implement real sync orchestrator
  return NextResponse.json({ success: true, message: 'Sync not yet implemented' });
}
