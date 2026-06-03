package br.com.vilareal.documento;

import java.util.List;

/** Conteúdo editável de documento reformatado (upload Word/PDF). */
public record DocumentoReformatarConteudoRequest(
        String enderecamento,
        String numeroProcesso,
        String cidadeEstado,
        String data,
        String nomePeca,
        String preambulo,
        List<SecaoConteudo> secoes,
        String fecho,
        String advogadoNome,
        String advogadoOab,
        String corpoUnico) {

    public DocumentoReformatarConteudoRequest {
        secoes = secoes != null ? List.copyOf(secoes) : List.of();
    }

    public record SecaoConteudo(String titulo, String tipoTitulo, String conteudo) {}
}
