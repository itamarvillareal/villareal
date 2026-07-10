package br.com.vilareal.robot;

import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;

class RobotAutoFreioTest {

    @Test
    void naoFreiaAbaixoDoLimite() {
        RobotAutoFreio freio = new RobotAutoFreio();
        freio.registrarFalha();
        freio.registrarFalha();
        assertThat(freio.estaFreiado()).isFalse();
    }

    @Test
    void freiaAoAtingirLimiteELiberaSozinhoAposCooldown() {
        AtomicLong agora = new AtomicLong(1_000_000L);
        RobotAutoFreio freio = new RobotAutoFreio(agora::get);
        freio.configurarCooldownMs(60_000L);

        freio.registrarFalha();
        freio.registrarFalha();
        freio.registrarFalha();
        assertThat(freio.estaFreiado()).isTrue();

        agora.addAndGet(59_000L);
        assertThat(freio.estaFreiado()).isTrue();

        agora.addAndGet(1_000L);
        assertThat(freio.estaFreiado()).isFalse();
    }

    @Test
    void meiaAberturaRefreiaNaProximaFalhaEZeraNoSucesso() {
        AtomicLong agora = new AtomicLong(0L);
        RobotAutoFreio freio = new RobotAutoFreio(agora::get);
        freio.configurarCooldownMs(60_000L);

        freio.registrarFalha();
        freio.registrarFalha();
        freio.registrarFalha();
        agora.addAndGet(60_000L);
        assertThat(freio.estaFreiado()).isFalse();

        // Uma única falha na tentativa liberada re-freia de imediato.
        freio.registrarFalha();
        assertThat(freio.estaFreiado()).isTrue();

        agora.addAndGet(60_000L);
        assertThat(freio.estaFreiado()).isFalse();

        freio.registrarSucesso();
        freio.registrarFalha();
        freio.registrarFalha();
        assertThat(freio.estaFreiado()).isFalse();
    }

    @Test
    void resetManualDestravaAntesDoPrazo() {
        AtomicLong agora = new AtomicLong(0L);
        RobotAutoFreio freio = new RobotAutoFreio(agora::get);
        freio.configurarCooldownMs(60_000L);

        freio.registrarFalha();
        freio.registrarFalha();
        freio.registrarFalha();
        assertThat(freio.estaFreiado()).isTrue();

        freio.reset();
        assertThat(freio.estaFreiado()).isFalse();
        assertThat(freio.errosConsecutivos()).isZero();
    }

    @Test
    void esperaRestanteTextoArredondaParaCima() {
        AtomicLong agora = new AtomicLong(0L);
        RobotAutoFreio freio = new RobotAutoFreio(agora::get);
        freio.configurarCooldownMs(300_000L);

        freio.registrarFalha();
        freio.registrarFalha();
        freio.registrarFalha();
        assertThat(freio.esperaRestanteTexto()).isEqualTo("5 minutos");

        agora.addAndGet(250_000L);
        assertThat(freio.esperaRestanteTexto()).isEqualTo("1 minuto");
    }
}
