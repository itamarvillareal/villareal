package br.com.vilareal.pje.application;

import br.com.vilareal.processo.application.ProcessoDiagnosticoNumeroBuscaUtil;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Último status da cópia integral PJe por CNJ (memória — reinicia com o backend).
 * Usado para polling da UI após disparo assíncrono.
 */
@Component
public class PjeCopiaIntegralStatusStore {

    public enum Fase {
        EM_ANDAMENTO,
        SUCESSO,
        FALHA
    }

    public record Entrada(
            Fase fase,
            String mensagem,
            Instant atualizadoEm,
            String driveFileId,
            String pastaMovimentacoesId) {}

    private final ConcurrentHashMap<String, Entrada> porCnj = new ConcurrentHashMap<>();

    public void marcarEmAndamento(String cnj) {
        String chave = chave(cnj);
        if (chave == null) {
            return;
        }
        porCnj.put(
                chave,
                new Entrada(
                        Fase.EM_ANDAMENTO,
                        "Robô PJe em execução (login, download e upload para pasta Movimentações)…",
                        Instant.now(),
                        null,
                        null));
    }

    public void registrar(PjeCopiaIntegralResult resultado) {
        if (resultado == null || !StringUtils.hasText(resultado.numeroCnj())) {
            return;
        }
        String chave = chave(resultado.numeroCnj());
        if (chave == null) {
            return;
        }
        if (resultado.sucesso()) {
            porCnj.put(
                    chave,
                    new Entrada(
                            Fase.SUCESSO,
                            resultado.mensagem(),
                            Instant.now(),
                            resultado.driveFileId(),
                            resultado.pastaMovimentacoesId()));
        } else {
            porCnj.put(
                    chave,
                    new Entrada(
                            Fase.FALHA,
                            resumirMensagem(resultado.mensagem()),
                            Instant.now(),
                            null,
                            null));
        }
    }

    public void registrarFalha(String cnj, String mensagem) {
        String chave = chave(cnj);
        if (chave == null) {
            return;
        }
        porCnj.put(
                chave,
                new Entrada(Fase.FALHA, resumirMensagem(mensagem), Instant.now(), null, null));
    }

    public Optional<Entrada> consultar(String cnj) {
        String chave = chave(cnj);
        if (chave == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(porCnj.get(chave));
    }

    private static String chave(String cnj) {
        if (!StringUtils.hasText(cnj)) {
            return null;
        }
        String norm = ProcessoDiagnosticoNumeroBuscaUtil.normalizarSomenteDigitos(cnj);
        return norm.length() >= 7 ? norm : cnj.trim().toUpperCase();
    }

    private static String resumirMensagem(String mensagem) {
        if (!StringUtils.hasText(mensagem)) {
            return "Falha na cópia integral PJe.";
        }
        String m = mensagem.trim();
        if (m.contains("Timeout") && m.contains("exceeded")) {
            return "O PJe TRT18 não respondeu a tempo (rede ou proxy). "
                    + "Verifique o proxy Tailscale/SOCKS5 e tente novamente.";
        }
        if (m.contains("navigating to") && m.contains("timeout")) {
            return "Não foi possível abrir o PJe TRT18 (proxy Tailscale ou rede). "
                    + "Verifique se o SOCKS5 na máquina residencial está ativo.";
        }
        if (m.length() > 280) {
            return m.substring(0, 277) + "…";
        }
        return m;
    }
}
