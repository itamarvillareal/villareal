package br.com.vilareal.patrimonio.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record PassivoResponse(
        Long id,
        String tipo,
        String credor,
        String descricao,
        BigDecimal valorOriginal,
        BigDecimal saldoDevedor,
        String sistemaAmortizacao,
        BigDecimal taxaJurosNominalAa,
        BigDecimal cetEfetivoAa,
        String indexador,
        BigDecimal parcelaAtual,
        Integer prazoRemanescenteMeses,
        Integer diaVencimento,
        BigDecimal seguroMipMensal,
        BigDecimal seguroDfiMensal,
        BigDecimal taxaAdministracaoMensal,
        Boolean consorcioContemplado,
        Boolean permiteReduzirPrazo,
        Boolean permiteReduzirParcela,
        String bemVinculadoTipo,
        Long bemVinculadoId,
        LocalDate dataInicio,
        LocalDate dataFimPrevista,
        Boolean ativo,
        String observacao,
        Instant createdAt,
        Instant updatedAt
) {
}
