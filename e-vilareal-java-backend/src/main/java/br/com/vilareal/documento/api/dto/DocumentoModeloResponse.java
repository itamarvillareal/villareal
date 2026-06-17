package br.com.vilareal.documento.api.dto;

import java.time.Instant;

public record DocumentoModeloResponse(
        Long id,
        String label,
        Long usuarioResponsavelId,
        String usuarioResponsavelNome,
        String usuarioResponsavelLogin,
        String advogadoNome,
        String advogadoOab,
        String rodapeTexto,
        boolean temCabecalhoImagem,
        String cabecalhoContentType,
        boolean ativo,
        Instant criadoEm,
        Instant atualizadoEm) {}
