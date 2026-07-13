package br.com.vilareal.email;

import br.com.vilareal.processo.application.ProcessoDiagnosticoNumeroBuscaUtil;
import br.com.vilareal.processo.application.ProcessoTramitacaoService;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.pje.application.PjeEmailTriggerService;
import br.com.vilareal.pje.config.PjeEmailTriggerProperties;
import br.com.vilareal.pje.infrastructure.browser.PjeTrt18CnjUtil;
import br.com.vilareal.projudi.ProjudiEmailTriggerService;
import br.com.vilareal.publicacao.api.dto.PublicacaoWriteRequest;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.model.ListMessagesResponse;
import com.google.api.services.gmail.model.Message;
import com.google.api.services.gmail.model.ModifyMessageRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.math.BigInteger;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Motor genérico de importação de movimentações por email (Gmail), reusado por todas as
 * fontes ({@link FonteMovimentacaoEmail}) — Projudi TJGO, TRT PUSH, etc.
 *
 * <p>Cada fonte fornece o remetente, o cursor de sincronização e o parser específico; o fluxo
 * de busca, deduplicação por {@code messageId}, gravação transacional, vínculo automático por CNJ
 * e atualização do cursor é compartilhado.
 */
@Service
public class GmailMovimentacaoEmailEngine {

    private static final Logger log = LoggerFactory.getLogger(GmailMovimentacaoEmailEngine.class);

    private final GmailApiProvider gmailApiProvider;
    private final PublicacaoEmailImportacaoTransacionalService importacaoTransacional;
    private final PublicacaoRepository publicacaoRepository;
    private final ProcessoRepository processoRepository;
    private final EmailImportacaoSyncService syncService;
    private final ProjudiEmailTriggerService projudiEmailTriggerService;
    private final PjeEmailTriggerService pjeEmailTriggerService;
    private final PjeEmailTriggerProperties pjeEmailTriggerProperties;
    private final ProjudiMovimentacoesEmailPipelineProperties pipelineProperties;
    private final ProcessoTramitacaoService processoTramitacaoService;
    private final String gmailUser;

    public GmailMovimentacaoEmailEngine(
            GmailApiProvider gmailApiProvider,
            PublicacaoEmailImportacaoTransacionalService importacaoTransacional,
            PublicacaoRepository publicacaoRepository,
            ProcessoRepository processoRepository,
            EmailImportacaoSyncService syncService,
            ProjudiEmailTriggerService projudiEmailTriggerService,
            PjeEmailTriggerService pjeEmailTriggerService,
            PjeEmailTriggerProperties pjeEmailTriggerProperties,
            ProjudiMovimentacoesEmailPipelineProperties pipelineProperties,
            ProcessoTramitacaoService processoTramitacaoService,
            @Value("${gmail.user:me}") String gmailUser) {
        this.gmailApiProvider = gmailApiProvider;
        this.importacaoTransacional = importacaoTransacional;
        this.publicacaoRepository = publicacaoRepository;
        this.processoRepository = processoRepository;
        this.syncService = syncService;
        this.projudiEmailTriggerService = projudiEmailTriggerService;
        this.pjeEmailTriggerService = pjeEmailTriggerService;
        this.pjeEmailTriggerProperties = pjeEmailTriggerProperties;
        this.pipelineProperties = pipelineProperties;
        this.processoTramitacaoService = processoTramitacaoService;
        this.gmailUser = gmailUser;
    }

    public boolean isDisponivel() {
        return gmailApiProvider.isDisponivel();
    }

    /** Busca incremental (desde o último cursor; primeira execução usa janela de 30 dias). */
    public PublicacaoEmailProcessamentoResumo processarIncremental(FonteMovimentacaoEmail fonte) throws IOException {
        Instant desde = syncService.obterCursorParaBuscaIncremental(fonte.tipo());
        String query = EmailImportacaoSyncService.montarQueryIncremental(fonte.queryBase(), desde);
        return buscarEProcessar(fonte, query, false, true, true);
    }

    /** Disparo manual: incremental por padrão, caixa completa (reprocessando) com {@code forcar}. */
    public PublicacaoEmailProcessamentoResumo processarManual(FonteMovimentacaoEmail fonte, boolean forcar)
            throws IOException {
        return processarManual(fonte, forcar, null);
    }

    /**
     * Disparo manual com cursor temporário ({@code desdeOverride}) para recuperar e-mails que o cursor
     * tenha ultrapassado sem importação.
     */
    public PublicacaoEmailProcessamentoResumo processarManual(
            FonteMovimentacaoEmail fonte, boolean forcar, Instant desdeOverride) throws IOException {
        if (forcar) {
            String query = EmailImportacaoSyncService.montarQueryCaixaCompleta(fonte.queryBase());
            return buscarEProcessar(fonte, query, true, true, false);
        }
        if (desdeOverride != null) {
            String query = EmailImportacaoSyncService.montarQueryIncremental(fonte.queryBase(), desdeOverride);
            return buscarEProcessar(fonte, query, false, true, true);
        }
        return processarIncremental(fonte);
    }

