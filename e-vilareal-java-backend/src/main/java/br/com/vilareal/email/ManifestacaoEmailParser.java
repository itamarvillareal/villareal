package br.com.vilareal.email;

import br.com.vilareal.publicacao.api.dto.PublicacaoWriteRequest;

import java.util.List;

/**
 * Parser de um email de movimentação processual (Projudi TJGO, TRT PUSH, etc.) em
 * uma lista de {@link PublicacaoWriteRequest} prontas para gravação.
 */
@FunctionalInterface
public interface ManifestacaoEmailParser {

    List<PublicacaoWriteRequest> parse(String conteudoEmail, String assunto, String arquivoOrigemNome, String snippetGmail);
}
