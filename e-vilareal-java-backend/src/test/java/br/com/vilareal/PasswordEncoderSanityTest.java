package br.com.vilareal;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Teste unitário sem Docker — valida o hash BCrypt usado em V2 e V18 (senha 123456).
 */
class PasswordEncoderSanityTest {

    private static final String HASH_SENHA_123456 =
            "$2a$10$m2m366PkPAQeHNB4o3uQQ.An0s/NcT097ZikNcRCJXOnFPs2caK.m";

    @Test
    void senhaPadrao123456HashMatchesPlainPassword() {
        var enc = new BCryptPasswordEncoder(12);
        assertThat(enc.matches("123456", HASH_SENHA_123456)).isTrue();
    }
}
