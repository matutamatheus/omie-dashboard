import { addDays, subDays, subMonths, format } from 'date-fns';

// Realistic Brazilian company names
const COMPANY_NAMES = [
  'Construtora Horizonte Ltda', 'Tech Solutions Brasil SA', 'Distribuidora Alimentos Sul Ltda',
  'Consultoria Empresarial Norte ME', 'Transportadora Rápida Express', 'Indústria Metalúrgica Aço Forte',
  'Comércio Eletrônico Digital Ltda', 'Serviços Médicos Saúde Total', 'Agropecuária Campo Verde',
  'Empreendimentos Imobiliários Sol', 'Logística Integrada Brasil', 'Fábrica de Móveis Confort',
  'Grupo Educacional Saber Mais', 'Engenharia Civil Progresso', 'Atacadista Central de Compras',
  'Restaurante Sabor & Arte Ltda', 'Auto Peças Nacional ME', 'Clínica Veterinária Amigo Fiel',
  'Escritório Contábil Precision', 'Marketing Digital Growth Co', 'Farmácia Popular Bem Estar',
  'Padaria Pão Dourado Ltda', 'Academia Fitness Pro ME', 'Gráfica Impressão Total',
  'Advocacia Silva & Associados', 'Posto Combustível Estrada Real', 'Hotel Praia Azul Ltda',
  'Escola Infantil Pequenos Gênios', 'Loja Material Construção Forte', 'Oficina Mecânica Auto Tech',
  'Supermercado Economia Total', 'Papelaria Central Ltda', 'Salão de Beleza Glamour ME',
  'Pet Shop Animal Planet', 'Lavanderia Express Clean', 'Floricultura Jardim Encantado',
  'Confecções Moda Brasil', 'Eletrônicos Smart Tech', 'Ótica Visual Premium',
  'Joalheria Brilho Eterno', 'Doceria Doce Sabor Ltda', 'Ferramentaria Precisão Ltda',
  'Serralheria Ferro & Arte', 'Vidraçaria Cristal Clear', 'Marcenaria Madeira Nobre',
  'Cerâmica Barro Fino Ltda', 'Têxtil Brasil Fibras SA', 'Química Industrial ProLab',
  'Plásticos Recicla Verde', 'Embalagens Pack Express', 'Alimentos Congelados Polar',
  'Bebidas Refrescantes Ltda', 'Laticínios Serra Gaúcha', 'Frigorífico Carnes Nobres',
  'Pescados Mar Azul Ltda', 'Cereais e Grãos Naturais', 'Frutas Tropicais Express',
  'Hortifruti Campo & Mesa', 'Panificadora Trigo Dourado', 'Torrefação Café Premium',
  'Vinícola Vale dos Vinhos', 'Cervejaria Artesanal Lúpulo', 'Destilaria Ouro Branco',
  'Cosméticos Beleza Natural', 'Laboratório Análises Clínicas', 'Clínica Odontológica Sorriso',
  'Hospital Veterinário Vida', 'Centro Diagnóstico Image', 'Rede Farmácias Popular Plus',
  'Turismo Aventura Brasil', 'Agência Viagens Mundo Tour', 'Locadora Veículos Rota Certa',
  'Seguros Proteção Total', 'Corretora Investimentos Alfa', 'Imobiliária Lar Perfeito',
  'Construtora Alicerce Firme', 'Incorporadora Horizonte Novo', 'Mineração Terra Rica',
  'Siderúrgica Aço Premium', 'Cimenteira Rocha Forte', 'Madeireira Floresta Viva',
];

const VENDEDORES = [
  'Carlos Silva', 'Ana Oliveira', 'Roberto Santos', 'Maria Fernandes',
  'João Pereira', 'Lucia Costa', 'Pedro Almeida', 'Juliana Lima',
];

const DEPARTAMENTOS = [
  'Comercial', 'Industrial', 'Serviços', 'Varejo', 'Atacado',
  'E-commerce', 'Exportação', 'Projetos Especiais', 'Governo', 'Institucional',
];

const CATEGORIAS = [
  'Venda de Produtos', 'Prestação de Serviços', 'Aluguel', 'Comissões',
  'Mensalidades', 'Assinaturas', 'Licenciamento', 'Manutenção',
  'Consultoria', 'Treinamento', 'Frete', 'Outros Recebimentos',
];

