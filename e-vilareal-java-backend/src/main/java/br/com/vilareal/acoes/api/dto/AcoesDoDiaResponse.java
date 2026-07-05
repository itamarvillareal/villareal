package br.com.vilareal.acoes.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record AcoesDoDiaResponse(
        String competencia,
        GrupoConciliar conciliar,
        GrupoCobrar cobrar,
        GrupoRepassar repassar,
        GrupoRenegociar renegociar,
        GrupoPagar pagar) {

    public record GrupoConciliar(int quantidade, BigDecimal total, List<ItemConciliar> itens) {}

    public record ItemConciliar(
            /** IMOVEL (aluguel) ou ALVARA (honorários / depósito judicial). */
            String origem,
            Long contratoId,
            Integer imovelNumeroPlanilha,
            String imovelEndereco,
            String locadorNome,
            BigDecimal valorAluguel,
            LocalDate vencimento,
            int diasEmAtraso,
            /** ALVARA — nullable quando origem=IMOVEL. */
            Long processoId,
            Integer numeroInterno,
            String codigoCliente,
            String contratanteNome,
            BigDecimal percentualProveito,
            List<CandidatoCredito> candidatos) {}

    public record CandidatoCredito(
            Long lancamentoId,
            LocalDate data,
            BigDecimal valor,
            String descricao,
            /** Projetado — somente candidatos de alvará. */
            BigDecimal retencao,
            BigDecimal repasseEsperado) {}

    public record GrupoCobrar(int quantidade, BigDecimal total, List<ItemCobrar> itens) {}

    public record ItemCobrar(
            String descricao,
            String tipo,
            BigDecimal valor,
            LocalDate vencimento,
            int diasEmAtraso,
            Long contratoId,
            Integer imovelNumeroPlanilha,
            /** ACORDO_PARCELA — nullable nos demais tipos. */
            String codigoCliente,
            Integer numeroInterno) {}

    public record GrupoRepassar(int quantidade, BigDecimal total, List<ItemRepassar> itens) {}

    public record ItemRepassar(
            /** IMOVEL (locação) ou PROCESSO (honorários / alvará). */
            String origem,
            Long contratoId,
            Integer imovelNumeroPlanilha,
            String imovelEndereco,
            String locadorNome,
            String competencia,
            BigDecimal valorEmAberto,
            String dadosBancariosRepasse,
            /** PROCESSO — nullable quando origem=IMOVEL. */
            Long processoId,
            Integer numeroInterno,
            String codigoCliente,
            String contratanteNome,
            Long alvaraLancamentoId,
            BigDecimal valorAlvara,
            BigDecimal retencao,
            BigDecimal repasseEsperado) {}

    public record GrupoRenegociar(int quantidade, BigDecimal total, List<ItemRenegociar> itens) {}

    public record ItemRenegociar(
            Long contratoId,
            Integer imovelNumeroPlanilha,
            String imovelEndereco,
            String locadorNome,
            LocalDate dataFim,
            int diasRestantes,
            BigDecimal valorAluguel) {}

    public record GrupoPagar(int quantidade, BigDecimal total, List<ItemPagar> itens) {}

    public record ItemPagar(
            Long pagamentoId,
            String descricao,
            String categoria,
            BigDecimal valor,
            LocalDate vencimento,
            boolean vencido,
            Long imovelId,
            Integer imovelNumeroPlanilha,
            Long clienteId,
            Long processoId,
            Integer numeroInterno) {}
}
