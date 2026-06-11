package br.com.vilareal.totp.security;

import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

class SegredoCipherServiceTest {

    private static final String CHAVE_TESTE =
            Base64.getEncoder().encodeToString(new byte[32]);

    @Test
    void cifrarDecifrarRoundTrip() {
        SegredoCipherService cipher = new SegredoCipherService(CHAVE_TESTE, "");
        cipher.inicializar();

        String cifrado = cipher.cifrar("JBSWY3DPEHPK3PXP");
        String claro = cipher.decifrar(cifrado);

        assertThat(claro).isEqualTo("JBSWY3DPEHPK3PXP");
        assertThat(cifrado).isNotEqualTo("JBSWY3DPEHPK3PXP");
    }

    @Test
    void cifrarDecifrarSenhaPrimeiroFator() {
        SegredoCipherService cipher = new SegredoCipherService(CHAVE_TESTE, "");
        cipher.inicializar();

        String cifrado = cipher.cifrar("SenhaPje#Robo");
        assertThat(cipher.decifrar(cifrado)).isEqualTo("SenhaPje#Robo");
    }
}
