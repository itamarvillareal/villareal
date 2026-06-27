package br.com.vilareal.configuracao.api.dto;

import java.util.List;

public record ProjudiProtocoloEmailConfigResponse(
        boolean ativo, String assuntoPrefixo, List<String> destinatarios) {}
