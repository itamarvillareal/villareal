package br.com.vilareal.julia.triagem;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TriagemRunResponse(
        TriagemResultado resultado,
        Long andamentoId,
        Long prazoId,
        Long agendaEventoId,
        boolean prazoFatalCabecalhoAtualizado,
        boolean duplicataPrazo) {

    public static TriagemRunResponse dryRun(TriagemResultado resultado) {
        return new TriagemRunResponse(resultado, null, null, null, false, false);
    }

    public static TriagemRunResponse idempotente(TriagemResultado resultado) {
        return new TriagemRunResponse(resultado, null, null, null, false, false);
    }

    public static TriagemRunResponse enact(
            TriagemResultado resultado,
            Long andamentoId,
            Long prazoId,
            Long agendaEventoId,
            boolean prazoFatalCabecalhoAtualizado,
            boolean duplicataPrazo) {
        return new TriagemRunResponse(
                resultado, andamentoId, prazoId, agendaEventoId, prazoFatalCabecalhoAtualizado, duplicataPrazo);
    }
}
