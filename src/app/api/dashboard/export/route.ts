import { NextRequest, NextResponse } from 'next/server';
import { getTitulos, getRecebimentos } from '@/lib/data-provider';
import { subDays, format } from 'date-fns';

function toCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const header = columns.map((c) => c.label).join(';');
  const lines = rows.map((row) =>
    columns.map((c) => {
      const val = row[c.key];
      if (val == null) return '';
      if (typeof val === 'number') return String(val).replace('.', ',');
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(';')
  );
  return [header, ...lines].join('\n');
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const today = new Date();
  const type = params.get('type') || 'titulos';

  const filters = {
    dateStart: params.get('dateStart') || format(subDays(today, 30), 'yyyy-MM-dd'),
    dateEnd: params.get('dateEnd') || format(today, 'yyyy-MM-dd'),
    mode: (params.get('mode') as 'vencimento' | 'previsao') || 'vencimento',
    horizon: (params.get('horizon') || '30d') as never,
    contaCorrenteId: params.get('contaCorrenteId') ? Number(params.get('contaCorrenteId')) : undefined,
    departamentoId: params.get('departamentoId') ? Number(params.get('departamentoId')) : undefined,
    vendedorId: params.get('vendedorId') ? Number(params.get('vendedorId')) : undefined,
    statusTitulo: params.get('statusTitulo') ? params.get('statusTitulo')!.split(',') : undefined,
  };

  if (type === 'recebimentos') {
    const data = await getRecebimentos(filters, 1, 10000);
    const csv = toCsv(data.rows as unknown as Record<string, unknown>[], [
      { key: 'dataBaixa', label: 'Data Baixa' },
      { key: 'clienteNome', label: 'Cliente' },
      { key: 'valorBaixado', label: 'Valor Baixado' },
      { key: 'valorDesconto', label: 'Desconto' },
      { key: 'valorJuros', label: 'Juros' },
      { key: 'valorMulta', label: 'Multa' },
      { key: 'tipoBaixa', label: 'Tipo' },
      { key: 'contaCorrente', label: 'Conta Corrente' },
    ]);

    return new Response('\uFEFF' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="recebimentos_${format(today, 'yyyy-MM-dd')}.csv"`,
      },
    });
  }

  const data = await getTitulos(filters, 1, 10000);
  const csv = toCsv(data.rows as unknown as Record<string, unknown>[], [
    { key: 'clienteNome', label: 'Cliente' },
    { key: 'numeroDocumento', label: 'Documento' },
    { key: 'numeroParcela', label: 'Parcela' },
    { key: 'dataVencimento', label: 'Vencimento' },
    { key: 'valorDocumento', label: 'Valor Documento' },
    { key: 'saldoEmAberto', label: 'Saldo em Aberto' },
    { key: 'diasAtraso', label: 'Dias Atraso' },
    { key: 'status', label: 'Status' },
    { key: 'vendedor', label: 'Vendedor' },
    { key: 'departamento', label: 'Departamento' },
    { key: 'contaCorrente', label: 'Conta Corrente' },
  ]);

  return new Response('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="titulos_${format(today, 'yyyy-MM-dd')}.csv"`,
    },
  });
}
