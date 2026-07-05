package br.com.vilareal.processo.api.dto;

import java.util.List;

public record AssinarAutomaticoResponse(
        Long loteId,
        List<Long> peticaoIds,
        int totalArquivos,
        boolean loteReutilizado) {}
