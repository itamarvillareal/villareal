package br.com.vilareal.projudi;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.concurrent.locks.ReentrantLock;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/**
 * Single-flight global para acesso ao PROJUDI (sessão/OTP). Cobre orquestrador/run,
 * backfill-submenu e disparo automático por e-mail.
 */
@Component
public class ProjudiOrquestradorGate {

    private static final Logger log = LoggerFactory.getLogger(ProjudiOrquestradorGate.class);

    private final ReentrantLock lock = new ReentrantLock();

    public boolean tryLock() {
        return lock.tryLock();
    }

    public void unlock() {
        if (lock.isHeldByCurrentThread()) {
            lock.unlock();
        }
    }

    public boolean tryExecutar(String contexto, Runnable action) {
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
     * Aguarda o lock (ex.: protocolo manual iniciado pelo utilizador) em vez de falhar de imediato.
     */
    public <T> java.util.Optional<T> executarComRetornoAguardando(
            String contexto, Duration timeout, Supplier<T> action) {
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
    }
}
