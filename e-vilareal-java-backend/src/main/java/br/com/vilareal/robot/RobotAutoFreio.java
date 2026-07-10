package br.com.vilareal.robot;

import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.LongSupplier;

/**
 * Auto-freio: após N erros consecutivos o robô pausa pelo período de cooldown.
 * Passado o cooldown, libera automaticamente uma nova tentativa (meia-abertura):
 * sucesso zera o contador; nova falha re-freia de imediato por mais um cooldown.
 * {@link #reset()} manual continua disponível para destravar antes do prazo.
 */
@Component
public class RobotAutoFreio {

    private static final long COOLDOWN_PADRAO_MS = 5 * 60_000L;

    private final AtomicInteger errosConsecutivos = new AtomicInteger(0);
    private volatile int limite = 3;
    private volatile long cooldownMs = COOLDOWN_PADRAO_MS;
    private volatile long ultimaFalhaEpochMs = 0L;
    private final LongSupplier relogio;

    public RobotAutoFreio() {
        this(System::currentTimeMillis);
    }

    RobotAutoFreio(LongSupplier relogio) {
        this.relogio = relogio;
    }

    public void configurarLimite(int limite) {
        this.limite = Math.max(1, limite);
    }

    public void configurarCooldownMs(long cooldownMs) {
        this.cooldownMs = Math.max(0L, cooldownMs);
    }

    public boolean estaFreiado() {
        if (errosConsecutivos.get() < limite) {
            return false;
        }
        if (cooldownRestanteMs() == 0L) {
            // Meia-abertura: permite 1 nova tentativa sem zerar o histórico todo.
            errosConsecutivos.set(limite - 1);
            return false;
        }
        return true;
    }

    /** Tempo restante do cooldown; 0 quando já liberado (ou nunca freiado). */
    public long cooldownRestanteMs() {
        long restante = cooldownMs - (relogio.getAsLong() - ultimaFalhaEpochMs);
        return Math.max(0L, restante);
    }

    /** Ex.: "1 minuto", "3 minutos" — para mensagens ao usuário (arredonda para cima). */
    public String esperaRestanteTexto() {
        long minutos = Math.max(1L, (cooldownRestanteMs() + 59_999L) / 60_000L);
        return minutos == 1L ? "1 minuto" : minutos + " minutos";
    }

    public void registrarSucesso() {
        errosConsecutivos.set(0);
    }

    public void registrarFalha() {
        errosConsecutivos.incrementAndGet();
        ultimaFalhaEpochMs = relogio.getAsLong();
    }

    public int errosConsecutivos() {
        return errosConsecutivos.get();
    }

    public void reset() {
        errosConsecutivos.set(0);
    }
}
