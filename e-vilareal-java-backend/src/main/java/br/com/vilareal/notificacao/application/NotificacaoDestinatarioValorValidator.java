package br.com.vilareal.notificacao.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.util.TelefoneBrasilUtil;
import org.springframework.util.StringUtils;

import java.util.regex.Pattern;

/** Normalização e validação de valores por canal ao persistir destinatários. */
public final class NotificacaoDestinatarioValorValidator {

    private static final Pattern EMAIL =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private NotificacaoDestinatarioValorValidator() {}

    public static String normalizarWhatsapp(String valor) {
        if (!StringUtils.hasText(valor)) {
            throw new BusinessRuleException("Número WhatsApp inválido: vazio");
        }
        return TelefoneBrasilUtil.normalizarParaArmazenamento(valor.trim())
                .map(digits -> "+" + digits)
                .orElseThrow(() -> new BusinessRuleException("Número WhatsApp inválido: " + valor));
    }

    public static String normalizarEmail(String valor) {
        if (!StringUtils.hasText(valor)) {
            throw new BusinessRuleException("E-mail inválido: vazio");
        }
        String email = valor.trim().toLowerCase();
        if (email.length() > 255 || !EMAIL.matcher(email).matches()) {
            throw new BusinessRuleException("E-mail inválido: " + valor);
        }
        return email;
    }
}