    private PublicacaoEmailProcessamentoResumo buscarEProcessar(
            FonteMovimentacaoEmail fonte,
            String query,
            boolean reprocessarEmailsExistentes,
            boolean atualizarCursor,
            boolean sincronizacaoIncremental)
            throws IOException {
        PublicacaoEmailProcessamentoResumo resumo = new PublicacaoEmailProcessamentoResumo();
        Gmail gmail = gmailApiProvider.resolver().orElse(null);
        if (gmail == null) {
            resumo.getErros().add("Gmail API não configurada.");
            return resumo;
        }

        Instant cursorAnterior = syncService.obterUltimaSincronizacao(fonte.tipo()).orElse(null);
        resumo.setUltimaSincronizacaoAnterior(cursorAnterior);
        resumo.setForcarAtualizacao(!sincronizacaoIncremental);
        resumo.setSincronizacaoIncremental(sincronizacaoIncremental);
        resumo.setQueryGmail(query);

        log.info(
                "Iniciando busca de movimentações {} no Gmail (query={}, reprocessar={}, incremental={})",
                fonte.rotulo(),
                query,
                reprocessarEmailsExistentes,
                sincronizacaoIncremental);
        List<Message> mensagens = listarMensagens(gmail, query);
        log.info("Emails {} encontrados: {}", fonte.rotulo(), mensagens.size());

        Set<String> processosUnicosLote = new LinkedHashSet<>();
        Set<String> cnjsDisparoProjudi = new LinkedHashSet<>();
        Set<String> cnjsDisparoPje = new LinkedHashSet<>();
        Instant emailMaisRecente = cursorAnterior;

        for (Message ref : mensagens) {
            String messageId = ref.getId();
            boolean jaImportado = emailJaImportado(messageId);

            if (!reprocessarEmailsExistentes && jaImportado) {
                emailMaisRecente = maisRecente(emailMaisRecente, obterDataRecebimentoMensagem(gmail, messageId));
                continue;
            }

            if (reprocessarEmailsExistentes && jaImportado) {
                int removidos = importacaoTransacional.removerPublicacoesDoEmail(messageId);
                log.info(
                        "Reprocessamento email {} {}: removidas {} movimentação(ões) anteriores",
                        fonte.rotulo(),
                        messageId,
                        removidos);
            }

            try {
                Message completa =
                        gmail.users().messages().get(gmailUser, messageId).setFormat("full").execute();
                String assunto = extrairCabecalho(completa, "Subject");
                String conteudoEmail = GmailMimeUtil.extrairConteudoTextoCompleto(completa.getPayload());
                if (conteudoEmail.isBlank()) {
                    log.warn("Email {} {} sem corpo utilizável (assunto={})", fonte.rotulo(), messageId, assunto);
                    marcarComoLido(gmail, messageId);
                    resumo.setEmailsLidos(resumo.getEmailsLidos() + 1);
                    continue;
                }

                String arquivoOrigem = montarArquivoOrigem(assunto, messageId, fonte.arquivoFallbackPrefix());
                Instant emailRecebidoEm = extrairDataRecebimentoEmail(completa);

                String snippet = completa.getSnippet();
                List<PublicacaoWriteRequest> manifestacoes =
                        fonte.parser().parse(conteudoEmail, assunto, arquivoOrigem, snippet);
                if (manifestacoes.isEmpty()) {
                    log.warn(
                            "Email {} {} sem movimentação extraída (assunto={}, snippet={})",
                            fonte.rotulo(),
                            messageId,
                            assunto,
                            snippet);
                    marcarComoLido(gmail, messageId);
                    resumo.setEmailsLidos(resumo.getEmailsLidos() + 1);
                    continue;
                }
                emailMaisRecente = maisRecente(emailMaisRecente, emailRecebidoEm);
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
                        Optional<Long> processoVinculado =
                                importacaoTransacional.tentarVinculoAutomaticoPorCnjDevolvendoProcessoId(pubId);
                        if (processoVinculado.isPresent()) {
                            vinculosAutomaticos++;
                            resumo.registrarProcessoAtivadoDrive(processoVinculado.get());
                            processoTramitacaoService.definirPorFonteEmail(
                                    processoVinculado.get(),
                                    fonte.tipo(),
                                    req.getNumeroProcessoEncontrado());
                            if (fonte.tipo() == EmailImportacaoSyncTipo.PROJUDI && !pipelineProperties.isEnabled()) {
                                projudiEmailTriggerService.registrarCnjParaDisparo(
                                        cnjsDisparoProjudi, req.getNumeroProcessoEncontrado());
                            }
                            if (fonte.tipo() == EmailImportacaoSyncTipo.TRT
                                    && pjeEmailTriggerProperties.isEnabled()
                                    && PjeTrt18CnjUtil.cnjEhTrt18(req.getNumeroProcessoEncontrado())) {
                                pjeEmailTriggerService.registrarCnjParaDisparo(
                                        cnjsDisparoPje, req.getNumeroProcessoEncontrado());
                            }
                        } else if (fonte.tipo() == EmailImportacaoSyncTipo.PROJUDI && pipelineProperties.isEnabled()) {
                            resolverProcessoIdUnicoPorCnj(req.getNumeroProcessoEncontrado())
                                    .ifPresent(resumo::registrarProcessoAtivadoDrive);
                        }
                    } catch (Exception ex) {
                        String msg = mensagemRaiz(ex);
                        resumo.getErros()
                                .add("Falha ao gravar movimentação "
                                        + req.getNumeroProcessoEncontrado()
                                        + " (email "
                                        + messageId
                                        + "): "
                                        + msg);
                        log.error(
                                "Falha ao gravar movimentação {} email {} processo {}: {}",
                                fonte.rotulo(),
                                messageId,
                                req.getNumeroProcessoEncontrado(),
                                msg,
                                ex);
                    }
                }
                resumo.setPublicacoesDuplicadasIgnoradas(
                        resumo.getPublicacoesDuplicadasIgnoradas() + duplicadas);
                resumo.setVinculosAutomaticos(resumo.getVinculosAutomaticos() + vinculosAutomaticos);

                marcarComoLido(gmail, messageId);
                resumo.setEmailsLidos(resumo.getEmailsLidos() + 1);
                log.info(
                        "Email {} {} processado: gravadas={}, vinculosAutomaticos={}, duplicadasIgnoradas={}",
                        fonte.rotulo(),
                        messageId,
                        gravadas,
                        vinculosAutomaticos,
                        duplicadas);
            } catch (Exception ex) {
                String msg = "Falha no email " + fonte.rotulo() + " " + messageId + ": " + mensagemRaiz(ex);
                log.error(msg, ex);
                resumo.getErros().add(msg);
            }
        }

        resumo.setProcessosUnicos(processosUnicosLote.size());

        if (atualizarCursor) {
            cursorParaGravar(cursorAnterior, emailMaisRecente)
                    .ifPresent(cursor -> resumo.setUltimaSincronizacaoGravada(
                            syncService.registrarSincronizacao(fonte.tipo(), cursor)));
        }

        if (fonte.tipo() == EmailImportacaoSyncTipo.PROJUDI && !pipelineProperties.isEnabled()) {
            projudiEmailTriggerService.agendarDisparoAssincrono(cnjsDisparoProjudi);
        }
        if (fonte.tipo() == EmailImportacaoSyncTipo.TRT && pjeEmailTriggerProperties.isEnabled()) {
            pjeEmailTriggerService.agendarDisparoAssincrono(cnjsDisparoPje);
        }

        log.info(
                "Busca Gmail {} concluída: emailsLidos={}, encontradas={}, processosUnicos={}, gravadas={}, erros={}, cursorGravado={}",
                fonte.rotulo(),
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

    /** Só avança o cursor quando há data de e-mail processada mais recente que o cursor anterior. */
    private static Optional<Instant> cursorParaGravar(Instant cursorAnterior, Instant emailMaisRecente) {
        if (emailMaisRecente == null) {
            return Optional.empty();
        }
        if (cursorAnterior == null || emailMaisRecente.isAfter(cursorAnterior)) {
            return Optional.of(emailMaisRecente);
        }
        return Optional.empty();
    }

    private Instant obterDataRecebimentoMensagem(Gmail gmail, String messageId) throws IOException {
        Message meta = gmail.users().messages().get(gmailUser, messageId).setFormat("minimal").execute();
        return extrairDataRecebimentoEmail(meta);
    }

    private boolean emailJaImportado(String messageId) {
        return publicacaoRepository.existsByArquivoOrigemNomeContaining("[" + messageId + "]");
    }

    private List<Message> listarMensagens(Gmail gmail, String query) throws IOException {
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

    private void marcarComoLido(Gmail gmail, String messageId) throws IOException {
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

    private static String montarArquivoOrigem(String assunto, String messageId, String fallbackPrefix) {
        String a = assunto == null ? "" : assunto.trim();
        if (a.isBlank()) {
            return fallbackPrefix + messageId + ".html";
        }
        if (a.length() > 200) {
            a = a.substring(0, 200);
        }
        return a + " [" + messageId + "]";
    }

    private Optional<Long> resolverProcessoIdUnicoPorCnj(String numeroCnj) {
        if (numeroCnj == null || numeroCnj.isBlank()) {
            return Optional.empty();
        }
        List<BigInteger> ids =
                ProcessoDiagnosticoNumeroBuscaUtil.buscarIdsProcessoPorNumero(numeroCnj, processoRepository);
        if (ids.size() != 1) {
            return Optional.empty();
        }
        return Optional.of(ids.getFirst().longValue());
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
