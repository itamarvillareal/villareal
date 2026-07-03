package br.com.vilareal.imovel.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ImovelLancamentoFiltroResolverTest {

    @Test
    void montarPrefixoObsCodProc_concatenaCodSemZerosComProc() {
        assertThat(ImovelLancamentoFiltroResolver.montarPrefixoObsCodProc("00001157", 9)).isEqualTo("11579");
        assertThat(ImovelLancamentoFiltroResolver.montarPrefixoObsCodProc("793", 20)).isEqualTo("79320");
    }

    @Test
    void montarMarcadorUnidadeCondominio_exigeAmbos() {
        var im = new br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity();
        im.setUnidade("1101 C");
        im.setCondominio("Veredas");
        assertThat(ImovelLancamentoFiltroResolver.montarMarcadorUnidadeCondominio(im)).isEqualTo("1101 C Veredas");
        im.setCondominio("");
        assertThat(ImovelLancamentoFiltroResolver.montarMarcadorUnidadeCondominio(im)).isNull();
    }
}
