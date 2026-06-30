package br.com.vilareal.documento;

import java.util.List;

/** Conteúdo editável do contrato de locação antes da geração final do PDF. */
public record ContratoLocacaoConteudoPreview(
        String tituloContrato,
        String preambuloHtml,
        List<String> clausulas,
        String fechoHtml,
        String localData) {}
