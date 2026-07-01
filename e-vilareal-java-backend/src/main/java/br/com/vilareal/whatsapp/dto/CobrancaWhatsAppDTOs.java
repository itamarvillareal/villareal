package br.com.vilareal.whatsapp.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class CobrancaWhatsAppDTOs {

    private CobrancaWhatsAppDTOs() {}

    public record CobrancaPreviewDTO(
            Long imovelId,
            Long clienteId,
            Long pessoaId,
            String pessoaNome,
            String telefone,
            String telefoneFormatado,
            boolean temTelefone,
            String condominioNome,
            String unidadeDescricao,
            Long processoId,
            BigDecimal valorPendente,
            String valorPendenteFormatado,
            boolean jaCobradoEsteMes,
            String origem,
            Integer processoNumeroInterno,
            String clienteEscritorioCodigo,
            String clienteEscritorioNome) {}

    public record CobrancaItemDTO(
            Long imovelId,
            Long clienteId,
            Long pessoaId,
            String pessoaNome,
            String telefone,
            String condominioNome,
            String unidadeDescricao,
            Long processoId,
            BigDecimal valorPendente) {}

    public record DispararCobrancaRequest(List<CobrancaItemDTO> itens, String loteDescricao) {}

    public record AgendarCobrancaRequest(List<CobrancaItemDTO> itens, String loteDescricao, Instant scheduledAt) {}

    public record CobrancaLoteResultDTO(
            String loteId, int total, int enviados, int falhos, int semTelefone, int jaCobrados) {}

    public record AgendarCobrancaResultDTO(
            String loteId,
            int total,
            int agendados,
            int semTelefone,
            Instant scheduledAt) {}

    public record CobrancaLoteResumoDTO(
            String loteId,
            String loteDescricao,
            Instant createdAt,
            String createdBy,
            long total,
            long enviados,
            long falhos,
            long pendentes) {}

    public record CobrancaDTO(
            Long id,
            String loteId,
            String pessoaNome,
            String phoneNumber,
            String condominioNome,
            String unidadeDescricao,
            BigDecimal valorPendente,
            String status,
            String errorMessage,
            Instant enviadoAt,
            Instant createdAt) {}

    public record CobrancaStatsDTO(
            long enviadasEsteMes, long entreguesEsteMes, BigDecimal valorTotalCobradoMes, double taxaEntrega) {}

    public record CondominioResumoDTO(Long id, String nome, long totalUnidades) {}

    public record ClienteEscritorioCobrancaDTO(String codigoCliente, String nome, long totalUnidades) {}
}
