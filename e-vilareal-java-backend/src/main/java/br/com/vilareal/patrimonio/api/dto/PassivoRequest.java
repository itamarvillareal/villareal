package br.com.vilareal.patrimonio.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PassivoRequest(
        @NotBlank String tipo,
        @NotBlank String credor,
        String descricao,
        @NotNull @DecimalMin("0.01") BigDecimal valorOriginal,
        @NotNull @DecimalMin("0") BigDecimal saldoDevedor,
        @NotBlank String sistemaAmortizacao,
        BigDecimal taxaJurosNominalAa,
        @NotNull BigDecimal cetEfetivoAa,
        String indexador,
        @NotNull @DecimalMin("0.01") BigDecimal parcelaAtual,
        @NotNull Integer prazoRemanescenteMeses,
        Integer diaVencimento,
        BigDecimal seguroMipMensal,
        BigDecimal seguroDfiMensal,
        BigDecimal taxaAdministracaoMensal,
        BigDecimal taxaAdministracaoTotal,
        BigDecimal fundoReserva,
        Boolean consorcioContemplado,
        BigDecimal creditoConsorcio,
        Boolean permiteReduzirPrazo,
        Boolean permiteReduzirParcela,
        Integer carenciaAmortizacaoDias,
        BigDecimal multaAmortizacao,
        Boolean descontoJurosFuturos,
        String bemVinculadoTipo,
        Long bemVinculadoId,
        LocalDate dataInicio,
        LocalDate dataFimPrevista,
        String observacao,
        Boolean regenerarCronograma
) {
}
