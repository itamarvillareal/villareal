package br.com.vilareal.email;

/**
 * Configuração de uma fonte de movimentações por email (query Gmail + parser + cursor).
 *
 * @param tipo cursor de sincronização incremental (tabela {@code email_importacao_sync})
 * @param queryBase query COMPLETA do Gmail da fonte (ex.: {@code "from:trt18.jus.br OR subject:[TRT18]"},
 *     {@code "subject:[PROJUDI]"}). Usar query por assunto (e não só {@code from:endereço}) garante
 *     captura dos emails REENCAMINHADOS, cujo índice {@code from:} aponta para a conta que reencaminhou.
 * @param rotulo identificação curta usada em logs (ex.: "Projudi", "TRT")
 * @param arquivoFallbackPrefix prefixo de {@code arquivo_origem_nome} quando o email não tem assunto
 * @param parser parser específico da fonte
 */
public record FonteMovimentacaoEmail(
        EmailImportacaoSyncTipo tipo,
        String queryBase,
        String rotulo,
        String arquivoFallbackPrefix,
        ManifestacaoEmailParser parser) {}
