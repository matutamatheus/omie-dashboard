-- Dimension tables for Omie dashboard

CREATE TABLE IF NOT EXISTS dim_cliente (
    id BIGSERIAL PRIMARY KEY,
    omie_codigo BIGINT UNIQUE NOT NULL,
    codigo_integracao TEXT,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj_cpf TEXT,
    cidade TEXT,
    estado TEXT,
    email TEXT,
    telefone TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dim_conta_corrente (
    id BIGSERIAL PRIMARY KEY,
    omie_codigo BIGINT UNIQUE NOT NULL,
    descricao TEXT NOT NULL,
    tipo TEXT,
    banco TEXT,
    agencia TEXT,
    conta TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dim_departamento (
    id BIGSERIAL PRIMARY KEY,
    omie_codigo BIGINT UNIQUE NOT NULL,
    descricao TEXT NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dim_categoria (
    id BIGSERIAL PRIMARY KEY,
    omie_codigo TEXT UNIQUE NOT NULL,
    descricao TEXT NOT NULL,
    descricao_padrao TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dim_vendedor (
    id BIGSERIAL PRIMARY KEY,
    omie_codigo BIGINT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    email TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
