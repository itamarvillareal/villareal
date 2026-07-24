package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoNomeNumeracaoUtilTest {

    @Test
    void formatarNomeArquivoPeticao_usaPrefixo01() {
        assertThat(DocumentoNomeNumeracaoUtil.formatarNomeArquivoPeticao("Inicial", LocalDate.of(2026, 7, 22)))
                .isEqualTo("01.PeticaoInicial.pdf");
        assertThat(DocumentoNomeNumeracaoUtil.formatarNomeArquivoPeticao("Execucao", LocalDate.of(2026, 7, 22)))
                .isEqualTo("01.PeticaoExecucao.pdf");
        assertThat(DocumentoNomeNumeracaoUtil.formatarNomeArquivoPeticao("Documento_Formatado", LocalDate.of(2026, 7, 22)))
                .isEqualTo("01.PeticaoFormatada.pdf");
    }

    @Test
    void formatarNomePessoaAssinado_numeraAPartirDe02() {
        assertThat(DocumentoNomeNumeracaoUtil.formatarNomePessoaAssinado(2, "Procuracao"))
                .isEqualTo("02.Procuracao.pdf.p7s");
        assertThat(DocumentoNomeNumeracaoUtil.formatarNomePessoaAssinado(3, "Contrato Social"))
                .isEqualTo("03.Contrato_Social.pdf.p7s");
    }

    @Test
    void calcularProximoNumeroPessoaAssinados_respeitaSequencia() {
        assertThat(DocumentoNomeNumeracaoUtil.calcularProximoNumeroPessoaAssinados(List.of()))
                .isEqualTo(2);
        assertThat(DocumentoNomeNumeracaoUtil.calcularProximoNumeroPessoaAssinados(
                        List.of("02.Procuracao.pdf.p7s", "03.ContratoSocial.pdf.p7s")))
                .isEqualTo(4);
        assertThat(DocumentoNomeNumeracaoUtil.calcularProximoNumeroPessoaAssinados(
                        List.of("01.PeticaoInicial.pdf.p7s")))
                .isEqualTo(2);
    }

    @Test
    void extrairDescricaoBase_removePrefixoNumerico() {
        assertThat(DocumentoNomeNumeracaoUtil.extrairDescricaoBase("02.Procuracao.pdf.p7s"))
                .isEqualTo("Procuracao");
    }
}
