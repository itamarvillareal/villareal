package br.com.vilareal.email;

import br.com.vilareal.financeiro.application.ExtratoCoraImportResult;
import br.com.vilareal.financeiro.application.ExtratoCoraImportService;
import br.com.vilareal.imovel.application.DespesaCondominioAutoConciliacaoService;
import br.com.vilareal.imovel.application.LocacaoReconciliacaoService;
import br.com.vilareal.imovel.api.dto.ConciliarAlugueisAutomaticoResponse;
import br.com.vilareal.imovel.api.dto.ConciliarCondominioAutomaticoResponse;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.model.ListMessagesResponse;
import com.google.api.services.gmail.model.Message;
import com.google.api.services.gmail.model.ModifyMessageRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
public class GmailExtratoCoraService {

    private static final Logger log = LoggerFactory.getLogger(GmailExtratoCoraService.class);

    static final String QUERY_BASE =
            "from:naoresponda@cora.com.br subject:\"Extrato da conta VRV SOLUCOES\" has:attachment";

    private final GmailApiProvider gmailApiProvider;
    private final ExtratoCoraImportService extratoCoraImportService;
    private final ExtratoCoraEmailProcessadoService emailProcessadoService;
    private final LocacaoReconciliacaoService locacaoReconciliacaoService;
    private final DespesaCondominioAutoConciliacaoService despesaCondominioAutoConciliacaoService;
    private final String gmailUser;

    public GmailExtratoCoraService(
            GmailApiProvider gmailApiProvider,
            ExtratoCoraImportService extratoCoraImportService,
            ExtratoCoraEmailProcessadoService emailProcessadoService,
            LocacaoReconciliacaoService locacaoReconciliacaoService,
            DespesaCondominioAutoConciliacaoService despesaCondominioAutoConciliacaoService,
            @Value("${gmail.user:me}") String gmailUser) {
        this.gmailApiProvider = gmailApiProvider;
        this.extratoCoraImportService = extratoCoraImportService;
        this.emailProcessadoService = emailProcessadoService;
        this.locacaoReconciliacaoService = locacaoReconciliacaoService;
        this.despesaCondominioAutoConciliacaoService = despesaCondominioAutoConciliacaoService;
        this.gmailUser = gmailUser;
    }

    public boolean isDisponivel() {
        return gmailApiProvider.isDisponivel();
    }

    public ExtratoCoraEmailProcessamentoResumo buscarEImportarExtratos() throws IOException {
        return buscarEImportarExtratos(false);
    }

