package br.com.vilareal.whatsapp.dto;

import java.time.Instant;

/** Contexto de processo/unidade inferido de cobranças WhatsApp recentes para um telefone. */
public record WhatsAppProcessoContextItemDTO(
        Long cobrancaId,
        Long processoId,
        Integer processoNumeroInterno,
        Long clienteId,
        String codigoCliente,
        String clienteEscritorioNome,
        String unidadeDescricao,
        String condominioNome,
        String cobrancaStatus,
        Instant quando) {}
