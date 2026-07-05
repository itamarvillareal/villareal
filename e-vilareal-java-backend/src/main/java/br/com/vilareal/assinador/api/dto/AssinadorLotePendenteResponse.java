package br.com.vilareal.assinador.api.dto;

import java.util.List;

public record AssinadorLotePendenteResponse(
        Long loteId, Long credencialId, List<AssinadorArquivoResponse> arquivos) {}
