package br.com.vilareal.configuracao.api.dto;

import java.util.List;

public record UsuarioMenuPreferenciaResponse(Long usuarioId, List<UsuarioMenuItemDto> itens) {}
