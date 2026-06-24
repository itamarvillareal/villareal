package br.com.vilareal.documento;

import br.com.vilareal.documento.parse.DocumentoParagrafoHtmlUtil;
import br.com.vilareal.documento.parse.ParagrafoDocumento;
import br.com.vilareal.documento.parse.SecaoDocumento;

import java.util.ArrayList;

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
        boolean omitirFechoPadrao,
        String advogadoNome,
        String advogadoOab,
        boolean modoCorpoUnico,
        String corpoUnicoHtml,
        Long processoId) {

    public DocumentoRenderContext {
        secoesLegado = secoesLegado != null ? List.copyOf(secoesLegado) : List.of();
        pedidos = pedidos != null ? List.copyOf(pedidos) : List.of();
        preambuloParagrafos = preambuloParagrafos != null ? List.copyOf(preambuloParagrafos) : List.of();
        secoesDocumento = secoesDocumento != null ? List.copyOf(secoesDocumento) : List.of();
        fechoParagrafos = fechoParagrafos != null ? List.copyOf(fechoParagrafos) : List.of();
    }

    public static DocumentoRenderContext legado(DocumentoGerarRequest request) {
        String preambuloHtml = DocumentoParagrafoHtmlUtil.normalizarHtmlLegadoPreambulo(request.preambulo());
        List<DocumentoGerarRequest.SecaoPeticao> secoesNormalizadas = new ArrayList<>();
        if (request.secoes() != null) {
            for (DocumentoGerarRequest.SecaoPeticao secao : request.secoes()) {
                if (secao == null) {
                    continue;
                }
                secoesNormalizadas.add(new DocumentoGerarRequest.SecaoPeticao(
                        secao.titulo(),
                        DocumentoParagrafoHtmlUtil.normalizarHtmlLegadoCorpo(secao.conteudo())));
            }
        }
        return new DocumentoRenderContext(
                request.enderecamento(),
                request.numeroProcesso(),
                request.cidadeEstado(),
                request.data(),
                false,
                null,
                preambuloHtml,
                secoesNormalizadas,
                normalizarPedidos(request.pedidos()),
                List.of(),
                List.of(),
                List.of(),
                null,
                false,
                null,
                null,
                false,
                null,
                request.processoId());
    }

    /** Remove «a)», «b) » etc. colados no texto — o template já numera os pedidos. */
    static List<String> normalizarPedidos(List<String> pedidos) {
        if (pedidos == null || pedidos.isEmpty()) {
            return List.of();
        }
        return pedidos.stream()
                .map(DocumentoRenderContext::limparMarcadorPedido)
                .filter(p -> p != null && !p.isBlank())
                .toList();
    }

    static String limparMarcadorPedido(String pedido) {
        if (pedido == null) {
            return "";
        }
        return pedido.strip().replaceFirst("(?i)^[a-z]\\)\\s*", "");
    }
}
