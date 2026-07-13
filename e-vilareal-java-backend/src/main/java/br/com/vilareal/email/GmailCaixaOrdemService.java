package br.com.vilareal.email;

import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.model.ListMessagesResponse;
import com.google.api.services.gmail.model.Message;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Atualiza {@code gmail_caixa_ordem} das publicações PROJUDI/TRT percorrendo a caixa de entrada
 * do Gmail ({@code in:inbox}) de cima para baixo — mesma ordem visual da inbox, ignorando outros
 * e-mails e OTP Projudi.
 */
@Service
public class GmailCaixaOrdemService {

    private static final Logger log = LoggerFactory.getLogger(GmailCaixaOrdemService.class);

    /** Inbox completa (ordem visual), não busca filtrada. */
    public static final String QUERY_INBOX = "in:inbox";

    private static final Set<String> ORIGENS = Set.of("PROJUDI", "TRT");
    private static final int LIMITE_MENSAGENS = 2000;

    private final GmailApiProvider gmailApiProvider;
    private final PublicacaoRepository publicacaoRepository;

    public GmailCaixaOrdemService(
            GmailApiProvider gmailApiProvider, PublicacaoRepository publicacaoRepository) {
        this.gmailApiProvider = gmailApiProvider;
        this.publicacaoRepository = publicacaoRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int atualizarOrdemCaixaInbox() throws IOException {
        Gmail gmail = gmailApiProvider.resolver().orElse(null);
        if (gmail == null) {
            log.warn("Gmail indisponível — ordem da caixa não atualizada.");
            return 0;
        }

        List<Message> refs = listarMensagensInbox(gmail);
        int ordem = 0;
        int atualizados = 0;
        List<String> topoLog = new ArrayList<>();
        for (Message ref : refs) {
            String messageId = ref.getId();
            if (messageId == null || messageId.isBlank()) {
                continue;
            }
            Message meta =
                    gmail.users().messages().get("me", messageId).setFormat("metadata").execute();
            String assunto = extrairCabecalho(meta, "Subject");
            String from = extrairCabecalho(meta, "From");
            if (!ehNotificacaoMovimentacao(assunto, from)) {
                continue;
            }
            if (emailIgnoradoNaCaixa(assunto)) {
                continue;
            }
            if (publicacaoRepository.existsByArquivoOrigemNomeContainingAndOrigemImportacaoIn(
                    "[" + messageId + "]", ORIGENS)) {
                int n = publicacaoRepository.updateGmailCaixaOrdemForMessage(messageId, ordem, ORIGENS);
                if (n > 0) {
                    atualizados += n;
                }
                if (topoLog.size() < 8) {
                    topoLog.add(ordem + ":" + messageId + " " + resumirAssunto(assunto));
                }
            }
            ordem++;
        }
        log.info(
                "Ordem caixa Gmail (in:inbox): {} mensagem(ns) na inbox, {} publicação(ões) com ordem. Topo: {}",
                refs.size(),
                atualizados,
                topoLog);
        return atualizados;
    }

    /** Projudi por assunto; TRT por domínio ou marcador no assunto (emails reencaminhados). */
    static boolean ehNotificacaoMovimentacao(String assunto, String from) {
        String a = assunto == null ? "" : assunto.toLowerCase(Locale.ROOT);
        String f = from == null ? "" : from.toLowerCase(Locale.ROOT);
        if (a.contains("[projudi]")) {
            return true;
        }
        return f.contains("trt18.jus.br") || a.contains("[trt18]");
    }

    static boolean emailIgnoradoNaCaixa(String assunto) {
        if (assunto == null || assunto.isBlank()) {
            return false;
        }
        String a = assunto.toLowerCase(Locale.ROOT);
        return a.contains("código de verificação")
                || a.contains("codigo de verificacao")
                || (a.contains("[projudi]") && a.contains("segurança"))
                || (a.contains("[projudi]") && a.contains("seguranca"));
    }

    private static String resumirAssunto(String assunto) {
        if (assunto == null) {
            return "";
        }
        String s = assunto.trim();
        return s.length() <= 55 ? s : s.substring(0, 52) + "...";
    }

    private List<Message> listarMensagensInbox(Gmail gmail) throws IOException {
        List<Message> out = new ArrayList<>();
        String pageToken = null;
        do {
            ListMessagesResponse resp = gmail.users()
                    .messages()
                    .list("me")
                    .setQ(QUERY_INBOX)
                    .setMaxResults(100L)
                    .setPageToken(pageToken)
                    .execute();
            if (resp.getMessages() != null) {
                out.addAll(resp.getMessages());
            }
            pageToken = resp.getNextPageToken();
        } while (pageToken != null && out.size() < LIMITE_MENSAGENS);
        return out;
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
}
