package br.com.vilareal.pessoa.domain;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Espelha a regra SQL de {@code PessoaRepository#calcularProximoId}:
 * menor id ≥ 1 ainda não usado.
 */
class MenorIdPessoaLivreTest {

    static long menorIdLivre(Set<Long> existentes) {
        long n = 1;
        while (existentes.contains(n)) {
            n++;
        }
        return n;
    }

    @Test
    void tabelaVazia_elege1() {
        assertEquals(1L, menorIdLivre(Set.of()));
    }

    @Test
    void falta1_elege1() {
        assertEquals(1L, menorIdLivre(Set.of(2L, 3L, 10L)));
    }

    @Test
    void sequenciaContinua_elegeMaxMaisUm() {
        assertEquals(4L, menorIdLivre(Set.of(1L, 2L, 3L)));
    }

    @Test
    void buracoNoMeio_elegeMenorBuraco() {
        assertEquals(2L, menorIdLivre(Set.of(1L, 3L, 4L)));
    }
}
