package br.com.vilareal.documento;

import java.util.List;

record PeticaoAiConteudoJson(
        String preambulo,
        List<SecaoJson> secoes,
        List<String> pedidos
) {
    record SecaoJson(String titulo, String conteudo) {}
}
