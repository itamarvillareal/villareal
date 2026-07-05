package br.com.vilareal.assinador.local.api;

import java.util.List;

public record LotePendente(long loteId, long credencialId, List<ArquivoPendente> arquivos) {

    public record ArquivoPendente(
            long arquivoId,
            long peticaoId,
            int ordem,
            String nomeCanonicoPdf,
            String nomeCanonicoP7s) {}
}
