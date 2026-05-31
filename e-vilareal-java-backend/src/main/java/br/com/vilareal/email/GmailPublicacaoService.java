package br.com.vilareal.email;

import br.com.vilareal.publicacao.api.dto.PublicacaoWriteRequest;
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
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class GmailPublicacaoService {

    private static final Logger log = LoggerFactory.getLogger(GmailPublicacaoService.class);
    private static final String QUERY_BASE = "from:publicacoes-diarios@jusbrasil.com.br";

    private final Gmail gmail;
    private final PublicacaoEmailImportacaoTransacionalService importacaoTransacional;
    private final PublicacaoRepository publicacaoRepository;
    private final EmailImportacaoSyncService syncService;
    private final String gmailUser;

    public GmailPublicacaoService(
            @Autowired(required = false) Gmail gmail,
            PublicacaoEmailImportacaoTransacionalService importacaoTransacional,
            PublicacaoRepository publicacaoRepository,
            EmailImportacaoSyncService syncService,
            @Value("${gmail.user:me}") String gmailUser) {
        this.gmail = gmail;
        this.importacaoTransacional = importacaoTransacional;
        this.publicacaoRepository = publicacaoRepository;
        this.syncService = syncService;
        this.gmailUser = gmailUser;
    }

    public boolean isDisponivel() {
        return gmail != null;
    }

    public PublicacaoEmailProcessamentoResumo buscarEProcessarPublicacoes() throws IOException {
        Instant desde = syncService.obterCursorParaBuscaIncremental(EmailImportacaoSyncTipo.JUSBRASIL);
        String query = EmailImportacaoSyncService.montarQueryIncremental(QUERY_BASE, desde);
        return buscarEProcessar(query, false, true, true);
    }

    public PublicacaoEmailProcessamentoResumo buscarEProcessarPublicacoesManual(boolean forcarAtualizacaoCompleta)
            throws IOException {
        if (forcarAtualizacaoCompleta) {
            String query = EmailImportacaoSyncService.montarQueryCaixaCompleta(QUERY_BASE);
            return buscarEProcessar(query, true, true, false);
        }
        Instant desde = syncService.obterCursorParaBuscaIncremental(EmailImportacaoSyncTipo.JUSBRASIL);
        String query = EmailImportacaoSyncService.montarQueryIncremental(QUERY_BASE, desde);
        return buscarEProcessar(query, false, true, true);
    }

    private PublicacaoEmailProcessamentoResumo buscarEProcessar(
            String query,
            boolean reprocessarEmailsExistentes,
            boolean atualizarCursor,
            boolean sincronizacaoIncremental)
            throws IOException {
        PublicacaoEmailProcessamentoResumo resumo = new PublicacaoEmailProcessamentoResumo();
        if (gmail == null) {
            resumo.getErros().add("Gmail API não configurada.");
            return resumo;
        }

        Instant cursorAnterior =
                syncService.obterUltimaSincronizacao(EmailImportacaoSyncTipo.JUSBRASIL).orElse(null);
        resumo.setUltimaSincronizacaoAnterior(cursorAnterior);
        resumo.setForcarAtualizacao(!sincronizacaoIncremental);
        resumo.setSincronizacaoIncremental(sincronizacaoIncremental);
        resumo.setQueryGmail(query);

        log.info(
                "Iniciando busca de publicações Jusbrasil no Gmail (query={}, reprocessar={}, incremental={})",
                query,
                reprocessarEmailsExistentes,
                sincronizacaoIncremental);
        List<Message> mensagens = listarMensagens(query);
        log.info("Emails Jusbrasil encontrados: {}", mensagens.size());

        Set<String> processosUnicosLote = new LinkedHashSet<>();
        Instant emailMaisRecente = cursorAnterior;

        for (Message ref : mensagens) {
            String messageId = ref.getId();
            boolean jaImportado = emailJaImportado(messageId);

            if (!reprocessarEmailsExistentes && jaImportado) {
                log.debug("Email {} já importado anteriormente; ignorado.", messageId);
                continue;
            }

            if (reprocessarEmailsExistentes && jaImportado) {
                int removidos = importacaoTransacional.removerPublicacoesDoEmail(messageId);
                log.info(
                        "Reprocessamento email {}: removidas {} publicação(ões) anteriores antes de nova extração",
                        messageId,
                        removidos);
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
                Instant emailRecebidoEm = extrairDataRecebimentoEmail(completa);
                emailMaisRecente = maisRecente(emailMaisRecente, emailRecebidoEm);

                log.info(
                        "Extraindo publicações do email messageId={} assunto={} arquivoOrigem={}",
                        messageId,
                        assunto,
                        arquivoOrigem);

                List<PublicacaoWriteRequest> publicacoes =
                        PublicacaoTextoImportacaoParser.parseHtmlJusbrasil(html, arquivoOrigem);
                for (PublicacaoWriteRequest req : publicacoes) {
                    req.setEmailRecebidoEm(emailRecebidoEm);
                }

                Set<String> principaisEmail = publicacoes.stream()
                        .map(PublicacaoWriteRequest::getNumeroProcessoEncontrado)
                        .filter(n -> n != null && !n.isBlank())
                        .map(String::trim)
                        .map(String::toUpperCase)
                        .collect(Collectors.toCollection(LinkedHashSet::new));

                resumo.setPublicacoesEncontradas(resumo.getPublicacoesEncontradas() + publicacoes.size());
                processosUnicosLote.addAll(principaisEmail);

                log.info(
                        "Email {} (assunto={}): publicacoesExtraidas={}, processosUnicosNoEmail={}, processos={}",
                        messageId,
                        assunto,
                        publicacoes.size(),
                        principaisEmail.size(),
                        principaisEmail);

                int gravadas = 0;
                int vinculosAutomaticos = 0;
                int duplicadas = 0;
                for (PublicacaoWriteRequest req : publicacoes) {
                    try {
                        Long pubId = importacaoTransacional.criarPublicacaoEmail(req);
                        if (pubId == null) {
                            duplicadas++;
                            log.info(
                                    "Publicação duplicada ignorada (email {} processo {})",
                                    messageId,
                                    req.getNumeroProcessoEncontrado());
                            continue;
                        }
                        gravadas++;
                        resumo.setPublicacoesProcessadas(resumo.getPublicacoesProcessadas() + 1);
                        if (importacaoTransacional.tentarVinculoAutomaticoPorCnj(pubId)) {
                            vinculosAutomaticos++;
                        }
                    } catch (Exception ex) {
                        String msg = mensagemRaiz(ex);
                        resumo.getErros().add(
                                "Falha ao gravar publicação "
                                        + req.getNumeroProcessoEncontrado()
                                        + " (email "
                                        + messageId
                                        + "): "
                                        + msg);
                        log.error(
                                "Falha ao gravar publicação email {} processo {}: {}",
                                messageId,
                                req.getNumeroProcessoEncontrado(),
                                msg,
                                ex);
                    }
                }
                resumo.setPublicacoesDuplicadasIgnoradas(
                        resumo.getPublicacoesDuplicadasIgnoradas() + duplicadas);
                resumo.setVinculosAutomaticos(resumo.getVinculosAutomaticos() + vinculosAutomaticos);

                marcarComoLido(messageId);
                resumo.setEmailsLidos(resumo.getEmailsLidos() + 1);
                log.info(
                        "Email {} processado: gravadas={}, vinculosAutomaticosPorCnj={}, duplicadasIgnoradas={}, marcado como lido",
                        messageId,
                        gravadas,
                        vinculosAutomaticos,
                        duplicadas);
            } catch (Exception ex) {
                String msg = "Falha no email " + messageId + ": " + mensagemRaiz(ex);
                log.error(msg, ex);
                resumo.getErros().add(msg);
            }
        }

        resumo.setProcessosUnicos(processosUnicosLote.size());

        if (atualizarCursor) {
            Instant cursorGravar = emailMaisRecente != null ? emailMaisRecente : Instant.now();
            if (!mensagens.isEmpty()
                    && (cursorAnterior == null || !cursorGravar.isAfter(cursorAnterior))) {
                cursorGravar = Instant.now();
            }
            Instant gravado = syncService.registrarSincronizacao(EmailImportacaoSyncTipo.JUSBRASIL, cursorGravar);
            resumo.setUltimaSincronizacaoGravada(gravado);
        }

        log.info(
                "Busca Gmail concluída: emailsLidos={}, publicacoesEncontradas={}, processosUnicos={}, publicacoesProcessadas={}, duplicadasIgnoradas={}, erros={}, cursorGravado={}",
                resumo.getEmailsLidos(),
                resumo.getPublicacoesEncontradas(),
                resumo.getProcessosUnicos(),
                resumo.getPublicacoesProcessadas(),
                resumo.getPublicacoesDuplicadasIgnoradas(),
                resumo.getErros().size(),
                resumo.getUltimaSincronizacaoGravada());
        return resumo;
    }

    private static Instant maisRecente(Instant atual, Instant candidato) {
        if (candidato == null) {
            return atual;
        }
        if (atual == null || candidato.isAfter(atual)) {
            return candidato;
        }
        return atual;
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
                    .setIncludeSpamTrash(true)
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

    private static Instant extrairDataRecebimentoEmail(Message message) {
        Long ms = message.getInternalDate();
        if (ms == null || ms <= 0L) {
            return null;
        }
        return Instant.ofEpochMilli(ms);
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

    private static String mensagemRaiz(Throwable ex) {
        Throwable t = ex;
        String last = t.getMessage() != null ? t.getMessage() : t.getClass().getSimpleName();
        while (t.getCause() != null && t.getCause() != t) {
            t = t.getCause();
            if (t.getMessage() != null && !t.getMessage().isBlank()) {
                last = t.getMessage();
            }
        }
        return last;
    }
}
