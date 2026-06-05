package br.com.vilareal.email;

import com.google.api.services.gmail.Gmail;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Resolve o cliente Gmail registrado em {@link br.com.vilareal.config.GmailConfig}.
 *
 * <p>O bean {@code gmail} é criado em {@code @PostConstruct} (após o contexto subir),
 * não via injeção no construtor. Serviços que precisam do Gmail no caminho crítico
 * devem resolver aqui no momento do uso — nunca cachear {@code Gmail} no construtor.</p>
 */
@Component
public class GmailApiProvider {

    public static final String BEAN_NAME = "gmail";

    private final ApplicationContext applicationContext;

    public GmailApiProvider(ApplicationContext applicationContext) {
        this.applicationContext = applicationContext;
    }

    /** {@code true} quando {@link GmailConfig} registrou o singleton com sucesso. */
    public boolean isDisponivel() {
        return applicationContext.containsBean(BEAN_NAME);
    }

    /** Lookup no momento da chamada; vazio se credenciais/tokens ausentes ou falha na criação. */
    public Optional<Gmail> resolver() {
        if (!isDisponivel()) {
            return Optional.empty();
        }
        return Optional.of(applicationContext.getBean(BEAN_NAME, Gmail.class));
    }
}
