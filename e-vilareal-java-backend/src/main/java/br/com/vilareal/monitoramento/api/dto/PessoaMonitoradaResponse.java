package br.com.vilareal.monitoramento.api.dto;

import java.time.LocalDateTime;

/**
 * Pessoa marcada para monitoramento, com os agregados que a tela precisa para o filtro e o
 * painel: quantos alertas (NOVO) pendentes, total de descobertos e soma do segredo de justiça.
 */
public record PessoaMonitoradaResponse(
        Long id,
        String nome,
        String cpf,
        String poloMonitorado,
        LocalDateTime baselineEm,
        long alertas,
        long totalDescobertos,
        long qtdSegredo) {}
