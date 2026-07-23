package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProjudiOrquestradorGateIdleTest {

    @Test
    void estaOcioso_respeitaLockEPrioridade() {
        ProjudiOrquestradorGate gate = new ProjudiOrquestradorGate();
        assertThat(gate.estaOcioso()).isTrue();

        gate.tryLock();
        try {
            assertThat(gate.estaOcioso()).isFalse();
        } finally {
            gate.unlock();
        }
        assertThat(gate.estaOcioso()).isTrue();

        gate.executarComRetornoAguardando(
                "teste-prioridade",
                java.time.Duration.ofSeconds(1),
                () -> {
                    assertThat(gate.haPrioridadeAguardando()).isTrue();
                    assertThat(gate.estaOcioso()).isFalse();
                    return "ok";
                });
        assertThat(gate.estaOcioso()).isTrue();
    }
}
