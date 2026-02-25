import { NextRequest, NextResponse } from 'next/server';
import { getTopClientesInadimplentes } from '@/lib/data-provider';
import { parseFilters } from '@/lib/utils/parse-filters';

export async function GET(request: NextRequest) {
  const filters = parseFilters(request.nextUrl.searchParams);
  const limit = request.nextUrl.searchParams.get('limit') ? Number(request.nextUrl.searchParams.get('limit')) : 20;
  const data = await getTopClientesInadimplentes(filters, limit);
  return NextResponse.json(data);
}
