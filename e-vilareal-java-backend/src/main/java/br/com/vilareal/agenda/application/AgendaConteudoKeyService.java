package br.com.vilareal.agenda.application;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import org.springframework.util.StringUtils;

import java.time.LocalDate;

/**
 * Ponto único para calcular {@code conteudo_key} — usado pelo serviço, pela migration V85 e testes.
 * Sempre aplica {@link Utf8MojibakeUtil#corrigir} antes da normalização (igual {@code aplicarCampos}).
 */
public final class AgendaConteudoKeyService {

    private AgendaConteudoKeyService() {}

    public static String calcular(
            Long usuarioId,
            LocalDate dataEvento,
            String horaEventoRaw,
            String descricaoRaw,
            String statusCurtoRaw) {
        if (usuarioId == null || dataEvento == null) {
            return null;
        }
        String desc = Utf8MojibakeUtil.corrigir(descricaoRaw);
        if (!StringUtils.hasText(desc)) {
            desc = "Compromisso";
        } else {
            desc = desc.trim();
        }
        String hora = trimToNull(Utf8MojibakeUtil.corrigir(horaEventoRaw));
        String status = Utf8MojibakeUtil.corrigir(statusCurtoRaw);
        return AgendaEventoConteudoKeyUtil.gerar(usuarioId, dataEvento, hora, desc, status);
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