const CONTAS_CORRENTES = [
  { nome: 'Banco do Brasil - CC 12345-6', banco: 'Banco do Brasil', tipo: 'Corrente' },
  { nome: 'Itaú - CC 98765-4', banco: 'Itaú', tipo: 'Corrente' },
  { nome: 'Bradesco - CC 55432-1', banco: 'Bradesco', tipo: 'Corrente' },
  { nome: 'Caixa Econômica - CC 33210-8', banco: 'Caixa', tipo: 'Corrente' },
  { nome: 'Nubank - CC 77788-9', banco: 'Nubank', tipo: 'Corrente' },
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCNPJ(): string {
  const n = () => randomInt(0, 9);
  return `${n()}${n()}.${n()}${n()}${n()}.${n()}${n()}${n()}/0001-${n()}${n()}`;
}

export interface MockCliente {
  id: number;
  razao_social: string;
  nome_fantasia: string;
  cnpj_cpf: string;
  cidade: string;
  estado: string;
  ativo: boolean;
}

export interface MockContaCorrente {
  id: number;
  descricao: string;
  tipo: string;
  banco: string;
  ativo: boolean;
}

export interface MockDepartamento {
  id: number;
  descricao: string;
  ativo: boolean;
}

export interface MockCategoria {
  id: number;
  descricao: string;
  ativo: boolean;
}

export interface MockVendedor {
  id: number;
  nome: string;
  ativo: boolean;
}

export interface MockTitulo {
  id: number;
  clienteId: number;
  contaCorrenteId: number;
  departamentoId: number;
  categoriaId: number;
  vendedorId: number;
  numeroDocumento: string;
  numeroParcela: string;
  dataEmissao: Date;
  dataVencimento: Date;
  dataPrevisao: Date;
  valorDocumento: number;
  statusTitulo: string;
}

export interface MockBaixa {
  id: number;
  tituloId: number;
  contaCorrenteId: number;
  dataBaixa: Date;
  valorBaixado: number;
  valorDesconto: number;
  valorJuros: number;
  valorMulta: number;
  tipoBaixa: string;
  liquidado: boolean;
}

export interface MockData {
  clientes: MockCliente[];
  contasCorrentes: MockContaCorrente[];
  departamentos: MockDepartamento[];
  categorias: MockCategoria[];
  vendedores: MockVendedor[];
  titulos: MockTitulo[];
  baixas: MockBaixa[];
}

const ESTADOS = ['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'PE', 'CE', 'GO', 'DF'];
const CIDADES: Record<string, string[]> = {
  SP: ['São Paulo', 'Campinas', 'Santos', 'Ribeirão Preto', 'Sorocaba'],
  RJ: ['Rio de Janeiro', 'Niterói', 'Petrópolis'],
  MG: ['Belo Horizonte', 'Uberlândia', 'Juiz de Fora'],
  RS: ['Porto Alegre', 'Caxias do Sul', 'Canoas'],
  PR: ['Curitiba', 'Londrina', 'Maringá'],
  SC: ['Florianópolis', 'Joinville', 'Blumenau'],
  BA: ['Salvador', 'Feira de Santana'],
  PE: ['Recife', 'Olinda'],
  CE: ['Fortaleza', 'Juazeiro do Norte'],
  GO: ['Goiânia', 'Anápolis'],
  DF: ['Brasília'],
};

export function generateMockData(): MockData {
  const today = new Date();

  // Generate dimensions
  const clientes: MockCliente[] = COMPANY_NAMES.slice(0, 80).map((name, i) => {
    const estado = randomPick(ESTADOS);
    return {
      id: 1000 + i,
      razao_social: name,
      nome_fantasia: name.split(' ').slice(0, 2).join(' '),
      cnpj_cpf: generateCNPJ(),
      cidade: randomPick(CIDADES[estado] || ['São Paulo']),
      estado,
      ativo: Math.random() > 0.05,
    };
  });

  const contasCorrentes: MockContaCorrente[] = CONTAS_CORRENTES.map((cc, i) => ({
    id: 100 + i,
    descricao: cc.nome,
    tipo: cc.tipo,
    banco: cc.banco,
    ativo: true,
  }));

  const departamentos: MockDepartamento[] = DEPARTAMENTOS.map((d, i) => ({
    id: 200 + i,
    descricao: d,
    ativo: true,
  }));

  const categorias: MockCategoria[] = CATEGORIAS.map((c, i) => ({
    id: 300 + i,
    descricao: c,
    ativo: true,
  }));

  const vendedores: MockVendedor[] = VENDEDORES.map((v, i) => ({
    id: 400 + i,
    nome: v,
    ativo: true,
  }));

  // Generate titles (400 titles spread over 6 months)
  const titulos: MockTitulo[] = [];
  const baixas: MockBaixa[] = [];
  let tituloId = 10000;
  let baixaId = 50000;

  for (let i = 0; i < 400; i++) {
    const id = tituloId++;
    const cliente = randomPick(clientes);
    const emissaoOffset = randomInt(-180, -5);
    const dataEmissao = addDays(today, emissaoOffset);
    const prazo = randomPick([7, 14, 28, 30, 45, 60, 90]);
    const dataVencimento = addDays(dataEmissao, prazo);
    const dataPrevisao = addDays(dataVencimento, randomInt(-3, 5));
    const valorDocumento = randomFloat(500, 50000);
    const totalParcelas = randomPick([1, 1, 1, 2, 3, 3, 4, 6]);
    const parcelaNum = randomInt(1, totalParcelas);

    // Determine status distribution
    const rand = Math.random();
    let statusTitulo: string;
    if (rand < 0.40) statusTitulo = 'LIQUIDADO';
    else if (rand < 0.65) statusTitulo = 'RECEBER';
    else if (rand < 0.80) statusTitulo = 'ATRASADO';
    else if (rand < 0.90) statusTitulo = 'PARCIAL';
    else statusTitulo = 'CANCELADO';

    const titulo: MockTitulo = {
      id,
      clienteId: cliente.id,
      contaCorrenteId: randomPick(contasCorrentes).id,
      departamentoId: randomPick(departamentos).id,
      categoriaId: randomPick(categorias).id,
      vendedorId: randomPick(vendedores).id,
      numeroDocumento: `NF-${randomInt(10000, 99999)}`,
      numeroParcela: `${String(parcelaNum).padStart(3, '0')}/${String(totalParcelas).padStart(3, '0')}`,
      dataEmissao,
      dataVencimento,
      dataPrevisao,
      valorDocumento,
      statusTitulo,
    };

    titulos.push(titulo);

    // Generate payments based on status
    if (statusTitulo === 'LIQUIDADO') {
      // 95% normal liquidation, 5% via 100% discount
      const is100Discount = Math.random() < 0.05;
      baixas.push({
        id: baixaId++,
        tituloId: id,
        contaCorrenteId: titulo.contaCorrenteId,
        dataBaixa: addDays(dataVencimento, randomInt(-3, 10)),
        valorBaixado: is100Discount ? 0 : valorDocumento,
        valorDesconto: is100Discount ? valorDocumento : randomFloat(0, valorDocumento * 0.05),
        valorJuros: dataVencimento < today ? randomFloat(0, valorDocumento * 0.02) : 0,
        valorMulta: dataVencimento < today ? randomFloat(0, valorDocumento * 0.01) : 0,
        tipoBaixa: 'NORMAL',
        liquidado: true,
      });
    } else if (statusTitulo === 'PARCIAL') {
      const parcialPct = randomFloat(0.2, 0.7);
      baixas.push({
        id: baixaId++,
        tituloId: id,
        contaCorrenteId: titulo.contaCorrenteId,
        dataBaixa: addDays(dataVencimento, randomInt(0, 15)),
        valorBaixado: Math.round(valorDocumento * parcialPct * 100) / 100,
        valorDesconto: 0,
        valorJuros: randomFloat(0, valorDocumento * 0.01),
        valorMulta: 0,
        tipoBaixa: 'NORMAL',
        liquidado: false,
      });
    }
    // RECEBER, ATRASADO, CANCELADO: no payments
  }

  return { clientes, contasCorrentes, departamentos, categorias, vendedores, titulos, baixas };
}