    /**
     * @param reprocessar quando {@code true}, ignora a tabela de e-mails já processados (útil para teste)
     */
    public ExtratoCoraEmailProcessamentoResumo buscarEImportarExtratos(boolean reprocessar) throws IOException {
        ExtratoCoraEmailProcessamentoResumo resumo = new ExtratoCoraEmailProcessamentoResumo();
        Gmail gmail = gmailApiProvider.resolver().orElse(null);
        if (gmail == null) {
            resumo.getErros().add("Gmail API não configurada.");
            return resumo;
        }

        log.info("Iniciando importação extrato Cora via Gmail (query={})", QUERY_BASE);
        List<Message> mensagens = listarMensagens(gmail, QUERY_BASE);
        resumo.setEmailsEncontrados(mensagens.size());
        log.info("Emails Cora encontrados: {}", mensagens.size());

        Set<String> jaProcessados =
                reprocessar ? Set.of() : emailProcessadoService.messageIdsJaProcessados(gmailUser);

        for (Message ref : mensagens) {
            String messageId = ref.getId();
            if (!reprocessar && jaProcessados.contains(messageId)) {
                log.debug("Email {} já processado anteriormente; ignorado.", messageId);
                resumo.setEmailsIgnorados(resumo.getEmailsIgnorados() + 1);
                continue;
            }

            try {
                int criadosEmail = 0;
                int jaExistiamEmail = 0;
                int falhasEmail = 0;

                List<GmailAnexoArquivo> anexos = GmailMimeUtil.baixarAnexosOfx(gmail, gmailUser, messageId);
                if (anexos.isEmpty()) {
                    log.warn("Email {} sem anexo .ofx utilizável.", messageId);
                    resumo.getErros().add("Email " + messageId + ": nenhum anexo .ofx encontrado.");
                    continue;
                }

                boolean algumAnexoProcessado = false;
                for (GmailAnexoArquivo anexo : anexos) {
                    log.info(
                            "Importando OFX Cora do email {} — arquivo={} ({} bytes)",
                            messageId,
                            anexo.filename(),
                            anexo.conteudo().length);
                    ExtratoCoraImportResult parcial = extratoCoraImportService.importar(anexo.conteudo());
                    criadosEmail += parcial.getCriados();
                    jaExistiamEmail += parcial.getJaExistia();
                    falhasEmail += parcial.getFalhas();
                    resumo.setLancamentosCriados(resumo.getLancamentosCriados() + parcial.getCriados());
                    resumo.setLancamentosJaExistiam(resumo.getLancamentosJaExistiam() + parcial.getJaExistia());
                    resumo.setFalhas(resumo.getFalhas() + parcial.getFalhas());

                    if (parcial.getTotalNoArquivo() == 0) {
                        log.warn(
                                "OFX {} do email {} sem transações STMTTRN; anexo ignorado.",
                                anexo.filename(),
                                messageId);
                        resumo.getErros().add(
                                "Email " + messageId + ": OFX " + anexo.filename() + " sem lançamentos.");
                        continue;
                    }
                    if (parcial.getCriados() > 0 || parcial.getJaExistia() > 0) {
                        algumAnexoProcessado = true;
                    } else {
                        resumo.getErros().add(
                                "Email "
                                        + messageId
                                        + ": OFX "
                                        + anexo.filename()
                                        + " — nenhum lançamento persistido ("
                                        + parcial.getFalhas()
                                        + " falha(s)).");
                    }
                }

                if (algumAnexoProcessado) {
                    emailProcessadoService.registrarProcessado(
                            gmailUser, messageId, criadosEmail, jaExistiamEmail, falhasEmail);
                    marcarComoLido(gmail, messageId);
                    resumo.setEmailsMarcadosLidos(resumo.getEmailsMarcadosLidos() + 1);
                    log.info("Email {} processado e registrado como importado.", messageId);
                } else {
                    log.warn("Email {} não registrado — nenhum OFX válido importado.", messageId);
                }
                resumo.setEmailsProcessados(resumo.getEmailsProcessados() + 1);
            } catch (Exception ex) {
                String msg = "Falha no email " + messageId + ": " + mensagemRaiz(ex);
                log.error(msg, ex);
                resumo.getErros().add(msg);
            }
        }

        log.info(
                "Importação extrato Cora concluída: {} e-mail(s) encontrado(s), {} processado(s), {} ignorado(s), "
                        + "{} lançamento(s) criado(s), {} já existiam, {} falha(s).",
                resumo.getEmailsEncontrados(),
                resumo.getEmailsProcessados(),
                resumo.getEmailsIgnorados(),
                resumo.getLancamentosCriados(),
                resumo.getLancamentosJaExistiam(),
                resumo.getFalhas());
        conciliarPosImportacao(resumo);
        return resumo;
    }

    /** Pós-import OFX Cora: auto-concilia aluguéis e condomínios do mês corrente (idempotente). */
    private void conciliarPosImportacao(ExtratoCoraEmailProcessamentoResumo resumo) {
        conciliarAlugueisPosImportacao(resumo);
        conciliarCondominioPosImportacao(resumo);
    }

    /** Pós-processamento idempotente: auto-vincula aluguéis Cora inequívocos do mês corrente. */
    private void conciliarAlugueisPosImportacao(ExtratoCoraEmailProcessamentoResumo resumo) {
        try {
            ConciliarAlugueisAutomaticoResponse auto = locacaoReconciliacaoService.conciliarAlugueisAutomatico(null);
            log.info(
                    "Auto-conciliação aluguéis pós-import Cora (competencia={}): {} vinculado(s), {} para revisão, {} sem crédito.",
                    auto.getCompetencia(),
                    auto.getAutoVinculados(),
                    auto.getParaRevisao().size(),
                    auto.getSemCredito().size());
        } catch (Exception ex) {
            log.warn("Auto-conciliação aluguéis pós-import Cora falhou (importação já concluída): {}", mensagemRaiz(ex), ex);
            resumo.getErros().add("Auto-conciliação aluguéis: " + mensagemRaiz(ex));
        }
    }

    /** Pós-processamento idempotente: auto-vincula condomínios confirmados com débito inequívoco no mês. */
    private void conciliarCondominioPosImportacao(ExtratoCoraEmailProcessamentoResumo resumo) {
        try {
            ConciliarCondominioAutomaticoResponse auto =
                    despesaCondominioAutoConciliacaoService.conciliarCondominioAutomatico(null);
            log.info(
                    "Auto-conciliação condomínio pós-import Cora (competencia={}): {} conciliado(s), {} para revisão, {} sem débito.",
                    auto.getCompetencia(),
                    auto.getAutoConciliados(),
                    auto.getParaRevisao().size(),
                    auto.getSemDebito().size());
        } catch (Exception ex) {
            log.warn(
                    "Auto-conciliação condomínio pós-import Cora falhou (importação já concluída): {}",
                    mensagemRaiz(ex),
                    ex);
            resumo.getErros().add("Auto-conciliação condomínio: " + mensagemRaiz(ex));
        }
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
