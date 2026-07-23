package br.com.vilareal.processo.copiaidle.application;

import br.com.vilareal.notificacao.application.NotificacaoEmailService;
import br.com.vilareal.processo.copiaidle.config.CopiaMovimentacoesClienteIdleProperties;
import br.com.vilareal.processo.copiaidle.infrastructure.persistence.entity.CopiaMovimentacoesClienteCampanhaEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
public class CopiaMovimentacoesClienteIdleEmailService {

    private static final Logger log = LoggerFactory.getLogger(CopiaMovimentacoesClienteIdleEmailService.class);
    private static final DateTimeFormatter DATA_HORA_BR =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", Locale.forLanguageTag("pt-BR"));

    private final NotificacaoEmailService notificacaoEmailService;
    private final CopiaMovimentacoesClienteIdleProperties properties;

    public CopiaMovimentacoesClienteIdleEmailService(
            NotificacaoEmailService notificacaoEmailService,
            CopiaMovimentacoesClienteIdleProperties properties) {
        this.notificacaoEmailService = notificacaoEmailService;
        this.properties = properties;
    }

    /** @return true se enviou (ou já não precisava / config off); false se falhou e deve retentar. */
    public boolean notificarCampanhaConcluida(CopiaMovimentacoesClienteCampanhaEntity campanha) {
        CopiaMovimentacoesClienteIdleProperties.Email emailCfg = properties.getEmail();
        if (!emailCfg.isAtivo()) {
            log.info("Cópia idle: e-mail de conclusão desligado — campanha {} não notificada.", campanha.getId());
            return true;
        }
        if (emailCfg.getDestinatarios() == null || emailCfg.getDestinatarios().isEmpty()) {
            log.warn("Cópia idle: sem destinatários configurados — e-mail não enviado.");
            return false;
        }
        if (!notificacaoEmailService.isDisponivel()) {
            log.warn("Cópia idle: Gmail indisponível — e-mail de conclusão não enviado.");
            return false;
        }

        String codigo = campanha.getCodigoCliente() != null ? campanha.getCodigoCliente().trim() : "?";
        String prefixo = StringUtils.hasText(emailCfg.getAssuntoPrefixo())
                ? emailCfg.getAssuntoPrefixo().trim()
                : "[Cópia movimentações]";
        String assunto = prefixo + " Cliente " + codigo + " — cópia consolidada concluída";

        ZoneId zone = ZoneId.of(
                StringUtils.hasText(properties.getZone()) ? properties.getZone() : "America/Sao_Paulo");
        String concluida = campanha.getConcluidaEm() != null
                ? DATA_HORA_BR.format(campanha.getConcluidaEm().atZone(zone))
                : DATA_HORA_BR.format(java.time.ZonedDateTime.now(zone));

        String corpo = """
                <p>A campanha idle de <strong>obter movimentações</strong> do cliente \
                <strong>%s</strong> terminou.</p>
                <ul>
                  <li><strong>Total de processos:</strong> %d</li>
                  <li><strong>Completos:</strong> %d</li>
                  <li><strong>Ignorados</strong> (sem sistema/CNJ/automação): %d</li>
                  <li><strong>Erros permanentes:</strong> %d</li>
                  <li><strong>Concluída em:</strong> %s</li>
                </ul>
                <p>Os PDFs individuais e o consolidado (quando aplicável) estão na pasta do processo no Drive. \
                Você já pode analisar com IA quais merecem novo protocolo.</p>
                """
                .formatted(
                        esc(codigo),
                        n(campanha.getTotalProcessos()),
                        n(campanha.getCompletos()),
                        n(campanha.getIgnorados()),
                        n(campanha.getErros()),
                        esc(concluida));

        try {
            notificacaoEmailService.enviar(emailCfg.getDestinatarios(), assunto, corpo);
            log.info("Cópia idle: e-mail de conclusão enviado (cliente={}).", codigo);
            return true;
        } catch (Exception e) {
            log.warn("Cópia idle: falha ao enviar e-mail de conclusão: {}", e.getMessage());
            return false;
        }
    }

    private static int n(Integer v) {
        return v != null ? v : 0;
    }

    private static String esc(String s) {
        if (s == null) {
            return "—";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
