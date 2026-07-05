package br.com.vilareal.assinador.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AssinadorSecretComparatorTest {

    @Test
    void secretsIguais_comparacaoConstante() {
        assertThat(AssinadorSecretComparator.secretsIguais("abc", "abc")).isTrue();
        assertThat(AssinadorSecretComparator.secretsIguais("abc", "abd")).isFalse();
        assertThat(AssinadorSecretComparator.secretsIguais(null, "x")).isFalse();
        assertThat(AssinadorSecretComparator.secretsIguais("x", null)).isFalse();
    }
}
