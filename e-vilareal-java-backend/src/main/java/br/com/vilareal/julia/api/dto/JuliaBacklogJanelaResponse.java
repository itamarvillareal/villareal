package br.com.vilareal.julia.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record JuliaBacklogJanelaResponse(
        int totalNaJanela,
        int ativos,
        int puladosPorInativo,
        int puladosPorSemConteudo,
        int cardsCriados,
        int idempotentes,
        int erros,
        List<JuliaBacklogJanelaItem> itens) {

    public record JuliaBacklogJanelaItem(
            Long processoId,
            String numeroCnj,
            LocalDate prazoFatal,
            String impactoCliente,
            String prioridade,
            BigDecimal confianca,
            boolean idempotente) {}
}
