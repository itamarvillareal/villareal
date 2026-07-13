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
 * Atualiza {@code gmail_caixa_ordem} das publicações PROJUDI/TRT conforme a ordem retornada
 * pela API {@code messages.list} do Gmail (fiel à caixa de entrada, excluindo OTP).
 */
@Service
public class GmailCaixaOrdemService {

    private static final Logger log = LoggerFactory.getLogger(GmailCaixaOrdemService.class);

    /** Mesma query combinada da tela Movimentações Email. */
    public static final String QUERY_CAIXA_MOVIMENTACOES =
            "(from:trt18.jus.br OR subject:[TRT18] OR subject:[PROJUDI])";

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

        List<Message> refs = listarMensagens(gmail, QUERY_CAIXA_MOVIMENTACOES);
        int ordem = 0;
        int atualizados = 0;
        for (Message ref : refs) {
            String messageId = ref.getId();
            if (messageId == null || messageId.isBlank()) {
                continue;
            }
            if (!publicacaoRepository.existsByArquivoOrigemNomeContainingAndOrigemImportacaoIn(
                    "[" + messageId + "]", ORIGENS)) {
                continue;
            }
            Message meta =
                    gmail.users().messages().get("me", messageId).setFormat("metadata").execute();
            String assunto = extrairCabecalho(meta, "Subject");
            if (emailIgnoradoNaCaixa(assunto)) {
                continue;
            }
            int n = publicacaoRepository.updateGmailCaixaOrdemForMessage(messageId, ordem, ORIGENS);
            if (n > 0) {
                atualizados += n;
            }
            ordem++;
        }
        log.info(
                "Ordem caixa Gmail atualizada: {} mensagem(ns) na query, {} publicação(ões) com ordem",
                refs.size(),
                atualizados);
        return atualizados;
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

    private List<Message> listarMensagens(Gmail gmail, String query) throws IOException {
        List<Message> out = new ArrayList<>();
        String pageToken = null;
        do {
            ListMessagesResponse resp = gmail.users()
                    .messages()
                    .list("me")
                    .setQ(query)
                    .setIncludeSpamTrash(true)
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
