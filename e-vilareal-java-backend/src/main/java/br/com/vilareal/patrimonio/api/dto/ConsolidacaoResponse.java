package br.com.vilareal.patrimonio.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record ConsolidacaoResponse(
        LocalDate dataRef,
        BigDecimal ativoTotal,
        BigDecimal passivoTotal,
        BigDecimal patrimonioLiquido,
        BigDecimal alavancagem,
        Map<String, BigDecimal> breakdownAtivos,
        Map<String, BigDecimal> breakdownPassivos,
        BigDecimal caixaTotal,
        BigDecimal caixaVinculado,
        BigDecimal caixaLivre,
        /** RF marcada como reserva, independente de liquidez. */
        BigDecimal rendaFixaTotal,
        /** Parcela da RF que conta para o piso (flag reserva + liquidez diária). */
        BigDecimal reservaEmergenciaLiquida,
        /** Alias legado = reservaEmergenciaLiquida. */
        BigDecimal reservaEmergencia,
        BigDecimal pisoReserva,
        BigDecimal taxaReferenciaLiquidaAa,
        Instant taxaReferenciaAtualizadaEm,
        boolean taxaReferenciaDesatualizada,
        Integer taxaReferenciaStaleDias,
        BigDecimal parcelasMensaisTotal,
        BigDecimal rendaMensalRecorrente,
        BigDecimal comprometimentoRenda,
        BigDecimal comprometimentoRendaMax,
        boolean comprometimentoAcimaLimite,
        BigDecimal tetoAmortizacaoAnual,
        BigDecimal tetoAmortizacaoUsadoAno,
        BigDecimal tetoAmortizacaoDisponivel,
        boolean tetoAmortizacaoUltrapassado,
        List<SnapshotPontoResponse> historicoPl,
        List<ComparadorItemResponse> comparadorUniversal
) {
    public record SnapshotPontoResponse(LocalDate data, BigDecimal patrimonioLiquido, BigDecimal alavancagem) {
    }
}
