package br.com.vilareal.email;

import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.model.ListMessagesResponse;
import com.google.api.services.gmail.model.Message;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Espelha em {@code gmail_caixa_ordem} a posição de cada MENSAGEM na inbox
 * ({@code messages.list in:inbox}) — a conta usa exibição mensagem-a-mensagem (sem agrupar
 * conversas), então a ordem é por mensagem, não por thread.
 *
 * <p>A cada sincronização a ordem anterior é limpa e regravada em transação única: a tela
 * mostra exatamente as movimentações presentes no topo da inbox, na mesma sequência do Gmail.
 * Chamadas Gmail ficam fora de transação; só a gravação usa transação curta.
 */
@Service
public class GmailCaixaOrdemService {

    private static final Logger log = LoggerFactory.getLogger(GmailCaixaOrdemService.class);

    public static final String QUERY_INBOX = "in:inbox";

    private static final Set<String> ORIGENS = Set.of("PROJUDI", "TRT");
    private static final int LIMITE_MENSAGENS = 500;
    private static final long INTERVALO_MIN_MS = 45_000L;

    /** Sufixo {@code [messageId]} gravado em {@code arquivo_origem_nome} na importação. */
    private static final Pattern RE_GMAIL_MESSAGE_ID = Pattern.compile("\\[([a-f0-9]{10,})\\]\\s*$", Pattern.CASE_INSENSITIVE);

    private final GmailApiProvider gmailApiProvider;
    private final PublicacaoRepository publicacaoRepository;
    private final TransactionTemplate ordemTx;

    private final Object lockAtualizacao = new Object();
    private volatile long ultimaAtualizacaoOrdemMs = 0L;

    public GmailCaixaOrdemService(
            GmailApiProvider gmailApiProvider,
            PublicacaoRepository publicacaoRepository,
            PlatformTransactionManager transactionManager) {
        this.gmailApiProvider = gmailApiProvider;
        this.publicacaoRepository = publicacaoRepository;
        this.ordemTx = new TransactionTemplate(transactionManager);
        this.ordemTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public int atualizarOrdemCaixaInbox() throws IOException {
        synchronized (lockAtualizacao) {
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

            List<Message> inbox = listarMensagensInbox(gmail);
            Map<String, List<Long>> publicacoesPorMessageId = carregarPublicacoesPorMessageId();

            List<AtualizacaoOrdemCaixa> atualizacoes = new ArrayList<>();
            for (int i = 0; i < inbox.size(); i++) {
                String messageId = inbox.get(i).getId();
                if (messageId == null || messageId.isBlank()) {
                    continue;
                }
                List<Long> ids = publicacoesPorMessageId.get(messageId.toLowerCase(Locale.ROOT));
                if (ids == null || ids.isEmpty()) {
                    continue;
                }
                atualizacoes.add(new AtualizacaoOrdemCaixa(ids, i));
            }

            Integer atualizados = ordemTx.execute(status -> {
                publicacaoRepository.clearGmailCaixaOrdem(ORIGENS);
                int n = 0;
                for (AtualizacaoOrdemCaixa u : atualizacoes) {
                    n += publicacaoRepository.updateGmailCaixaOrdemForIds(u.publicacaoIds(), u.ordem());
                }
                return n;
            });

            ultimaAtualizacaoOrdemMs = agora;
            log.info(
                    "Ordem caixa Gmail (messages.list in:inbox): {} mensagem(ns) na inbox, {} com movimentação, {} publicação(ões) atualizada(s).",
                    inbox.size(),
                    atualizacoes.size(),
                    atualizados != null ? atualizados : 0);
            return atualizados != null ? atualizados : 0;
        }
    }

    /** Índice messageId (minúsculo) → ids de publicação PROJUDI/TRT importadas desse email. */
    private Map<String, List<Long>> carregarPublicacoesPorMessageId() {
        Map<String, List<Long>> out = new HashMap<>();
        for (Object[] row : publicacaoRepository.findIdAndArquivoOrigemNomeByOrigemImportacaoIn(ORIGENS)) {
            Long id = ((Number) row[0]).longValue();
            String messageId = extrairGmailMessageId((String) row[1]);
            if (messageId == null) {
                continue;
            }
            out.computeIfAbsent(messageId, k -> new ArrayList<>()).add(id);
        }
        return out;
    }

    static String extrairGmailMessageId(String arquivoOrigemNome) {
        if (arquivoOrigemNome == null || arquivoOrigemNome.isBlank()) {
            return null;
        }
        Matcher m = RE_GMAIL_MESSAGE_ID.matcher(arquivoOrigemNome.trim());
        return m.find() ? m.group(1).toLowerCase(Locale.ROOT) : null;
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

    private record AtualizacaoOrdemCaixa(List<Long> publicacaoIds, int ordem) {}
}
