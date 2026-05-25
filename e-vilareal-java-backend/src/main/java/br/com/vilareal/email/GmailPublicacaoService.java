package br.com.vilareal.email;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.publicacao.api.dto.PublicacaoWriteRequest;
import br.com.vilareal.publicacao.application.PublicacaoApplicationService;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.model.ListMessagesResponse;
import com.google.api.services.gmail.model.Message;
import com.google.api.services.gmail.model.ModifyMessageRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Service
public class GmailPublicacaoService {

    private static final Logger log = LoggerFactory.getLogger(GmailPublicacaoService.class);
    /** Scheduler automático: só não lidos. */
    private static final String QUERY_NAO_LIDOS = "from:publicacoes-diarios@jusbrasil.com.br is:unread";
    /** Disparo manual (API / botão): últimos 7 dias, inclusive já lidos no Gmail. */
    private static final String QUERY_RECENTES_7D = "from:publicacoes-diarios@jusbrasil.com.br newer_than:7d";

    private final Gmail gmail;
    private final PublicacaoApplicationService publicacaoApplicationService;
    private final PublicacaoRepository publicacaoRepository;
    private final String gmailUser;

    public GmailPublicacaoService(
            @Autowired(required = false) Gmail gmail,
            PublicacaoApplicationService publicacaoApplicationService,
            PublicacaoRepository publicacaoRepository,
            @Value("${gmail.user:me}") String gmailUser) {
        this.gmail = gmail;
        this.publicacaoApplicationService = publicacaoApplicationService;
        this.publicacaoRepository = publicacaoRepository;
        this.gmailUser = gmailUser;
    }

    public boolean isDisponivel() {
        return gmail != null;
    }

    /** Scheduler (a cada 3 h): apenas emails ainda não lidos no Gmail. */
    public PublicacaoEmailProcessamentoResumo buscarEProcessarPublicacoes() throws IOException {
        return buscarEProcessar(QUERY_NAO_LIDOS, false);
    }

    /** API / botão «Buscar Emails Agora»: últimos 7 dias, inclusive lidos; ignora emails já importados. */
    public PublicacaoEmailProcessamentoResumo buscarEProcessarPublicacoesManual() throws IOException {
        return buscarEProcessar(QUERY_RECENTES_7D, true);
    }

    private PublicacaoEmailProcessamentoResumo buscarEProcessar(String query, boolean pularEmailsJaImportados)
            throws IOException {
        PublicacaoEmailProcessamentoResumo resumo = new PublicacaoEmailProcessamentoResumo();
        if (gmail == null) {
            resumo.getErros().add("Gmail API não configurada.");
            return resumo;
        }

        log.info("Iniciando busca de publicações Jusbrasil no Gmail (query={})", query);
        List<Message> mensagens = listarMensagens(query);
        log.info("Emails Jusbrasil encontrados: {}", mensagens.size());

        for (Message ref : mensagens) {
            String messageId = ref.getId();
            if (pularEmailsJaImportados && emailJaImportado(messageId)) {
                log.debug("Email {} já importado anteriormente; ignorado.", messageId);
                continue;
            }
            try {
                Message completa =
                        gmail.users().messages().get(gmailUser, messageId).setFormat("full").execute();
                String assunto = extrairCabecalho(completa, "Subject");
                String html = GmailMimeUtil.extrairHtml(completa.getPayload());
                if (html == null || html.isBlank()) {
                    log.warn("Email {} sem corpo HTML utilizável (assunto={})", messageId, assunto);
                    marcarComoLido(messageId);
                    resumo.setEmailsLidos(resumo.getEmailsLidos() + 1);
                    continue;
                }

                String arquivoOrigem = montarArquivoOrigem(assunto, messageId);
                List<PublicacaoWriteRequest> publicacoes =
                        PublicacaoTextoImportacaoParser.parseHtmlJusbrasil(html, arquivoOrigem);
                log.info(
                        "Processando email {} (assunto={}): {} publicação(ões) extraída(s)",
                        messageId,
                        assunto,
                        publicacoes.size());

                int gravadas = 0;
                for (PublicacaoWriteRequest req : publicacoes) {
                    try {
                        publicacaoApplicationService.criar(req);
                        gravadas++;
                        resumo.setPublicacoesProcessadas(resumo.getPublicacoesProcessadas() + 1);
                    } catch (BusinessRuleException ex) {
                        if (String.valueOf(ex.getMessage()).toLowerCase().contains("duplicad")) {
                            log.debug("Publicação duplicada ignorada (email {}): {}", messageId, ex.getMessage());
                        } else {
                            throw ex;
                        }
                    }
                }

                marcarComoLido(messageId);
                resumo.setEmailsLidos(resumo.getEmailsLidos() + 1);
                log.info(
                        "Email {} processado: {} gravada(s), marcado como lido",
                        messageId,
                        gravadas);
            } catch (Exception ex) {
                String msg = "Falha no email " + messageId + ": " + ex.getMessage();
                log.error(msg, ex);
                resumo.getErros().add(msg);
            }
        }

        log.info(
                "Busca Gmail concluída: emailsLidos={}, publicacoesProcessadas={}, erros={}",
                resumo.getEmailsLidos(),
                resumo.getPublicacoesProcessadas(),
                resumo.getErros().size());
        return resumo;
    }

    private boolean emailJaImportado(String messageId) {
        return publicacaoRepository.existsByArquivoOrigemNomeContaining("[" + messageId + "]");
    }

    private List<Message> listarMensagens(String query) throws IOException {
        List<Message> out = new ArrayList<>();
        String pageToken = null;
        do {
            ListMessagesResponse resp = gmail.users()
                    .messages()
                    .list(gmailUser)
                    .setQ(query)
                    .setMaxResults(50L)
                    .setPageToken(pageToken)
                    .execute();
            if (resp.getMessages() != null) {
                out.addAll(resp.getMessages());
            }
            pageToken = resp.getNextPageToken();
        } while (pageToken != null);
        return out;
    }

    private void marcarComoLido(String messageId) throws IOException {
        ModifyMessageRequest body = new ModifyMessageRequest().setRemoveLabelIds(List.of("UNREAD"));
        gmail.users().messages().modify(gmailUser, messageId, body).execute();
    }

    private static String extrairCabecalho(Message message, String nome) {
        if (message.getPayload() == null || message.getPayload().getHeaders() == null) {
            return "";
        }
        return message.getPayload().getHeaders().stream()
                .filter(h -> nome.equalsIgnoreCase(h.getName()))
                .map(h -> h.getValue() == null ? "" : h.getValue())
                .findFirst()
                .orElse("");
    }

    private static String montarArquivoOrigem(String assunto, String messageId) {
        String a = assunto == null ? "" : assunto.trim();
        if (a.isBlank()) {
            return "gmail-" + messageId + ".html";
        }
        if (a.length() > 200) {
            a = a.substring(0, 200);
        }
        return a + " [" + messageId + "]";
    }
}
