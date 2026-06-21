package br.com.vilareal.acoes.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record AcoesDoDiaResponse(
        String competencia,
        GrupoConciliar conciliar,
        GrupoCobrar cobrar,
        GrupoRepassar repassar,
        GrupoRenegociar renegociar) {

    public record GrupoConciliar(int quantidade, BigDecimal total, List<ItemConciliar> itens) {}

    public record ItemConciliar(
            Long contratoId,
            Integer imovelNumeroPlanilha,
            String imovelEndereco,
            String locadorNome,
            BigDecimal valorAluguel,
            LocalDate vencimento,
            int diasEmAtraso,
            List<CandidatoCredito> candidatos) {}

    public record CandidatoCredito(Long lancamentoId, LocalDate data, BigDecimal valor, String descricao) {}

    public record GrupoCobrar(int quantidade, BigDecimal total, List<ItemCobrar> itens) {}

    public record ItemCobrar(
            String descricao,
            String tipo,
            BigDecimal valor,
            LocalDate vencimento,
            int diasEmAtraso,
            Long contratoId,
            Integer imovelNumeroPlanilha) {}

    public record GrupoRepassar(int quantidade, BigDecimal total, List<ItemRepassar> itens) {}

    public record ItemRepassar(
            Long contratoId,
            Integer imovelNumeroPlanilha,
            String imovelEndereco,
            String locadorNome,
            String competencia,
            BigDecimal valorEmAberto,
            String dadosBancariosRepasse) {}

    public record GrupoRenegociar(int quantidade, BigDecimal total, List<ItemRenegociar> itens) {}

    public record ItemRenegociar(
            Long contratoId,
            Integer imovelNumeroPlanilha,
            String imovelEndereco,
            String locadorNome,
            LocalDate dataFim,
            int diasRestantes,
            BigDecimal valorAluguel) {}
}
