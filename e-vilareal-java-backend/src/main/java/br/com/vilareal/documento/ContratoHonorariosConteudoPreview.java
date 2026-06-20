package br.com.vilareal.documento;

import java.util.List;

/** Conteúdo editável do contrato de honorários antes da geração final do PDF. */
public record ContratoHonorariosConteudoPreview(
        String preambuloHtml,
        List<String> clausulas,
        String fechoHtml,
        String localData,
        String nomeContratante,
        String nomeContratado) {}
