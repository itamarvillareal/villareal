package br.com.vilareal.projudi.application;

import br.com.vilareal.configuracao.application.SistemaConfigService;
import br.com.vilareal.notificacao.application.NotificacaoDestinatarioValorValidator;
import br.com.vilareal.projudi.config.ProjudiProtocoloEmailProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class ProjudiProtocoloEmailConfigService {

    static final String CHAVE_DESTINATARIOS = "projudi.protocolo.email.destinatarios";
    static final String FALLBACK_EMAIL = "jr.villareal@gmail.com";

    private final SistemaConfigService sistemaConfigService;
    private final ProjudiProtocoloEmailProperties properties;

    public ProjudiProtocoloEmailConfigService(
            SistemaConfigService sistemaConfigService, ProjudiProtocoloEmailProperties properties) {
        this.sistemaConfigService = sistemaConfigService;
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public List<String> getDestinatariosEfetivos() {
        return parseListaEmails(
                sistemaConfigService
                        .obterValor(CHAVE_DESTINATARIOS)
                        .filter(StringUtils::hasText)
                        .orElseGet(this::valorPadraoPropertiesOuFallback));
    }

    @Transactional(readOnly = true)
    public List<String> getDestinatariosConfigurados() {
        return parseListaEmails(
                sistemaConfigService
                        .obterValor(CHAVE_DESTINATARIOS)
                        .filter(StringUtils::hasText)
                        .orElseGet(this::valorPadraoPropertiesOuFallback));
    }

    @Transactional
    public List<String> salvarDestinatarios(List<String> emails) {
        List<String> normalizados = normalizarLista(emails);
        if (normalizados.isEmpty()) {
            throw new IllegalArgumentException("Informe ao menos um e-mail de destino.");
        }
        sistemaConfigService.salvarValor(CHAVE_DESTINATARIOS, String.join(",", normalizados));
        return normalizados;
    }

    private String valorPadraoPropertiesOuFallback() {
        List<String> props = properties.getDestinatarios();
        if (props != null && !props.isEmpty()) {
            return String.join(",", props);
        }
        return FALLBACK_EMAIL;
    }

    static List<String> parseListaEmails(String bruto) {
        if (!StringUtils.hasText(bruto)) {
            return List.of();
        }
        Set<String> vistos = new LinkedHashSet<>();
        for (String parte : bruto.split("[,;\\n]")) {
            if (!StringUtils.hasText(parte)) {
                continue;
            }
            try {
                String norm = NotificacaoDestinatarioValorValidator.normalizarEmail(parte.trim());
                if (StringUtils.hasText(norm)) {
                    vistos.add(norm);
                }
            } catch (RuntimeException ignored) {
                // ignora segmentos inválidos ao ler config legada
            }
        }
        return List.copyOf(vistos);
    }

    static List<String> normalizarLista(List<String> emails) {
        if (emails == null || emails.isEmpty()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        Set<String> vistos = new LinkedHashSet<>();
        for (String email : emails) {
            if (!StringUtils.hasText(email)) {
                continue;
            }
            String norm = NotificacaoDestinatarioValorValidator.normalizarEmail(email.trim());
            if (!StringUtils.hasText(norm)) {
                throw new IllegalArgumentException("E-mail inválido: " + email);
            }
            String chave = norm.toLowerCase(java.util.Locale.ROOT);
            if (vistos.add(chave)) {
                out.add(norm);
            }
        }
        return out;
    }
}
