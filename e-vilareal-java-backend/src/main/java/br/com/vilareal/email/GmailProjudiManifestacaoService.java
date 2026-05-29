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
public class GmailProjudiManifestacaoService {

    private static final Logger log = LoggerFactory.getLogger(GmailProjudiManifestacaoService.class);

    private static final String REMETENTE = "sistema-projudi@tjgo.jus.br";

    private final Gmail gmail;
    private final PublicacaoEmailImportacaoTransacionalService importacaoTransacional;
    private final PublicacaoRepository publicacaoRepository;
    private final EmailImportacaoSyncService syncService;
    private final String gmailUser;

    public GmailProjudiManifestacaoService(
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

    public PublicacaoEmailProcessamentoResumo buscarEProcessarManifestacoes() throws IOException {
        Instant desde = syncService.obterCursorParaBuscaIncremental(EmailImportacaoSyncTipo.PROJUDI);
        String query = EmailImportacaoSyncService.montarQueryIncremental(REMETENTE, desde);
        return buscarEProcessar(query, false, true, true);
    }

    public PublicacaoEmailProcessamentoResumo buscarEProcessarManifestacoesManual(boolean forcarAtualizacaoCompleta)
            throws IOException {
        if (forcarAtualizacaoCompleta) {
            String query = EmailImportacaoSyncService.montarQueryCaixaCompleta(REMETENTE);
            return buscarEProcessar(query, true, true, false);
        }
        Instant desde = syncService.obterCursorParaBuscaIncremental(EmailImportacaoSyncTipo.PROJUDI);
        String query = EmailImportacaoSyncService.montarQueryIncremental(REMETENTE, desde);
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
                syncService.obterUltimaSincronizacao(EmailImportacaoSyncTipo.PROJUDI).orElse(null);
        resumo.setUltimaSincronizacaoAnterior(cursorAnterior);
        resumo.setForcarAtualizacao(!sincronizacaoIncremental);
        resumo.setSincronizacaoIncremental(sincronizacaoIncremental);
        resumo.setQueryGmail(query);

        log.info(
                "Iniciando busca de manifestações Projudi no Gmail (query={}, reprocessar={}, incremental={})",
                query,
                reprocessarEmailsExistentes,
                sincronizacaoIncremental);
        List<Message> mensagens = listarMensagens(query);
        log.info("Emails Projudi encontrados: {}", mensagens.size());

        Set<String> processosUnicosLote = new LinkedHashSet<>();
        Instant emailMaisRecente = cursorAnterior;

        for (Message ref : mensagens) {
            String messageId = ref.getId();
            boolean jaImportado = emailJaImportado(messageId);

            if (!reprocessarEmailsExistentes && jaImportado) {
                continue;
            }

            if (reprocessarEmailsExistentes && jaImportado) {
                int removidos = importacaoTransacional.removerPublicacoesDoEmail(messageId);
                log.info(
                        "Reprocessamento email Projudi {}: removidas {} manifestação(ões) anteriores",
                        messageId,
                        removidos);
            }

            try {
                Message completa =
                        gmail.users().messages().get(gmailUser, messageId).setFormat("full").execute();
                String assunto = extrairCabecalho(completa, "Subject");
                String conteudoEmail = GmailMimeUtil.extrairConteudoTextoCompleto(completa.getPayload());
                if (conteudoEmail.isBlank()) {
                    log.warn("Email Projudi {} sem corpo utilizável (assunto={})", messageId, assunto);
                    marcarComoLido(messageId);
                    resumo.setEmailsLidos(resumo.getEmailsLidos() + 1);
                    continue;
                }

                String arquivoOrigem = montarArquivoOrigem(assunto, messageId);
                Instant emailRecebidoEm = extrairDataRecebimentoEmail(completa);
                emailMaisRecente = maisRecente(emailMaisRecente, emailRecebidoEm);

                String snippet = completa.getSnippet();
                List<PublicacaoWriteRequest> manifestacoes =
                        ProjudiManifestacaoTextoImportacaoParser.parseHtmlProjudi(
                                conteudoEmail, assunto, arquivoOrigem, snippet);
                if (manifestacoes.isEmpty()) {
                    log.warn(
                            "Email Projudi {} sem manifestação extraída (assunto={}, snippet={})",
                            messageId,
                            assunto,
                            snippet);
                }
                for (PublicacaoWriteRequest req : manifestacoes) {
                    req.setEmailRecebidoEm(emailRecebidoEm);
                }

                Set<String> principaisEmail = manifestacoes.stream()
                        .map(PublicacaoWriteRequest::getNumeroProcessoEncontrado)
                        .filter(n -> n != null && !n.isBlank())
                        .map(String::trim)
                        .map(String::toUpperCase)
                        .collect(Collectors.toCollection(LinkedHashSet::new));

                resumo.setPublicacoesEncontradas(resumo.getPublicacoesEncontradas() + manifestacoes.size());
                processosUnicosLote.addAll(principaisEmail);

                int gravadas = 0;
                int vinculosAutomaticos = 0;
                int duplicadas = 0;
                for (PublicacaoWriteRequest req : manifestacoes) {
                    try {
                        Long pubId = importacaoTransacional.criarPublicacaoEmail(req);
                        if (pubId == null) {
                            duplicadas++;
                            continue;
                        }
                        gravadas++;
                        resumo.setPublicacoesProcessadas(resumo.getPublicacoesProcessadas() + 1);
                        if (importacaoTransacional.tentarVinculoAutomaticoPorCnj(pubId)) {
                            vinculosAutomaticos++;
                        }
                    } catch (Exception ex) {
                        String msg = mensagemRaiz(ex);
                        resumo.getErros()
                                .add("Falha ao gravar manifestação "
                                        + req.getNumeroProcessoEncontrado()
                                        + " (email "
                                        + messageId
                                        + "): "
                                        + msg);
                        log.error(
                                "Falha ao gravar manifestação Projudi email {} processo {}: {}",
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
                        "Email Projudi {} processado: gravadas={}, vinculosAutomaticos={}, duplicadasIgnoradas={}",
                        messageId,
                        gravadas,
                        vinculosAutomaticos,
                        duplicadas);
            } catch (Exception ex) {
                String msg = "Falha no email Projudi " + messageId + ": " + mensagemRaiz(ex);
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
            Instant gravado = syncService.registrarSincronizacao(EmailImportacaoSyncTipo.PROJUDI, cursorGravar);
            resumo.setUltimaSincronizacaoGravada(gravado);
        }

        log.info(
                "Busca Gmail Projudi concluída: emailsLidos={}, manifestacoesEncontradas={}, processosUnicos={}, gravadas={}, erros={}, cursorGravado={}",
                resumo.getEmailsLidos(),
                resumo.getPublicacoesEncontradas(),
                resumo.getProcessosUnicos(),
                resumo.getPublicacoesProcessadas(),
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
            return "projudi-gmail-" + messageId + ".html";
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
