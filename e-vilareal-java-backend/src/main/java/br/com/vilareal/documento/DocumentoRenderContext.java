package br.com.vilareal.documento;

import br.com.vilareal.documento.parse.ParagrafoDocumento;
import br.com.vilareal.documento.parse.SecaoDocumento;

import java.time.LocalDate;
import java.util.List;

/** Modelo interno para renderização Thymeleaf (modo legado ou reformatado). */
public record DocumentoRenderContext(
        String enderecamento,
        String numeroProcesso,
        String cidadeEstado,
        LocalDate data,
        boolean modoReformatado,
        String nomePeca,
        String preambuloHtml,
        List<DocumentoGerarRequest.SecaoPeticao> secoesLegado,
        List<String> pedidos,
        List<ParagrafoDocumento> preambuloParagrafos,
        List<SecaoDocumento> secoesDocumento,
        List<ParagrafoDocumento> fechoParagrafos,
        String localDataCustom,
        boolean omitirFechoPadrao) {

    public DocumentoRenderContext {
        secoesLegado = secoesLegado != null ? List.copyOf(secoesLegado) : List.of();
        pedidos = pedidos != null ? List.copyOf(pedidos) : List.of();
        preambuloParagrafos = preambuloParagrafos != null ? List.copyOf(preambuloParagrafos) : List.of();
        secoesDocumento = secoesDocumento != null ? List.copyOf(secoesDocumento) : List.of();
        fechoParagrafos = fechoParagrafos != null ? List.copyOf(fechoParagrafos) : List.of();
    }

    public static DocumentoRenderContext legado(DocumentoGerarRequest request) {
        return new DocumentoRenderContext(
                request.enderecamento(),
                request.numeroProcesso(),
                request.cidadeEstado(),
                request.data(),
                false,
                null,
                request.preambulo(),
                request.secoes(),
                request.pedidos(),
                List.of(),
                List.of(),
                List.of(),
                null,
                false);
    }
}
