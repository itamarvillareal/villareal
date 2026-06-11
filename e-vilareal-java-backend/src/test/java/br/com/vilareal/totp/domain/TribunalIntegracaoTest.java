package br.com.vilareal.totp.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TribunalIntegracaoTest {

    @Test
    void pjeTrt18ResolveParaTotpApp() {
        assertThat(TribunalIntegracao.PJE_TRT18.tipoSegundoFator()).isEqualTo(TipoSegundoFator.TOTP_APP);
    }

    @Test
    void fromCodigoAceitaPjeTrt18() {
        assertThat(TribunalIntegracao.fromCodigo("pje_trt18")).isEqualTo(TribunalIntegracao.PJE_TRT18);
    }

    @Test
    void fromCodigoRejeitaProjudi() {
        assertThatThrownBy(() -> TribunalIntegracao.fromCodigo("PROJUDI_TJGO"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Tribunal desconhecido");
    }
}
