import { NextRequest, NextResponse } from 'next/server';
import { getVendedorPerformance } from '@/lib/data-provider';
import { parseFilters } from '@/lib/utils/parse-filters';

export async function GET(request: NextRequest) {
  const filters = parseFilters(request.nextUrl.searchParams);
  const data = await getVendedorPerformance(filters);
  return NextResponse.json(data);
}
