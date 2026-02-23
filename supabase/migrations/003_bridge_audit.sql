-- Bridge and audit tables

CREATE TABLE IF NOT EXISTS bridge_titulo_nf (
    titulo_id BIGINT REFERENCES fact_titulo_receber(id),
    nf_id BIGINT NOT NULL,
    numero_nf TEXT,
    serie TEXT,
    chave_nfe TEXT,
    PRIMARY KEY (titulo_id, nf_id)
);

CREATE TABLE IF NOT EXISTS audit_sync_runs (
    id BIGSERIAL PRIMARY KEY,
    entity TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running',
    records_fetched INTEGER DEFAULT 0,
    records_upserted INTEGER DEFAULT 0,
    last_sync_cursor TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB
);
