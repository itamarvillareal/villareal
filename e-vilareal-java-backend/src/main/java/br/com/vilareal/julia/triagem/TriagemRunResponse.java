package br.com.vilareal.julia.triagem;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record TriagemRunResponse(
        TriagemResultado resultado,
        Long andamentoId,
        Long prazoId,
        Long agendaEventoId,
        boolean prazoFatalCabecalhoAtualizado,
        boolean duplicataPrazo,
        boolean duplicataTriagemSemantica,
        boolean duplicataAndamento,
        boolean audienciaProcessoAtualizada,
        Integer agendaAudienciaReplicada) {

    public static TriagemRunResponse dryRun(TriagemResultado resultado) {
        return new TriagemRunResponse(resultado, null, null, null, false, false, false, false, false, null);
    }

    public static TriagemRunResponse idempotente(TriagemResultado resultado) {
        return new TriagemRunResponse(
                resultado, null, null, null, false, false, true, false, false, null);
    }

    public static TriagemRunResponse idempotenteSemantica(TriagemResultado resultado) {
        return idempotente(resultado);
    }

    public static TriagemRunResponse enact(
            TriagemResultado resultado,
            Long andamentoId,
            Long prazoId,
            Long agendaEventoId,
            boolean prazoFatalCabecalhoAtualizado,
            boolean duplicataPrazo) {
        return enact(
                resultado,
                andamentoId,
                prazoId,
                agendaEventoId,
                prazoFatalCabecalhoAtualizado,
                duplicataPrazo,
                false,
                false,
                false,
                null);
    }

    public static TriagemRunResponse enact(
            TriagemResultado resultado,
            Long andamentoId,
            Long prazoId,
            Long agendaEventoId,
            boolean prazoFatalCabecalhoAtualizado,
            boolean duplicataPrazo,
            boolean duplicataTriagemSemantica,
            boolean duplicataAndamento,
            boolean audienciaProcessoAtualizada,
            Integer agendaAudienciaReplicada) {
        return new TriagemRunResponse(
                resultado,
                andamentoId,
                prazoId,
                agendaEventoId,
                prazoFatalCabecalhoAtualizado,
                duplicataPrazo,
                duplicataTriagemSemantica,
                duplicataAndamento,
                audienciaProcessoAtualizada,
                agendaAudienciaReplicada);
    }
}
