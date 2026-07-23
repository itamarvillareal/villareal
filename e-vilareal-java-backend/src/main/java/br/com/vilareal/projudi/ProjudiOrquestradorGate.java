package br.com.vilareal.projudi;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/**
 * Single-flight global para acesso ao PROJUDI (sessão/OTP). Cobre orquestrador/run,
 * backfill-submenu e disparo automático por e-mail.
 *
 * <p><b>Prioridade do utilizador:</b> operações iniciadas pelo utilizador (ex.: protocolo) usam
 * {@link #executarComRetornoAguardando} e sinalizam {@code prioridadeAguardando}. Enquanto há uma
 * operação prioritária pendente/ativa, as rotinas automáticas ({@link #tryExecutar} /
 * {@link #tryExecutarComRetorno}) cedem (não pegam o lock) e as que estão em execução devem parar
 * num ponto seguro consultando {@link #haPrioridadeAguardando()}. Assim o protocolo nunca fica preso
 * atrás da consulta automática, que reinicia naturalmente no próximo ciclo.</p>
 */
@Component
public class ProjudiOrquestradorGate {

    private static final Logger log = LoggerFactory.getLogger(ProjudiOrquestradorGate.class);

    private final ReentrantLock lock = new ReentrantLock();
    private final AtomicInteger prioridadeAguardando = new AtomicInteger(0);

    /** {@code true} quando há operação prioritária (utilizador) aguardando ou em execução. */
    public boolean haPrioridadeAguardando() {
        return prioridadeAguardando.get() > 0;
    }

    /**
     * Robô PROJUDI livre: sem lock e sem operação prioritária pendente.
     * Há corrida possível até {@link #tryExecutar}; use try* para adquirir de fato.
     */
    public boolean estaOcioso() {
        return !lock.isLocked() && prioridadeAguardando.get() == 0;
    }

    public boolean tryLock() {
        return lock.tryLock();
    }

    public void unlock() {
        if (lock.isHeldByCurrentThread()) {
            lock.unlock();
        }
    }

    public boolean tryExecutar(String contexto, Runnable action) {
        if (prioridadeAguardando.get() > 0) {
            log.info("robô PROJUDI: cedendo a operação prioritária do utilizador, pulando ({})", contexto);
            return false;
        }
        if (!lock.tryLock()) {
            log.info("robô PROJUDI ocupado, pulando ({})", contexto);
            return false;
        }
        try {
            action.run();
            return true;
        } finally {
            lock.unlock();
        }
    }

    public <T> java.util.Optional<T> tryExecutarComRetorno(String contexto, Supplier<T> action) {
        if (prioridadeAguardando.get() > 0) {
            log.info("robô PROJUDI: cedendo a operação prioritária do utilizador, pulando ({})", contexto);
            return java.util.Optional.empty();
        }
        if (!lock.tryLock()) {
            log.info("robô PROJUDI ocupado, pulando ({})", contexto);
            return java.util.Optional.empty();
        }
        try {
            return java.util.Optional.of(action.get());
        } finally {
            lock.unlock();
        }
    }

    /**
     * Aguarda o lock (ex.: protocolo iniciado pelo utilizador) em vez de falhar de imediato, com
     * <b>prioridade</b>: marca {@code prioridadeAguardando} para que as rotinas automáticas cedam o
     * robô (não peguem o lock e parem num ponto seguro). A marca permanece durante toda a execução.
     */
    public <T> java.util.Optional<T> executarComRetornoAguardando(
            String contexto, Duration timeout, Supplier<T> action) {
        prioridadeAguardando.incrementAndGet();
        try {
            boolean acquired;
            try {
                acquired = lock.tryLock(timeout.toMillis(), TimeUnit.MILLISECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.warn("Aguardar lock PROJUDI interrompido ({})", contexto);
                return java.util.Optional.empty();
            }
            if (!acquired) {
                log.warn("robô PROJUDI ocupado após {} ({})", timeout, contexto);
                return java.util.Optional.empty();
            }
            try {
                return java.util.Optional.of(action.get());
            } finally {
                lock.unlock();
            }
        } finally {
            prioridadeAguardando.decrementAndGet();
        }
    }
}
