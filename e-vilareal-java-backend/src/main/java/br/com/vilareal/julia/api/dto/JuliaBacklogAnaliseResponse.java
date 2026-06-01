package br.com.vilareal.julia.api.dto;

import java.math.BigDecimal;
import java.util.List;

public record JuliaBacklogAnaliseResponse(
        int processosElegiveis,
        int analisados,
        int cards,
        int idempotentes,
        int erros,
        List<JuliaBacklogAnaliseItem> itens) {

    public record JuliaBacklogAnaliseItem(
            Long processoId,
            String numeroCnj,
            Long publicacaoId,
            String impactoCliente,
            String prioridade,
            BigDecimal confianca,
            boolean idempotente) {}
}
