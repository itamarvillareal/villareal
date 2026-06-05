package br.com.vilareal.projudi.pipeline;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização do hash PROJUDI — par e {@code hash_conteudo} extraídos de {@code publicacoes}
 * (origem PROJUDI, ambiente local vilareal-db):
 * <pre>
 * SELECT numero_processo_encontrado, arquivo_origem_nome, hash_conteudo
 * FROM publicacoes
 * WHERE origem_importacao='PROJUDI' AND arquivo_origem_nome LIKE 'PROJUDI mov%'
 * LIMIT 5;
 * </pre>
 * Linha usada: {@code 5059346-36.2026.8.09.0007 | PROJUDI mov 35 [481112537] | cb7486ab...}
 */
class ProjudiMovimentacaoHashUtilTest {

    /** Par real gravado em {@code publicacoes.hash_conteudo} (não recalculado no teste). */
    private static final String CNJ_REAL = "5059346-36.2026.8.09.0007";
    private static final String ID_MOVI_REAL = "481112537";
    private static final String HASH_CONTEUDO_REAL =
            "cb7486abd04b345b5d51b5b94066cd37dffbb88b53a486e558ebbc590ee5823d";

    @Test
    void hashConteudoMovimentacao_reproduzHexGravadoEmProducaoLocal() {
        assertThat(ProjudiMovimentacaoHashUtil.hashConteudoMovimentacao(CNJ_REAL, ID_MOVI_REAL))
                .isEqualTo(HASH_CONTEUDO_REAL);
    }

    @Test
    void hashConteudoMovimentacao_estavelParaMesmaEntrada() {
        String h1 = ProjudiMovimentacaoHashUtil.hashConteudoMovimentacao(CNJ_REAL, ID_MOVI_REAL);
        String h2 = ProjudiMovimentacaoHashUtil.hashConteudoMovimentacao(CNJ_REAL, ID_MOVI_REAL);
        assertThat(h1).isEqualTo(h2).isEqualTo(HASH_CONTEUDO_REAL);
    }

    @Test
    void hashConteudoMovimentacao_idMoviDiferenteAlteraHash() {
        String outro = ProjudiMovimentacaoHashUtil.hashConteudoMovimentacao(CNJ_REAL, "479808464");
        assertThat(outro).isNotEqualTo(HASH_CONTEUDO_REAL);
    }

    @Test
    void hashConteudoMovimentacao_cnjFormatadoECnjSoDigitosProduzemMesmoHash() {
        String formatado = ProjudiMovimentacaoHashUtil.hashConteudoMovimentacao(
                "5059346-36.2026.8.09.0007", ID_MOVI_REAL);
        String soDigitos = ProjudiMovimentacaoHashUtil.hashConteudoMovimentacao(
                "50593463620268090007", ID_MOVI_REAL);
        assertThat(formatado).isEqualTo(soDigitos).isEqualTo(HASH_CONTEUDO_REAL);
    }
}
