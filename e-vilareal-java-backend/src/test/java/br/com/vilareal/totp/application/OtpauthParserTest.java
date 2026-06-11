package br.com.vilareal.totp.application;

import br.com.vilareal.totp.domain.TotpAlgoritmo;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OtpauthParserTest {

    @Test
    void parseUriCompleta() {
        OtpauthParser.OtpauthDados dados = OtpauthParser.parse(
                "otpauth://totp/Villa%20Real:itamar@adv.br?secret=JBSWY3DPEHPK3PXP&issuer=Villa%20Real"
                        + "&algorithm=SHA256&digits=8&period=60");

        assertThat(dados.secretBase32()).isEqualTo("JBSWY3DPEHPK3PXP");
        assertThat(dados.algoritmo()).isEqualTo(TotpAlgoritmo.SHA256);
        assertThat(dados.digitos()).isEqualTo(8);
        assertThat(dados.periodoSegundos()).isEqualTo(60);
        assertThat(dados.issuer()).isEqualTo("Villa Real");
        assertThat(dados.accountName()).isEqualTo("itamar@adv.br");
    }

    @Test
    void parseUriSemParametrosUsaDefaults() {
        OtpauthParser.OtpauthDados dados = OtpauthParser.parse(
                "otpauth://totp/Conta?secret=JBSWY3DPEHPK3PXP");

        assertThat(dados.algoritmo()).isEqualTo(TotpAlgoritmo.SHA1);
        assertThat(dados.digitos()).isEqualTo(6);
        assertThat(dados.periodoSegundos()).isEqualTo(30);
    }

    @Test
    void parseSecretCru() {
        OtpauthParser.OtpauthDados dados = OtpauthParser.parse("jbswy3dpehpk3pxp");

        assertThat(dados.secretBase32()).isEqualTo("JBSWY3DPEHPK3PXP");
        assertThat(dados.algoritmo()).isEqualTo(TotpAlgoritmo.SHA1);
        assertThat(dados.digitos()).isEqualTo(6);
        assertThat(dados.periodoSegundos()).isEqualTo(30);
    }

    @Test
    void rejeitaSecretInvalido() {
        assertThatThrownBy(() -> OtpauthParser.parse("!!!"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
