package br.com.vilareal.demanda.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record DemandaResponse(
        Long id,
        Long imovelId,
        String imovelTitulo,
        String imovelEndereco,
        Long clienteId,
        String clienteNome,
        String codigoCliente,
        Long pagamentoId,
        String pagamentoStatus,
        BigDecimal pagamentoValor,
        Long financeiroLancamentoId,
        String descricao,
        String categoria,
        String fornecedorTexto,
        String status,
        Boolean geraValorContabil,
        BigDecimal valorEstimado,
        Boolean pagoPeloEscritorio,
        Boolean reembolsavelCliente,
        LocalDate prazoCumprimento,
        LocalDate prazoFinalizacao,
        String observacoes,
        Long criadoPor,
        Instant createdAt,
        Instant updatedAt,
        List<DemandaHistoricoResponse> historico) {}
