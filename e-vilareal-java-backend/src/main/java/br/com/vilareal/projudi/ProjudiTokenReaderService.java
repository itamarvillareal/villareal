package br.com.vilareal.projudi;

import br.com.vilareal.email.GmailApiProvider;
import br.com.vilareal.email.GmailMimeUtil;
import br.com.vilareal.email.PublicacaoTextoImportacaoParser;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.model.ListMessagesResponse;
import com.google.api.services.gmail.model.Message;
import com.google.api.services.gmail.model.MessagePartHeader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

/**
 * Lê o token 2FA que o PROJUDI-GO envia por e-mail, reutilizando o bean
 * {@code Gmail} já configurado por {@code GmailConfig} (o mesmo de
 * {@code GmailPublicacaoService}).
 *
 * <p>É um fetch <b>pontual e direcionado</b>: NÃO usa nem altera o cursor
 * incremental das publicações ({@code EmailImportacaoSyncService}). Faz apenas
 * leitura — nunca marca como lido nem altera labels.</p>
 *
 * <p><b>Segurança de log:</b> registra apenas metadados (messageId, internalDate,
 * From, Subject). O token e o corpo do e-mail nunca são logados.</p>
 */
@Service
public class ProjudiTokenReaderService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiTokenReaderService.class);

    /** Margem subtraída de inicioLogin no filtro {@code after:} do Gmail (segundos). */
    private static final long MARGEM_AFTER_SEGUNDOS = 60L;
    /**
     * Tolerância anti-stale: o internalDate do Gmail é truncado ao segundo, enquanto
     * inicioLogin tem fração de segundo; sem folga o e-mail correto seria descartado por &lt;1s.
     */
    private static final long TOLERANCIA_STALE_SEGUNDOS = 30L;
    private static final Duration INTERVALO_POLLING = Duration.ofSeconds(5);
    private static final Duration TIMEOUT_DEFAULT = Duration.ofMinutes(2);

    /** Token ancorado na palavra "código" (case-insensitive), até 80 não-dígitos antes dos 6 dígitos. */
    private static final Pattern PADRAO_CODIGO = Pattern.compile("c.digo\\D{0,80}(\\d{6})", Pattern.CASE_INSENSITIVE);

    private final GmailApiProvider gmailApiProvider;
    private final String gmailUser;
    private final String remetente;
    private final Pattern tokenRegex;

    public ProjudiTokenReaderService(
            GmailApiProvider gmailApiProvider,
            @Value("${gmail.user:me}") String gmailUser,
            @Value("${projudi.token.remetente:}") String remetente,
            @Value("${projudi.token.regex:}") String regex) {
        this.gmailApiProvider = gmailApiProvider;
        this.gmailUser = gmailUser;
        this.remetente = remetente == null ? "" : remetente.trim();
        this.tokenRegex = compilarRegex(regex);
    }

    /** {@code true} quando o bean {@code gmail} foi registrado no contexto (lookup no momento da chamada). */
    public boolean isDisponivel() {
        return gmailApiProvider.isDisponivel();
    }

    /** Conveniência: usa o timeout padrão de 2 minutos. */
    public Optional<String> aguardarToken(Instant inicioLogin) {
        return aguardarToken(inicioLogin, TIMEOUT_DEFAULT);
    }

    /**
     * Faz polling no Gmail a cada 5s, até localizar o token ou estourar o timeout.
     *
     * @throws ProjudiOtpGmailIndisponivelException se o bean Gmail não existe (falha imediata, sem polling)
     */
    public Optional<String> aguardarToken(Instant inicioLogin, Duration timeout) {
        if (inicioLogin == null) {
            throw new IllegalArgumentException("inicioLogin é obrigatório.");
        }
        Gmail gmail = exigirGmail();
        if (!StringUtils.hasText(remetente)) {
            throw new IllegalStateException("projudi.token.remetente não configurado.");
        }
        if (tokenRegex == null) {
            throw new IllegalStateException("projudi.token.regex não configurado ou inválido.");
        }

        Duration efetivo = (timeout == null || timeout.isZero() || timeout.isNegative())
                ? TIMEOUT_DEFAULT : timeout;
        Instant limite = Instant.now().plus(efetivo);
        long afterEpoch = inicioLogin.minusSeconds(MARGEM_AFTER_SEGUNDOS).getEpochSecond();
        String queryComRemetente = "from:" + remetente + " after:" + afterEpoch;

        log.debug(
                "[PROJUDI otp-diag] CONFIG remetente={} gmailUser={} OTP_TIMEOUT={}s pollIntervalo={}s "
                        + "margemAfter={}s toleranciaStale={}s",
                remetente,
                gmailUser,
                efetivo.toSeconds(),
                INTERVALO_POLLING.toSeconds(),
                MARGEM_AFTER_SEGUNDOS,
                TOLERANCIA_STALE_SEGUNDOS);
        log.debug(
                "[PROJUDI otp-diag] QUERY com remetente (exata): \"{}\" | inicioLogin={} afterEpoch={}",
                queryComRemetente,
                inicioLogin,
                afterEpoch);
        log.debug("[PROJUDI otp-diag] Aguardando token (timeout={}s).", efetivo.toSeconds());

        int poll = 0;
        while (true) {
            poll++;
            Optional<String> token = tentarLerToken(gmail, inicioLogin, poll);
            if (token.isPresent()) {
                return token;
            }
            Instant proximaTentativa = Instant.now().plus(INTERVALO_POLLING);
            if (!proximaTentativa.isBefore(limite)) {
                break;
            }
            try {
                Thread.sleep(INTERVALO_POLLING.toMillis());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.warn("[PROJUDI otp-diag] Espera interrompida.");
                return Optional.empty();
            }
        }
        log.debug(
                "[PROJUDI otp-diag] TIMEOUT após {} poll(s); nenhum e-mail válido após inicioLogin={}.",
                poll,
                inicioLogin);
        return Optional.empty();
    }

    private Gmail exigirGmail() {
        return gmailApiProvider.resolver()
                .orElseThrow(() -> new ProjudiOtpGmailIndisponivelException(motivoGmailAusente()));
    }

    private String motivoGmailAusente() {
        return "bean gmail não registrado — verifique gmail.credentials.path, gmail.tokens.directory e tokens OAuth";
    }

    /** Uma varredura: lista candidatos, descarta stale, pega o mais recente e extrai o token. */
    private Optional<String> tentarLerToken(Gmail gmail, Instant inicioLogin, int pollNum) {
        try {
            Instant agora = Instant.now();
            long afterEpoch = inicioLogin.minusSeconds(MARGEM_AFTER_SEGUNDOS).getEpochSecond();
            String queryComRemetente = "from:" + remetente + " after:" + afterEpoch;
            long corteStaleMs = inicioLogin.minusSeconds(TOLERANCIA_STALE_SEGUNDOS).toEpochMilli();

            log.debug(
                    "[PROJUDI otp-diag] poll={} agora={} inicioLogin={} corteStaleMs={} (internalDate < corte => stale)",
                    pollNum,
                    agora,
                    inicioLogin,
                    corteStaleMs);
            log.debug("[PROJUDI otp-diag] poll={} queryComRemetente=\"{}\"", pollNum, queryComRemetente);

            pollDiagnosticoSemRemetente(gmail, pollNum, afterEpoch);

            List<Message> refs = listarMensagens(gmail, queryComRemetente);
            log.debug("[PROJUDI otp-diag] poll={} mensagensNaQueryComRemetente={}", pollNum, refs.size());

            if (refs.isEmpty()) {
                log.debug(
                        "[PROJUDI otp-diag] poll={} nenhum e-mail com from:{} após:{} — "
                                + "ver poll diag sem remetente acima.",
                        pollNum,
                        remetente,
                        afterEpoch);
                return Optional.empty();
            }

            Message maisRecente = null;
            long maisRecenteMs = Long.MIN_VALUE;
            for (Message ref : refs) {
                Message meta = gmail.users().messages()
                        .get(gmailUser, ref.getId())
                        .setFormat("metadata")
                        .setMetadataHeaders(List.of("From", "Subject", "Date"))
                        .execute();
                String from = extrairCabecalho(meta, "From");
                String subject = extrairCabecalho(meta, "Subject");
                Long internalDate = meta.getInternalDate();
                String motivoRejeicao = avaliarRejeicao(from, internalDate, corteStaleMs, remetente);
                if (motivoRejeicao == null) {
                    log.debug(
                            "[PROJUDI otp-diag] poll={} msg={} ACEITO candidato from={} subject={} internalDate={}",
                            pollNum,
                            meta.getId(),
                            truncar(from, 120),
                            truncar(subject, 120),
                            internalDate);
                    if (internalDate != null && internalDate > maisRecenteMs) {
                        maisRecenteMs = internalDate;
                        maisRecente = meta;
                    }
                } else {
                    log.debug(
                            "[PROJUDI otp-diag] poll={} msg={} REJEITADO from={} subject={} internalDate={} motivo={}",
                            pollNum,
                            meta.getId(),
                            truncar(from, 120),
                            truncar(subject, 120),
                            internalDate,
                            motivoRejeicao);
                }
            }

            if (maisRecente == null) {
                log.debug(
                        "[PROJUDI otp-diag] poll={} todas as {} mensagem(ns) da query foram rejeitadas (stale/remetente).",
                        pollNum,
                        refs.size());
                return Optional.empty();
            }

            Message completa = gmail.users().messages()
                    .get(gmailUser, maisRecente.getId())
                    .setFormat("full")
                    .execute();
            String html = GmailMimeUtil.extrairHtml(completa.getPayload());
            String texto = PublicacaoTextoImportacaoParser.htmlParaTexto(html);

            Optional<String> token = extrairToken(texto);
            boolean temAncorado = PADRAO_CODIGO.matcher(texto != null ? texto : "").find();
            boolean temRegex = tokenRegex != null && texto != null && tokenRegex.matcher(texto).find();

            if (token.isPresent()) {
                log.debug(
                        "[PROJUDI otp-diag] poll={} TOKEN extraído (messageId={}, internalDate={}; "
                                + "padrãoCódigo={}, regexFallback={}) — valor NÃO logado.",
                        pollNum,
                        completa.getId(),
                        maisRecenteMs,
                        temAncorado,
                        temRegex);
            } else {
                log.debug(
                        "[PROJUDI otp-diag] poll={} e-mail mais recente SEM token reconhecível "
                                + "(messageId={}, internalDate={}; padrãoCódigo={}, regexFallback={}; corpoVazio={})",
                        pollNum,
                        completa.getId(),
                        maisRecenteMs,
                        temAncorado,
                        temRegex,
                        !StringUtils.hasText(texto));
            }
            return token;
        } catch (IOException e) {
            log.warn("[PROJUDI otp-diag] poll={} falha Gmail API: {}", pollNum, e.getMessage());
            return Optional.empty();
        }
    }

    private void pollDiagnosticoSemRemetente(Gmail gmail, int pollNum, long afterEpoch) {
        try {
            String queryJanela = "after:" + afterEpoch;
            List<Message> refs = listarMensagens(gmail, queryJanela);
            log.debug(
                    "[PROJUDI otp-diag] poll={} DIAG sem remetente query=\"{}\" mensagens={}",
                    pollNum,
                    queryJanela,
                    refs.size());
            int limite = Math.min(refs.size(), 15);
            for (int i = 0; i < limite; i++) {
                Message meta = gmail.users().messages()
                        .get(gmailUser, refs.get(i).getId())
                        .setFormat("metadata")
                        .setMetadataHeaders(List.of("From", "Subject"))
                        .execute();
                log.debug(
                        "[PROJUDI otp-diag] poll={} DIAG[{}] from={} subject={} internalDate={}",
                        pollNum,
                        i + 1,
                        truncar(extrairCabecalho(meta, "From"), 120),
                        truncar(extrairCabecalho(meta, "Subject"), 120),
                        meta.getInternalDate());
            }
            if (refs.size() > limite) {
                log.debug("[PROJUDI otp-diag] poll={} DIAG ... +{} mensagem(ns) omitidas.", pollNum, refs.size() - limite);
            }
        } catch (IOException e) {
            log.warn("[PROJUDI otp-diag] poll={} DIAG sem remetente falhou: {}", pollNum, e.getMessage());
        }
    }

    private static String avaliarRejeicao(String from, Long internalDate, long corteStaleMs, String remetenteConfig) {
        if (internalDate == null) {
            return "sem internalDate";
        }
        if (internalDate < corteStaleMs) {
            return "anti-stale (internalDate < inicioLogin - " + TOLERANCIA_STALE_SEGUNDOS + "s)";
        }
        if (!StringUtils.hasText(from)) {
            return "sem cabeçalho From";
        }
        String fromLower = from.toLowerCase();
        String remLower = remetenteConfig.toLowerCase();
        if (!fromLower.contains(remLower)) {
            return "remetente não casa com projudi.token.remetente (From não contém " + remetenteConfig + ")";
        }
        return null;
    }

    private Optional<String> extrairToken(String texto) {
        if (!StringUtils.hasText(texto)) {
            return Optional.empty();
        }
        Matcher ancorado = PADRAO_CODIGO.matcher(texto);
        if (ancorado.find()) {
            String grupo = ancorado.group(1);
            if (StringUtils.hasText(grupo)) {
                return Optional.of(grupo);
            }
        }
        Matcher m = tokenRegex.matcher(texto);
        if (!m.find()) {
            return Optional.empty();
        }
        if (m.groupCount() < 1) {
            log.warn("[PROJUDI otp-diag] projudi.token.regex sem grupo de captura.");
            return Optional.empty();
        }
        String grupo = m.group(1);
        return StringUtils.hasText(grupo) ? Optional.of(grupo) : Optional.empty();
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

    private static String extrairCabecalho(Message message, String nome) {
        if (message.getPayload() == null || message.getPayload().getHeaders() == null) {
            return "";
        }
        for (MessagePartHeader h : message.getPayload().getHeaders()) {
            if (h.getName() != null && h.getName().equalsIgnoreCase(nome)) {
                return h.getValue() == null ? "" : h.getValue();
            }
        }
        return "";
    }

    private static String truncar(String s, int max) {
        if (s == null) {
            return "";
        }
        String t = s.replaceAll("\\s+", " ").trim();
        return t.length() <= max ? t : t.substring(0, max) + "…";
    }

    private static Pattern compilarRegex(String regex) {
        if (!StringUtils.hasText(regex)) {
            return null;
        }
        try {
            return Pattern.compile(regex.trim());
        } catch (PatternSyntaxException e) {
            log.warn("[PROJUDI otp-diag] projudi.token.regex inválida: {}", e.getMessage());
            return null;
        }
    }
}
