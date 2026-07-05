package br.com.vilareal.assinatura.keystore;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class Pkcs11TokenErroUtilTest {

    @Test
    void classificaDeviceErrorComoTokenOcupado() {
        Pkcs11TokenException ex =
                Pkcs11TokenErroUtil.classificar(new RuntimeException("CKR_DEVICE_ERROR: unable to communicate"));

        assertThat(ex.codigo()).isEqualTo(Pkcs11TokenException.Codigo.TOKEN_OCUPADO);
        assertThat(ex.getMessage()).isEqualTo(Pkcs11TokenException.MENSAGEM_TOKEN_OCUPADO);
        assertThat(ex.tokenOcupado()).isTrue();
    }

    @Test
    void classificaTokenNotPresentSeparadamente() {
        Pkcs11TokenException ex =
                Pkcs11TokenErroUtil.classificar(new IllegalStateException("CKR_TOKEN_NOT_PRESENT"));

        assertThat(ex.codigo()).isEqualTo(Pkcs11TokenException.Codigo.TOKEN_NAO_PRESENTE);
    }

    @Test
    void classificaPinIncorreto() {
        Pkcs11TokenException ex =
                Pkcs11TokenErroUtil.classificar(new RuntimeException("CKR_PIN_INCORRECT"));

        assertThat(ex.codigo()).isEqualTo(Pkcs11TokenException.Codigo.PIN_INCORRETO);
    }
}
