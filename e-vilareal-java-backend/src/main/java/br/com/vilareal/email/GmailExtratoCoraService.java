package br.com.vilareal.email;

import br.com.vilareal.financeiro.application.ExtratoCoraImportResult;
import br.com.vilareal.financeiro.application.ExtratoCoraImportService;
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

@Service
public class GmailExtratoCoraService {

    private static final Logger log = LoggerFactory.getLogger(GmailExtratoCoraService.class);

    static final String QUERY_BASE =
            "from:naoresponda@cora.com.br subject:\"Extrato da conta VRV SOLUCOES\" has:attachment is:unread";

    private final GmailApiProvider gmailApiProvider;
    private final ExtratoCoraImportService extratoCoraImportService;
    private final String gmailUser;

    public GmailExtratoCoraService(
            GmailApiProvider gmailApiProvider,
            ExtratoCoraImportService extratoCoraImportService,
            @Value("${gmail.user:me}") String gmailUser) {
        this.gmailApiProvider = gmailApiProvider;
        this.extratoCoraImportService = extratoCoraImportService;
        this.gmailUser = gmailUser;
    }

    public boolean isDisponivel() {
        return gmailApiProvider.isDisponivel();
    }

    public ExtratoCoraEmailProcessamentoResumo buscarEImportarExtratos() throws IOException {
        return buscarEImportarExtratos(false);
    }

    /**
     * @param incluirLidos quando {@code true}, remove {@code is:unread} da query (útil para reprocessar e-mails já abertos)
     */
    public ExtratoCoraEmailProcessamentoResumo buscarEImportarExtratos(boolean incluirLidos) throws IOException {
        ExtratoCoraEmailProcessamentoResumo resumo = new ExtratoCoraEmailProcessamentoResumo();
        Gmail gmail = gmailApiProvider.resolver().orElse(null);
        if (gmail == null) {
            resumo.getErros().add("Gmail API não configurada.");
            return resumo;
        }

        String query = incluirLidos ? QUERY_BASE.replace(" is:unread", "") : QUERY_BASE;
        log.info("Iniciando importação extrato Cora via Gmail (query={})", query);
        List<Message> mensagens = listarMensagens(gmail, query);
        resumo.setEmailsEncontrados(mensagens.size());
        log.info("Emails Cora encontrados: {}", mensagens.size());

        for (Message ref : mensagens) {
            String messageId = ref.getId();
            try {
                List<GmailAnexoArquivo> anexos = GmailMimeUtil.baixarAnexosOfx(gmail, gmailUser, messageId);
                if (anexos.isEmpty()) {
                    log.warn("Email {} sem anexo .ofx utilizável; mantido como não lido.", messageId);
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
                    resumo.setLancamentosCriados(resumo.getLancamentosCriados() + parcial.getCriados());
                    resumo.setLancamentosJaExistiam(resumo.getLancamentosJaExistiam() + parcial.getJaExistia());
                    resumo.setFalhas(resumo.getFalhas() + parcial.getFalhas());

                    if (parcial.getTotalNoArquivo() == 0) {
                        log.warn(
                                "OFX {} do email {} sem transações STMTTRN; anexo ignorado para marcação de lido.",
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
                    marcarComoLido(gmail, messageId);
                    resumo.setEmailsMarcadosLidos(resumo.getEmailsMarcadosLidos() + 1);
                    log.info("Email {} processado e marcado como lido.", messageId);
                } else {
                    log.warn("Email {} não marcado como lido — nenhum OFX válido importado.", messageId);
                }
                resumo.setEmailsProcessados(resumo.getEmailsProcessados() + 1);
            } catch (Exception ex) {
                String msg = "Falha no email " + messageId + ": " + mensagemRaiz(ex);
                log.error(msg, ex);
                resumo.getErros().add(msg);
            }
        }

        log.info(
                "Importação extrato Cora concluída: {} e-mail(s), {} lançamento(s) criado(s), {} já existiam, {} falha(s), {} marcado(s) como lido(s).",
                resumo.getEmailsProcessados(),
                resumo.getLancamentosCriados(),
                resumo.getLancamentosJaExistiam(),
                resumo.getFalhas(),
                resumo.getEmailsMarcadosLidos());
        return resumo;
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
