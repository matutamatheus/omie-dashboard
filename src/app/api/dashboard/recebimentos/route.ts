import { NextRequest, NextResponse } from 'next/server';
import { getRecebimentos } from '@/lib/data-provider';
import { subDays, format } from 'date-fns';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const today = new Date();

  const filters = {
    dateStart: params.get('dateStart') || format(subDays(today, 30), 'yyyy-MM-dd'),
    dateEnd: params.get('dateEnd') || format(today, 'yyyy-MM-dd'),
    horizon: (params.get('horizon') || '30d') as never,
    contaCorrenteId: params.get('contaCorrenteId') ? Number(params.get('contaCorrenteId')) : undefined,
    departamentoId: params.get('departamentoId') ? Number(params.get('departamentoId')) : undefined,
    vendedorId: params.get('vendedorId') ? Number(params.get('vendedorId')) : undefined,
    statusTitulo: params.get('statusTitulo') ? params.get('statusTitulo')!.split(',') : undefined,
  };

  const page = Number(params.get('page') || 1);
  const pageSize = Number(params.get('pageSize') || 50);

  const data = await getRecebimentos(filters, page, pageSize);
  return NextResponse.json(data);
}
