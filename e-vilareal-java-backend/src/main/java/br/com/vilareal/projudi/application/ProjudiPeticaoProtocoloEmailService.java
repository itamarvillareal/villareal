package br.com.vilareal.projudi.application;

import br.com.vilareal.notificacao.application.NotificacaoEmailService;
import br.com.vilareal.projudi.config.ProjudiProtocoloEmailProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * E-mails de resultado do protocolo PROJUDI agendado (sucesso ou erro) para a lista do escritório.
 */
@Service
public class ProjudiPeticaoProtocoloEmailService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiPeticaoProtocoloEmailService.class);
    private static final ZoneId FUSO_ESCRITORIO = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter DATA_HORA_BR =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", Locale.forLanguageTag("pt-BR"));

    private final NotificacaoEmailService notificacaoEmailService;
    private final ProjudiProtocoloEmailProperties properties;
    private final ProjudiProtocoloEmailConfigService configService;

    public ProjudiPeticaoProtocoloEmailService(
            NotificacaoEmailService notificacaoEmailService,
            ProjudiProtocoloEmailProperties properties,
            ProjudiProtocoloEmailConfigService configService) {
        this.notificacaoEmailService = notificacaoEmailService;
        this.properties = properties;
        this.configService = configService;
    }

    public void notificarSucessoProtocolo(String numeroProcesso, List<Long> peticaoIds, String mensagem) {
        notificarFimProtocolo(numeroProcesso, peticaoIds, true, mensagem);
    }

    public void notificarErroProtocolo(String numeroProcesso, List<Long> peticaoIds, String mensagem) {
        notificarFimProtocolo(numeroProcesso, peticaoIds, false, mensagem);
    }

    public void notificarFimProtocolo(
            String numeroProcesso, List<Long> peticaoIds, boolean sucesso, String mensagem) {
        if (!podeEnviar()) {
            return;
        }
        String ids = peticaoIds != null ? peticaoIds.toString() : "—";
        String rotulo = sucesso ? "concluído com sucesso" : "finalizado com erro";
        String assunto = montarAssunto((sucesso ? "OK — " : "Erro — ") + sanitizar(numeroProcesso));
        String corpo = """
                <p>O protocolo PROJUDI foi <strong>%s</strong>.</p>
                <ul>
                  <li><strong>Processo:</strong> %s</li>
                  <li><strong>Petições:</strong> %s</li>
                  <li><strong>Horário:</strong> %s</li>
                </ul>
                <p><strong>Detalhe:</strong> %s</p>
                """
                .formatted(
                        rotulo,
                        esc(numeroProcesso),
                        esc(ids),
                        DATA_HORA_BR.format(java.time.Instant.now().atZone(FUSO_ESCRITORIO)),
                        esc(mensagem));
        enviarSilencioso(assunto, corpo, sucesso);
    }

    private boolean podeEnviar() {
        if (!properties.isAtivo()) {
            return false;
        }
        if (configService.getDestinatariosEfetivos().isEmpty()) {
            log.warn("Protocolo PROJUDI: sem destinatários de e-mail configurados.");
            return false;
        }
        if (!notificacaoEmailService.isDisponivel()) {
            log.warn("Protocolo PROJUDI: Gmail indisponível — e-mail não enviado.");
            return false;
        }
        return true;
    }

    private void enviarSilencioso(String assunto, String corpoHtml, boolean sucesso) {
        try {
            notificacaoEmailService.enviar(configService.getDestinatariosEfetivos(), assunto, corpoHtml);
            log.info(
                    "E-mail de protocolo PROJUDI enviado ({}) — assunto: {}",
                    sucesso ? "sucesso" : "erro",
                    assunto);
        } catch (Exception e) {
            log.warn("Falha ao enviar e-mail de protocolo PROJUDI ({}): {}", sucesso ? "sucesso" : "erro", e.getMessage());
        }
    }

    private String montarAssunto(String sufixo) {
        String prefixo = StringUtils.hasText(properties.getAssuntoPrefixo())
                ? properties.getAssuntoPrefixo().trim()
                : "[Protocolo PROJUDI]";
        return prefixo + " " + sufixo;
    }

    private static String esc(String s) {
        if (s == null) {
            return "—";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String sanitizar(String numeroProcesso) {
        if (!StringUtils.hasText(numeroProcesso)) {
            return "processo";
        }
        String t = numeroProcesso.trim();
        return t.length() > 80 ? t.substring(0, 77) + "..." : t;
    }
}
