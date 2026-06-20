package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ContratoFechoTextoTest {

    @Test
    void fechoHonorarios_duasVias_mencionaImpressao() {
        String fecho = ContratoFechoTexto.montarFechoHonorarios(ContratoFormaAssinatura.DUAS_VIAS);
        assertThat(fecho).contains("duas (02) vias de igual teor");
        assertThat(fecho).doesNotContain("via digital");
    }

    @Test
    void fechoHonorarios_viaDigital_mencionaAssinaturaDigital() {
        String fecho = ContratoFechoTexto.montarFechoHonorarios(ContratoFormaAssinatura.VIA_DIGITAL);
        assertThat(fecho).contains("via digital");
        assertThat(fecho).doesNotContain("duas (02) vias");
    }

    @Test
    void resolverFormaAssinatura_aceitaValoresDaApi() {
        assertThat(ContratoFormaAssinatura.resolver("via_digital")).isEqualTo(ContratoFormaAssinatura.VIA_DIGITAL);
        assertThat(ContratoFormaAssinatura.resolver("duas_vias")).isEqualTo(ContratoFormaAssinatura.DUAS_VIAS);
        assertThat(ContratoFormaAssinatura.resolver(null)).isEqualTo(ContratoFormaAssinatura.DUAS_VIAS);
    }
}
