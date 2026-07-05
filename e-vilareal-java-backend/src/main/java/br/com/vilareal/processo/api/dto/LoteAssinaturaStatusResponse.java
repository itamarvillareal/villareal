package br.com.vilareal.processo.api.dto;

import br.com.vilareal.assinador.domain.AssinaturaLoteStatus;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

public record LoteAssinaturaStatusResponse(
        Long loteId,
        AssinaturaLoteStatus status,
        List<Long> peticaoIds,
        Long credencialId,
        String erroCodigo,
        String erroMensagem,
        String mensagemUsuario,
        JsonNode resultadoJson) {}
