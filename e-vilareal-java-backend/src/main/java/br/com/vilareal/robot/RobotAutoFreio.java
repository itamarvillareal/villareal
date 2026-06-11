package br.com.vilareal.robot;

import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * Auto-freio: após N erros consecutivos o robô para até {@link #reset()} manual ou sucesso.
 */
@Component
public class RobotAutoFreio {

    private final AtomicInteger errosConsecutivos = new AtomicInteger(0);
    private volatile int limite = 3;

    public void configurarLimite(int limite) {
        this.limite = Math.max(1, limite);
    }

    public boolean estaFreiado() {
        return errosConsecutivos.get() >= limite;
    }

    public void registrarSucesso() {
        errosConsecutivos.set(0);
    }

    public void registrarFalha() {
        errosConsecutivos.incrementAndGet();
    }

    public int errosConsecutivos() {
        return errosConsecutivos.get();
    }

    public void reset() {
        errosConsecutivos.set(0);
    }
}
