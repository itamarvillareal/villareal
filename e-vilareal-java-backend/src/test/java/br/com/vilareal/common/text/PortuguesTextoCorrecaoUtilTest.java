package br.com.vilareal.common.text;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PortuguesTextoCorrecaoUtilTest {

    @Test
    void replacementChar_decisaoENao() {
        String raw = "DECIS\uFFFD\uFFFDO -> N\uFFFDO-CONCESS\uFFFDO -> GRATUIDADE DA JUSTI\uFFFD\uFFFDA";
        String out = PortuguesTextoCorrecaoUtil.normalizar(raw);
        assertThat(out).contains("DECISÃO");
        assertThat(out).contains("NÃO-CONCESSÃO");
        assertThat(out).contains("JUSTIÇA");
    }

    @Test
    void replacementChar_conheco() {
        assertThat(PortuguesTextoCorrecaoUtil.normalizar("N\uFFFDO CONHE\uFFFDO DO PRESENTE"))
                .isEqualTo("NÃO CONHEÇO DO PRESENTE");
    }

    @Test
    void lexicoSemReplacement_descisoesECamara() {
        String raw =
                "PESQUISAR NO JUSBRASIL DESCISOES DOS INTEGRANTES DA CAMAARA NO MESMO SENTIDO";
        String out = PortuguesTextoCorrecaoUtil.normalizar(raw);
        assertThat(out).contains("DECISÕES");
        assertThat(out).contains("CÂMARA");
        assertThat(out).contains("NO MESMO");
    }

    @Test
    void mojibakeBoxDrawingPermaneceIntegrado() {
        String corrupto = "EXECU\u251c\u00e2\u00d4\u00c7\u00ed\u251c\u00e2\u00e3\u00c6O DE PENS\u251c\u00e2\u00e3\u00c6O";
        assertThat(PortuguesTextoCorrecaoUtil.normalizar(corrupto)).isEqualTo("EXECUÇÃO DE PENSÃO");
    }

    @Test
    void lexicoTransitoGoiásAnapolis() {
        assertThat(PortuguesTextoCorrecaoUtil.normalizar("DEPARTAMENTO DE TRANSITO DE GOIAS"))
                .isEqualTo("DEPARTAMENTO DE TRÂNSITO DE GOIÁS");
        assertThat(PortuguesTextoCorrecaoUtil.normalizar(
                        "COMPANHIA MUNICIPAL DE TR\uFFFDNSITO E TRANSPORTES DE AN\uFFFDPOLIS"))
                .contains("TRÂNSITO")
                .contains("ANÁPOLIS");
    }

    @Test
    void normalizarPreservandoQuebras_mantemParagrafos() {
        String raw = "Linha um\n\nLinha dois  com   espaco";
        assertThat(PortuguesTextoCorrecaoUtil.normalizarPreservandoQuebras(raw))
                .isEqualTo("Linha um\n\nLinha dois com espaco");
    }
}
