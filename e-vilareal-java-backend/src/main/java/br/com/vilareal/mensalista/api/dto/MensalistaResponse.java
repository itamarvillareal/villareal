package br.com.vilareal.mensalista.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MensalistaResponse(
        Long id,
        Long clienteId,
        String clienteNome,
        String codigoCliente,
        BigDecimal valor,
        Integer diaVencimento,
        LocalDate dataInicio,
        LocalDate dataFim,
        Boolean ativo) {}
