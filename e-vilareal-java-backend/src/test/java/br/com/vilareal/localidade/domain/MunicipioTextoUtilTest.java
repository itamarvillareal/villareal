package br.com.vilareal.localidade.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MunicipioTextoUtilTest {

    @Test
    void normalizarNome_removeAcentosEUppercase() {
        assertThat(MunicipioTextoUtil.normalizarNome("Anápolis")).isEqualTo("ANAPOLIS");
        assertThat(MunicipioTextoUtil.normalizarNome("  são paulo ")).isEqualTo("SAO PAULO");
    }

    @Test
    void normalizarUf_truncaDoisChars() {
        assertThat(MunicipioTextoUtil.normalizarUf(" go ")).isEqualTo("GO");
        assertThat(MunicipioTextoUtil.normalizarUf("Goiás")).isEqualTo("GO");
    }
}
