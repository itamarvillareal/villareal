package br.com.vilareal.documento;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PortuguesHifenizacaoUtilTest {

    private static final char SHY = PortuguesHifenizacaoUtil.HIFEN_OPCIONAL;

    @Test
    void inserirHifensSilabicos_joaoSeparaAntesDoNucleoNasal() {
        assertThat(PortuguesHifenizacaoUtil.inserirHifensSilabicos("JOÃO"))
                .isEqualTo("JO" + SHY + "ÃO");
        assertThat(PortuguesHifenizacaoUtil.inserirHifensSilabicos("João"))
                .isEqualTo("Jo" + SHY + "ão");
    }

    @Test
    void inserirHifensSilabicos_rodriguesUsaLimitesSilabicos() {
        String hifenizado = PortuguesHifenizacaoUtil.inserirHifensSilabicos("RODRIGUES");
        assertThat(hifenizado).contains(String.valueOf(SHY));
        assertThat(hifenizado.indexOf(SHY)).isLessThan(hifenizado.lastIndexOf(SHY));
        assertThat(hifenizado).isEqualTo("RO" + SHY + "DRI" + SHY + "GUES");
    }

    @Test
    void formatarNomeParaPdf_usaNbspEntrePalavrasEHifenizaCadaToken() {
        assertThat(PortuguesHifenizacaoUtil.formatarNomeParaPdf("OSVALDO JOÃO RODRIGUES"))
                .isEqualTo("OS" + SHY + "VAL" + SHY + "DO\u00A0JO" + SHY + "ÃO\u00A0RO" + SHY + "DRI" + SHY + "GUES");
    }

    @Test
    void inserirHifensSilabicosNoHtml_preservaTagsEIgnoraDatas() {
        String html =
                "<p>face de <strong>OSVALDO JOÃO</strong>, qualificado; vencimento em "
                        + "<span class=\"data-unica\">05/08/2026</span>.</p>";
        String out = PortuguesHifenizacaoUtil.inserirHifensSilabicosNoHtml(html);
        assertThat(out).contains("<strong>OS" + SHY + "VAL" + SHY + "DO JO" + SHY + "ÃO</strong>");
        assertThat(out).contains("<span class=\"data-unica\">05/08/2026</span>");
    }

    @Test
    void inserirHifensSilabicosNoHtml_naoAlteraConteudoDeStyle() {
        String html =
                "<style type=\"text/css\">.cabecalho-padrao { position: running(cabecalho-padrao); }</style>"
                        + "<p>documento reformatado</p>";
        String out = PortuguesHifenizacaoUtil.inserirHifensSilabicosNoHtml(html);
        assertThat(out).contains("position: running(cabecalho-padrao);");
        assertThat(out).contains("do" + SHY + "cu" + SHY + "men" + SHY + "to");
    }

    @Test
    void inserirHifensSilabicos_palavrasCurtasPermanecemIntactas() {
        assertThat(PortuguesHifenizacaoUtil.inserirHifensSilabicos("RUA")).isEqualTo("RUA");
        assertThat(PortuguesHifenizacaoUtil.inserirHifensSilabicos("DE")).isEqualTo("DE");
    }
}
