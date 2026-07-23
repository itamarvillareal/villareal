package br.com.vilareal.robot;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

/**
 * Single-flight global para robôs de tribunal (PJe, etc.). Espelha o padrão do gate legado
 * sem acoplar pacotes de tribunais encerrados.
 */
@Component
public class RobotGlobalLock {

    private static final Logger log = LoggerFactory.getLogger(RobotGlobalLock.class);

    private final ReentrantLock lock = new ReentrantLock();

    /** {@code true} quando nenhum robô global (PJe etc.) está em execução. */
    public boolean estaOcioso() {
        return !lock.isLocked();
    }

    public boolean tryExecutar(String contexto, Runnable action) {
        if (!lock.tryLock()) {
            log.info("robô global ocupado, pulando ({})", contexto);
            return false;
        }
        try {
            action.run();
            return true;
        } finally {
            lock.unlock();
        }
    }

    public <T> Optional<T> tryExecutarComRetorno(String contexto, Supplier<T> action) {
        if (!lock.tryLock()) {
            log.info("robô global ocupado, pulando ({})", contexto);
            return Optional.empty();
        }
        try {
            return Optional.of(action.get());
        } finally {
            lock.unlock();
        }
    }

    public <T> Optional<T> executarComRetornoAguardando(
            String contexto, Duration timeout, Supplier<T> action) {
        boolean acquired;
        try {
            acquired = lock.tryLock(timeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Aguardar lock global interrompido ({})", contexto);
            return Optional.empty();
        }
        if (!acquired) {
            log.warn("robô global ocupado após {} ({})", timeout, contexto);
            return Optional.empty();
        }
        try {
            return Optional.of(action.get());
        } finally {
            lock.unlock();
        }
    }
}
