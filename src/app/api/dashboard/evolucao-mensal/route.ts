import { NextRequest, NextResponse } from 'next/server';
import { getEvolucaoMensal } from '@/lib/data-provider';
import { parseFilters } from '@/lib/utils/parse-filters';

export async function GET(request: NextRequest) {
  const filters = parseFilters(request.nextUrl.searchParams);
  const data = await getEvolucaoMensal(filters);
  return NextResponse.json(data);
}
