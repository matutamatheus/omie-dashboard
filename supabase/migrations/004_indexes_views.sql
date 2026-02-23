-- Performance indexes

CREATE INDEX IF NOT EXISTS idx_titulo_cliente ON fact_titulo_receber(cliente_id);
CREATE INDEX IF NOT EXISTS idx_titulo_vencimento ON fact_titulo_receber(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_titulo_previsao ON fact_titulo_receber(data_previsao);
CREATE INDEX IF NOT EXISTS idx_titulo_status ON fact_titulo_receber(status_titulo);
CREATE INDEX IF NOT EXISTS idx_titulo_cc ON fact_titulo_receber(conta_corrente_id);
CREATE INDEX IF NOT EXISTS idx_titulo_vendedor ON fact_titulo_receber(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_titulo_updated ON fact_titulo_receber(omie_updated_at);

CREATE INDEX IF NOT EXISTS idx_recebimento_titulo ON fact_recebimento(titulo_id);
CREATE INDEX IF NOT EXISTS idx_recebimento_data ON fact_recebimento(data_baixa);
CREATE INDEX IF NOT EXISTS idx_recebimento_cc ON fact_recebimento(conta_corrente_id);

CREATE INDEX IF NOT EXISTS idx_extrato_cc_data ON fact_extrato_cc(conta_corrente_id, data_lancamento);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_sync_runs(entity, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_titulo_status_vencimento ON fact_titulo_receber(status_titulo, data_vencimento)
    WHERE status_titulo IN ('RECEBER', 'ATRASADO', 'PARCIAL');

CREATE INDEX IF NOT EXISTS idx_titulo_aberto_cliente ON fact_titulo_receber(cliente_id, saldo_em_aberto)
    WHERE saldo_em_aberto > 0;
