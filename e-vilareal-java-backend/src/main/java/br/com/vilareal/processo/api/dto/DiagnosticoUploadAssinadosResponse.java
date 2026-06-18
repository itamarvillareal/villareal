package br.com.vilareal.processo.api.dto;

import java.util.List;

public record DiagnosticoUploadAssinadosResponse(
        int pareadas,
        int jaAssinadas,
        List<String> naoPareadas,
        List<String> ambiguas,
        List<String> invalidas,
        List<String> semConteudo,
        int peticoesQueViraramAssinadas,
        /** {@code true} quando há ambíguos ou «já assinados» — o front pode pedir confirmação de substituição. */
        boolean requerConfirmacaoSubstituicao) {}
