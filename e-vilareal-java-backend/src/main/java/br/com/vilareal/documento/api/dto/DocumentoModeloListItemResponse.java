package br.com.vilareal.documento.api.dto;

import java.time.Instant;

public record DocumentoModeloListItemResponse(
        Long id,
        String label,
        Long usuarioResponsavelId,
        String usuarioResponsavelNome,
        String usuarioResponsavelLogin,
        String advogadoNome,
        String advogadoOab,
        boolean temCabecalhoImagem,
        boolean ativo,
        Instant atualizadoEm) {}
