package br.com.vilareal.email;

import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.model.ListThreadsResponse;
import com.google.api.services.gmail.model.Message;
import com.google.api.services.gmail.model.Thread;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Atualiza {@code gmail_caixa_ordem} e {@code email_recebido_em} percorrendo threads da inbox
 * ({@code threads.list in:inbox}) — mesma ordem da visualização por conversa do Gmail (print
 * 21:14 → 20:53 → 20:30).
 */
@Service
public class GmailCaixaOrdemService {

    private static final Logger log = LoggerFactory.getLogger(GmailCaixaOrdemService.class);
    private static final ZoneId FUSO_BR = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter HORA_BR = DateTimeFormatter.ofPattern("dd/MM HH:mm", Locale.ROOT);

    public static final String QUERY_INBOX = "in:inbox";

    private static final Set<String> ORIGENS = Set.of("PROJUDI", "TRT");
    private static final int LIMITE_THREADS = 500;
    private static final long INTERVALO_MIN_MS = 45_000L;

    private final GmailApiProvider gmailApiProvider;
    private final PublicacaoRepository publicacaoRepository;

    private volatile long ultimaAtualizacaoOrdemMs = 0L;

    public GmailCaixaOrdemService(
            GmailApiProvider gmailApiProvider, PublicacaoRepository publicacaoRepository) {
        this.gmailApiProvider = gmailApiProvider;
        this.publicacaoRepository = publicacaoRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int atualizarOrdemCaixaInbox() throws IOException {
        long agora = System.currentTimeMillis();
        if (agora - ultimaAtualizacaoOrdemMs < INTERVALO_MIN_MS) {
            log.debug("Ordem caixa Gmail: atualização ignorada (intervalo mínimo).");
            return 0;
        }

        Gmail gmail = gmailApiProvider.resolver().orElse(null);
        if (gmail == null) {
            log.warn("Gmail indisponível — ordem da caixa não atualizada.");
            return 0;
        }

        List<Thread> refs = listarThreadsInbox(gmail);
        int ordem = 0;
        int atualizados = 0;
        List<String> topoLog = new ArrayList<>();
        for (Thread ref : refs) {
            String threadId = ref.getId();
            if (threadId == null || threadId.isBlank()) {
                continue;
            }
            Thread thread = gmail.users()
                    .threads()
                    .get("me", threadId)
                    .setFormat("metadata")
                    .setMetadataHeaders(List.of("Subject", "From"))
                    .execute();
            if (thread.getMessages() == null || thread.getMessages().isEmpty()) {
                continue;
            }
            Message representante = mensagemRepresentanteThread(thread);
            if (representante == null) {
                continue;
            }
            String assunto = extrairCabecalho(representante, "Subject");
            String from = extrairCabecalho(representante, "From");
            if (!ehNotificacaoMovimentacao(assunto, from)) {
                continue;
            }
            if (emailIgnoradoNaCaixa(assunto)) {
                continue;
            }
            Instant inboxEm = GmailEmailRecebimentoUtil.extrairDataRecebimento(representante);
            boolean gravouNaThread = false;
            for (Message msg : thread.getMessages()) {
                String messageId = msg.getId();
                if (messageId == null || messageId.isBlank()) {
                    continue;
                }
                if (!publicacaoRepository.existsByArquivoOrigemNomeContainingAndOrigemImportacaoIn(
                        "[" + messageId + "]", ORIGENS)) {
                    continue;
                }
                Instant msgEm = GmailEmailRecebimentoUtil.extrairDataRecebimento(msg);
                Instant entrada = msgEm != null ? msgEm : inboxEm;
                int n = entrada != null
                        ? publicacaoRepository.updateGmailCaixaOrdemAndEmailRecebidoForMessage(
                                messageId, ordem, entrada, ORIGENS)
                        : publicacaoRepository.updateGmailCaixaOrdemForMessage(messageId, ordem, ORIGENS);
                if (n > 0) {
                    atualizados += n;
                    gravouNaThread = true;
                }
            }
            if (gravouNaThread && topoLog.size() < 12) {
                String hora = inboxEm != null
                        ? HORA_BR.format(inboxEm.atZone(FUSO_BR))
                        : "?";
                topoLog.add(ordem + ":" + hora + " " + resumirAssunto(assunto));
            }
            ordem++;
        }
        ultimaAtualizacaoOrdemMs = agora;
        log.info(
                "Ordem caixa Gmail (threads in:inbox): {} thread(s), {} publicação(ões) atualizada(s). Topo: {}",
                refs.size(),
                atualizados,
                topoLog);
        return atualizados;
    }

    /** Mensagem mais recente da thread — horário exibido pelo Gmail na inbox. */
    static Message mensagemRepresentanteThread(Thread thread) {
        if (thread == null || thread.getMessages() == null) {
            return null;
        }
        return thread.getMessages().stream()
                .max(Comparator.comparing(
                        GmailEmailRecebimentoUtil::extrairDataRecebimento,
                        Comparator.nullsFirst(Comparator.naturalOrder())))
                .orElse(null);
    }

    static boolean ehNotificacaoMovimentacao(String assunto, String from) {
        String a = assunto == null ? "" : assunto.toLowerCase(Locale.ROOT);
        String f = from == null ? "" : from.toLowerCase(Locale.ROOT);
        if (a.contains("[projudi]")) {
            return true;
        }
        return f.contains("trt18.jus.br")
                || a.contains("[trt18]")
                || f.contains("processo judicial");
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

    private List<Thread> listarThreadsInbox(Gmail gmail) throws IOException {
        List<Thread> out = new ArrayList<>();
        String pageToken = null;
        do {
            ListThreadsResponse resp = gmail.users()
                    .threads()
                    .list("me")
                    .setQ(QUERY_INBOX)
                    .setMaxResults(100L)
                    .setPageToken(pageToken)
                    .execute();
            if (resp.getThreads() != null) {
                out.addAll(resp.getThreads());
            }
            pageToken = resp.getNextPageToken();
        } while (pageToken != null && out.size() < LIMITE_THREADS);
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
