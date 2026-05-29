package br.com.vilareal.demanda.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DemandaWriteRequest(
        @NotNull Long imovelId,
        @NotNull Long clienteId,
        @NotBlank @Size(max = 500) String descricao,
        @NotBlank String categoria,
        @Size(max = 255) String fornecedorTexto,
        String status,
        @NotNull Boolean geraValorContabil,
        BigDecimal valorEstimado,
        @NotNull Boolean pagoPeloEscritorio,
        @NotNull Boolean reembolsavelCliente,
        LocalDate prazoCumprimento,
        LocalDate prazoFinalizacao,
        String observacoes) {}
