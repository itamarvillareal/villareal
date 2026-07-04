package br.com.vilareal.whatsapp.infrastructure.persistence.repository;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Valida a regra de ordenação pinned DESC, lastMessageAt DESC (espelho do ORDER BY SQL).
 */
class WhatsAppConversationPinOrderTest {

    record Conv(String phone, boolean pinned, Instant lastMessageAt) {}

    private static List<Conv> sortLikeQuery(List<Conv> input) {
        return input.stream()
                .sorted(Comparator.comparing(Conv::pinned)
                        .reversed()
                        .thenComparing(Conv::lastMessageAt, Comparator.reverseOrder()))
                .toList();
    }

    @Test
    void fixadaAntigaVemAntesDeNaoFixadaRecente() {
        Instant agora = Instant.parse("2026-06-04T12:00:00Z");
        Instant ontem = Instant.parse("2026-06-03T12:00:00Z");

        List<Conv> sorted = sortLikeQuery(List.of(
                new Conv("5511999900001", false, agora),
                new Conv("5511999900002", true, ontem)));

        assertThat(sorted.stream().map(Conv::phone).toList())
                .containsExactly("5511999900002", "5511999900001");
    }

    @Test
    void semFixadas_mantemOrdemPorRecencia() {
        Instant t1 = Instant.parse("2026-06-04T12:00:00Z");
        Instant t2 = Instant.parse("2026-06-03T12:00:00Z");

        List<Conv> sorted = sortLikeQuery(List.of(
                new Conv("a", false, t2),
                new Conv("b", false, t1)));

        assertThat(sorted.stream().map(Conv::phone).toList()).containsExactly("b", "a");
    }
}
