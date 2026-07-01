package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppConfig;
import br.com.vilareal.configuracao.application.SistemaConfigService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Interruptor da resposta automática (Claude) para mensagens inbound do WhatsApp.
 * Valor persistido em {@code sistema_config}; fallback em {@code whatsapp.ia.enabled}.
 */
@Service
public class WhatsAppIAConfigService {

    static final String CHAVE_SISTEMA = "whatsapp.ia.enabled";

    private final SistemaConfigService sistemaConfigService;
    private final WhatsAppConfig whatsAppConfig;

    public WhatsAppIAConfigService(SistemaConfigService sistemaConfigService, WhatsAppConfig whatsAppConfig) {
        this.sistemaConfigService = sistemaConfigService;
        this.whatsAppConfig = whatsAppConfig;
    }

    @Transactional(readOnly = true)
    public boolean isIaHabilitada() {
        return sistemaConfigService
                .obterValor(CHAVE_SISTEMA)
                .map(WhatsAppIAConfigService::parseBoolean)
                .orElse(whatsAppConfig.isIaEnabled());
    }

    @Transactional
    public boolean salvarIaHabilitada(boolean habilitada) {
        sistemaConfigService.salvarValor(CHAVE_SISTEMA, habilitada ? "true" : "false");
        return habilitada;
    }

    private static boolean parseBoolean(String raw) {
        if (!StringUtils.hasText(raw)) {
            return false;
        }
        String v = raw.trim().toLowerCase(java.util.Locale.ROOT);
        return "true".equals(v) || "1".equals(v) || "sim".equals(v) || "yes".equals(v);
    }
}
