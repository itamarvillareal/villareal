package br.com.vilareal.patrimonio.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public final class AtivoCadastroDtos {

    private AtivoCadastroDtos() {
    }

    public record CaixaRequest(
            @NotBlank String descricao,
            String instituicao,
            @NotNull BigDecimal valor,
            Boolean vinculado,
            String motivoVinculo
    ) {
    }

    public record CaixaResponse(
            Long id, String descricao, String instituicao, BigDecimal valor,
            boolean vinculado, String motivoVinculo
    ) {
    }

    public record RendaFixaRequest(
            @NotBlank String instrumento,
            String instituicao,
            @NotNull BigDecimal valorAplicado,
            BigDecimal valorAtual,
            String indexador,
            BigDecimal taxaContratada,
            LocalDate vencimento,
            String liquidez,
            Boolean reservaEmergencia,
            BigDecimal rentabilidadeBrutaAa,
            BigDecimal rentabilidadeLiquidaAa,
            String observacao
    ) {
    }

    public record RendaFixaResponse(
            Long id, String instrumento, String instituicao, BigDecimal valorAplicado,
            BigDecimal valorAtual, String indexador, BigDecimal taxaContratada,
            LocalDate vencimento, String liquidez, boolean reservaEmergencia,
            BigDecimal rentabilidadeBrutaAa, BigDecimal rentabilidadeLiquidaAa, String observacao
    ) {
    }

    public record ImovelRequest(
            @NotBlank String identificacao,
            String endereco,
            BigDecimal valorAquisicao,
            LocalDate dataAquisicao,
            @NotNull BigDecimal valorAtual,
            String situacao,
            BigDecimal aluguelMensal,
            String indiceReajuste,
            LocalDate dataBaseReajuste,
            LocalDate vencimentoContrato,
            BigDecimal iptuMensal,
            BigDecimal condominioMensal,
            BigDecimal seguroMensal,
            BigDecimal manutencaoMensal,
            BigDecimal administracaoMensal,
            BigDecimal vacanciaEstimada,
            Long origemImovelId,
            Long passivoId,
            String observacao
    ) {
    }

    public record ImovelResponse(
            Long id, String identificacao, String endereco, BigDecimal valorAquisicao,
            LocalDate dataAquisicao, BigDecimal valorAtual, String situacao,
            BigDecimal aluguelMensal, BigDecimal capRateLiquidoAa,
            Long origemImovelId, Long passivoId, String observacao
    ) {
    }

    public record RvRequest(
            @NotBlank String ticker,
            @NotNull BigDecimal quantidade,
            @NotNull BigDecimal precoMedio,
            BigDecimal precoAtual,
            Long estrategiaId,
            String observacao
    ) {
    }

    public record RvResponse(
            Long id, String ticker, BigDecimal quantidade, BigDecimal precoMedio,
            BigDecimal precoAtual, BigDecimal valorMercado, BigDecimal pnlReais, BigDecimal pnlPct,
            Long estrategiaId, String observacao
    ) {
    }

    public record VeiculoRequest(
            @NotBlank String descricao,
            Integer ano,
            String placa,
            String renavam,
            @NotNull BigDecimal valorAtual,
            Long passivoId
    ) {
    }

    public record VeiculoResponse(
            Long id, String descricao, Integer ano, String placa, String renavam,
            BigDecimal valorAtual, Long passivoId
    ) {
    }

    public record OpcaoRequest(
            @NotBlank String tickerAtivo,
            String tickerOpcao,
            @NotBlank String tipo,
            @NotNull BigDecimal strike,
            @NotNull LocalDate vencimento,
            Integer quantidade,
            BigDecimal premioEstimado,
            BigDecimal premioRealizado,
            BigDecimal premioPagoRecebido,
            BigDecimal margemExigida,
            String status,
            Long estrategiaId,
            @NotNull LocalDate dataAbertura,
            String observacao
    ) {
    }

    public record OpcaoResponse(
            Long id, String tickerAtivo, String tickerOpcao, String tipo,
            BigDecimal strike, LocalDate vencimento, Integer quantidade,
            BigDecimal premioEstimado, BigDecimal premioRealizado,
            BigDecimal premioPagoRecebido, BigDecimal margemExigida,
            String status, Long estrategiaId, LocalDate dataAbertura, String observacao
    ) {
    }
}
