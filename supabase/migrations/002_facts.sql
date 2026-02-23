-- Fact tables

CREATE TABLE IF NOT EXISTS fact_titulo_receber (
    id BIGINT PRIMARY KEY,
    codigo_integracao TEXT,
    cliente_id BIGINT REFERENCES dim_cliente(id),
    conta_corrente_id BIGINT REFERENCES dim_conta_corrente(id),
    departamento_id BIGINT REFERENCES dim_departamento(id),
    categoria_id BIGINT REFERENCES dim_categoria(id),
    vendedor_id BIGINT REFERENCES dim_vendedor(id),
    numero_documento TEXT,
    numero_parcela TEXT,
    data_emissao DATE NOT NULL,
    data_vencimento DATE NOT NULL,
    data_previsao DATE,
    data_registro DATE,
    valor_documento NUMERIC(15,2) NOT NULL,
    status_titulo TEXT NOT NULL DEFAULT 'RECEBER',
    codigo_tipo_documento TEXT,
    observacao TEXT,
    principal_liquidado NUMERIC(15,2) DEFAULT 0,
    saldo_em_aberto NUMERIC(15,2) DEFAULT 0,
    caixa_recebido NUMERIC(15,2) DEFAULT 0,
    desconto_concedido NUMERIC(15,2) DEFAULT 0,
    omie_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fact_recebimento (
    id BIGINT PRIMARY KEY,
    codigo_baixa_integracao TEXT,
    titulo_id BIGINT REFERENCES fact_titulo_receber(id),
    conta_corrente_id BIGINT REFERENCES dim_conta_corrente(id),
    data_baixa DATE NOT NULL,
    valor_baixado NUMERIC(15,2) NOT NULL DEFAULT 0,
    valor_desconto NUMERIC(15,2) DEFAULT 0,
    valor_juros NUMERIC(15,2) DEFAULT 0,
    valor_multa NUMERIC(15,2) DEFAULT 0,
    tipo_baixa TEXT DEFAULT 'NORMAL',
    liquidado BOOLEAN DEFAULT false,
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fact_extrato_cc (
    id BIGSERIAL PRIMARY KEY,
    conta_corrente_id BIGINT REFERENCES dim_conta_corrente(id),
    data_lancamento DATE NOT NULL,
    descricao TEXT,
    documento TEXT,
    tipo TEXT,
    valor NUMERIC(15,2) NOT NULL,
    saldo NUMERIC(15,2),
    titulo_id BIGINT REFERENCES fact_titulo_receber(id),
    data_conciliacao DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);
