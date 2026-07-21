package br.com.vilareal.pje.application;

import br.com.vilareal.notificacao.application.NotificacaoEmailService;
import br.com.vilareal.pje.config.PjeBrowserProperties;
import br.com.vilareal.pje.config.PjeCopiaIntegralFalhaEmailProperties;
import br.com.vilareal.pje.domain.PjeGrau;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Avisa o escritório quando a cópia integral PJe TRT18 falha após todas as retentativas.
 */
@Service
public class PjeCopiaIntegralFalhaEmailService {

    private static final Logger log = LoggerFactory.getLogger(PjeCopiaIntegralFalhaEmailService.class);
    private static final ZoneId FUSO_ESCRITORIO = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter DATA_HORA_BR =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", Locale.forLanguageTag("pt-BR"));

    private final NotificacaoEmailService notificacaoEmailService;
    private final PjeCopiaIntegralFalhaEmailProperties properties;
    private final PjeBrowserProperties browserProperties;

    public PjeCopiaIntegralFalhaEmailService(
            NotificacaoEmailService notificacaoEmailService,
            PjeCopiaIntegralFalhaEmailProperties properties,
            PjeBrowserProperties browserProperties) {
        this.notificacaoEmailService = notificacaoEmailService;
        this.properties = properties;
        this.browserProperties = browserProperties;
    }

    public void notificarFalhaDefinitiva(
            String numeroCnj, PjeGrau grau, String mensagemErro, int tentativasExecutadas) {
        if (!podeEnviar()) {
            return;
        }
        String cnj = StringUtils.hasText(numeroCnj) ? numeroCnj.trim() : "—";
        String grauTxt = grau != null ? grau.name() : "—";
        String erro = PjeCopiaIntegralRetrySupport.resumirParaEmail(mensagemErro);
        String proxy = PjeCopiaIntegralRetrySupport.rotuloProxy(browserProperties);
        String horario = DATA_HORA_BR.format(java.time.Instant.now().atZone(FUSO_ESCRITORIO));

        String assunto = montarAssunto(cnj);
        String corpo = """
                <p>O robô PJe TRT18 <strong>não conseguiu baixar a cópia integral</strong> após \
                <strong>%d</strong> tentativa(s).</p>
                <ul>
                  <li><strong>CNJ:</strong> %s</li>
                  <li><strong>Grau:</strong> %s</li>
                  <li><strong>Proxy:</strong> %s</li>
                  <li><strong>Horário:</strong> %s</li>
                </ul>
                <p><strong>Erro:</strong> %s</p>
                <p>Investigue no servidor (<code>docker logs vilareal-backend</code>) e, se necessário, \
                peça ao Cursor uma análise citando este CNJ e o horário acima.</p>
                """
                .formatted(
                        Math.max(1, tentativasExecutadas),
                        esc(cnj),
                        esc(grauTxt),
                        esc(proxy),
                        esc(horario),
                        esc(erro));

        enviarSilencioso(assunto, corpo);
    }

    private boolean podeEnviar() {
        if (!properties.isAtivo()) {
            return false;
        }
        if (properties.getDestinatarios().isEmpty()) {
            log.warn("PJe cópia integral: sem destinatários de e-mail de falha configurados.");
            return false;
        }
        if (!notificacaoEmailService.isDisponivel()) {
            log.warn("PJe cópia integral: Gmail indisponível — e-mail de falha não enviado.");
            return false;
        }
        return true;
    }

    private void enviarSilencioso(String assunto, String corpoHtml) {
        try {
            notificacaoEmailService.enviar(properties.getDestinatarios(), assunto, corpoHtml);
            log.info("E-mail de falha PJe TRT18 enviado — assunto: {}", assunto);
        } catch (Exception e) {
            log.warn("Falha ao enviar e-mail de falha PJe TRT18: {}", e.getMessage());
        }
    }

    private String montarAssunto(String cnj) {
        String prefixo = StringUtils.hasText(properties.getAssuntoPrefixo())
                ? properties.getAssuntoPrefixo().trim()
                : "[PJe TRT18 — falha]";
        String sufixo = cnj.length() > 80 ? cnj.substring(0, 77) + "…" : cnj;
        return prefixo + " " + sufixo;
    }

    private static String esc(String s) {
        if (s == null) {
            return "—";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
