package br.com.vilareal.documento;

import java.time.LocalDate;
import java.util.List;

public record DocumentoGerarRequest(
        String enderecamento,
        String numeroProcesso,
        String preambulo,
        List<SecaoPeticao> secoes,
        List<String> pedidos,
        String cidadeEstado,
        LocalDate data,
        Long processoId
) {
    public record SecaoPeticao(String titulo, String conteudo) {}
}
