import { NextResponse } from 'next/server';
import { getDimensionOptions } from '@/lib/data-provider';

export async function GET() {
  const data = await getDimensionOptions();
  return NextResponse.json(data);
}
