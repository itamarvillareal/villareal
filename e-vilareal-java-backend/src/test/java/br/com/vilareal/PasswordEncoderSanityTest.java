package br.com.vilareal;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Teste unitário sem Docker — valida o hash usado no seed {@code V2__bootstrap_admin.sql}.
 */
class PasswordEncoderSanityTest {

    @Test
    void bootstrapAdminHashMatchesPassword() {
        var enc = new BCryptPasswordEncoder(12);
        assertThat(enc.matches("password", "$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG")).isTrue();
    }
}
