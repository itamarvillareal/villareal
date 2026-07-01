package br.com.vilareal.pessoa.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TelefoneIndiceUtilTest {

    @Test
    void fromRaw_normalizaDigitosESufixo() {
        TelefoneIndiceUtil.TelefoneIndice idx = TelefoneIndiceUtil.fromRaw("(62) 99268-2445");
        assertThat(idx.digitos()).isEqualTo("62992682445");
        assertThat(idx.sufixo8()).isEqualTo("92682445");
    }

    @Test
    void fromRaw_vazio() {
        TelefoneIndiceUtil.TelefoneIndice idx = TelefoneIndiceUtil.fromRaw("  ");
        assertThat(idx.digitos()).isNull();
        assertThat(idx.sufixo8()).isNull();
    }

    @Test
    void fromRaw_curtoSemSufixo() {
        TelefoneIndiceUtil.TelefoneIndice idx = TelefoneIndiceUtil.fromRaw("9268");
        assertThat(idx.digitos()).isEqualTo("9268");
        assertThat(idx.sufixo8()).isNull();
    }
}
