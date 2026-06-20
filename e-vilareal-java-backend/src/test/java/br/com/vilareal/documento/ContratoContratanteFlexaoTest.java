package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import java.util.List;

import static br.com.vilareal.documento.FlexaoUtil.Genero.FEMININO;
import static br.com.vilareal.documento.FlexaoUtil.Genero.MASCULINO;
import static br.com.vilareal.documento.FlexaoUtil.Numero.PLURAL;
import static br.com.vilareal.documento.FlexaoUtil.Numero.SINGULAR;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ContratoContratanteFlexaoTest {

    @Test
    void receberaDeContratanteMasculinoSingular() {
        assertThat(new ContratoContratanteFlexao(MASCULINO, SINGULAR).receberaDeContratante())
                .isEqualTo("receberá do Contratante");
    }

    @Test
    void receberaDeContratanteFemininoSingular() {
        assertThat(new ContratoContratanteFlexao(FEMININO, SINGULAR).receberaDeContratante())
                .isEqualTo("receberá da Contratante");
    }

    @Test
    void receberaDeContratantesMasculinoPlural() {
        assertThat(new ContratoContratanteFlexao(MASCULINO, PLURAL).receberaDeContratante())
                .isEqualTo("receberá dos Contratantes");
    }

    @Test
    void receberaDeContratantesFemininoPlural() {
        assertThat(new ContratoContratanteFlexao(FEMININO, PLURAL).receberaDeContratante())
                .isEqualTo("receberá das Contratantes");
    }
    @Test
    void resolverSemIdsUsaPadraoMasculinoSingular() {
        QualificacaoPessoaUtil util = mock(QualificacaoPessoaUtil.class);
        var resolver = new ContratoContratanteFlexaoResolver(util);

        ContratoContratanteFlexao flexao = resolver.resolver(null, null);

        assertThat(flexao.genero()).isEqualTo(MASCULINO);
        assertThat(flexao.numero()).isEqualTo(SINGULAR);
    }

    @Test
    void resolverDoisContratantesMasculinos() {
        QualificacaoPessoaUtil util = mock(QualificacaoPessoaUtil.class);
        when(util.generoFlexaoPorPessoaId(1L)).thenReturn(MASCULINO);
        when(util.generoFlexaoPorPessoaId(2L)).thenReturn(MASCULINO);
        var resolver = new ContratoContratanteFlexaoResolver(util);

        ContratoContratanteFlexao flexao = resolver.resolver(null, List.of(1L, 2L));

        assertThat(flexao.genero()).isEqualTo(MASCULINO);
        assertThat(flexao.numero()).isEqualTo(PLURAL);
        assertThat(flexao.receberaDeContratante()).isEqualTo("receberá dos Contratantes");
    }

    @Test
    void resolverPessoaIdUnicaFeminina() {
        QualificacaoPessoaUtil util = mock(QualificacaoPessoaUtil.class);
        when(util.generoFlexaoPorPessoaId(10L)).thenReturn(FEMININO);
        var resolver = new ContratoContratanteFlexaoResolver(util);

        ContratoContratanteFlexao flexao = resolver.resolver(10L, null);

        assertThat(flexao.receberaDeContratante()).isEqualTo("receberá da Contratante");
    }
}
