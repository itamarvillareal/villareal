package br.com.vilareal.processo.api.dto;

/**
 * Resumo do backfill de {@code processo.tramitacao} para cadastros legados sem valor.
 */
public record ProcessoTramitacaoBackfillResponse(
        int atualizadosProjudi,
        int atualizadosPje,
        int inalterados,
        int total,
        boolean dryRun) {}
