package br.com.vilareal.publicacao.api.dto;

public record TratarPublicacaoResponse(
        Long andamentoId,
        Long prazoId,
        Long agendaEventoId,
        Long tarefaId,
        boolean cardConcluido,
        String avisoDedup) {}
