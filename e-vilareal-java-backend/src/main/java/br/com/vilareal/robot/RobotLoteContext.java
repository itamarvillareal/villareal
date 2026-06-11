package br.com.vilareal.robot;

import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Garante no máximo um login de tribunal por lote (evita OTP/sessão concorrente no mesmo usuário).
 */
@Component
public class RobotLoteContext {

    private final AtomicReference<String> loginAtivoNoLote = new AtomicReference<>();

    public boolean podeIniciarLogin(String login) {
        if (login == null || login.isBlank()) {
            return false;
        }
        String norm = login.trim();
        String atual = loginAtivoNoLote.get();
        return atual == null || atual.equals(norm);
    }

    public boolean reservarLogin(String login) {
        if (login == null || login.isBlank()) {
            return false;
        }
        String norm = login.trim();
        return loginAtivoNoLote.compareAndSet(null, norm)
                || norm.equals(loginAtivoNoLote.get());
    }

    public Optional<String> loginAtivo() {
        return Optional.ofNullable(loginAtivoNoLote.get());
    }

    public void encerrarLote() {
        loginAtivoNoLote.set(null);
    }
}
