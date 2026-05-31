package br.com.vilareal.projudi;

import br.com.vilareal.email.GmailMimeUtil;
import br.com.vilareal.email.PublicacaoTextoImportacaoParser;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.model.ListMessagesResponse;
import com.google.api.services.gmail.model.Message;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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
 * <p><b>Segurança de log:</b> registra apenas metadados (messageId, internalDate).
 * O token e o corpo do e-mail nunca são logados.</p>
 */
@Service
public class ProjudiTokenReaderService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiTokenReaderService.class);

    /** Margem subtraída de inicioLogin no filtro {@code after:} do Gmail (segundos). */
    private static final long MARGEM_AFTER_SEGUNDOS = 60L;
    /**
     * Tolerância anti-stale: o internalDate do Gmail é truncado ao segundo, enquanto
     * inicioLogin tem fração de segundo; sem folga o e-mail correto seria descartado por &lt;1s.
     * Como ainda escolhemos o e-mail MAIS RECENTE entre os válidos, códigos antigos (fora dos 30s) ficam de fora.
     */
    private static final long TOLERANCIA_STALE_SEGUNDOS = 30L;
    private static final Duration INTERVALO_POLLING = Duration.ofSeconds(5);
    private static final Duration TIMEOUT_DEFAULT = Duration.ofMinutes(2);

    /** Token ancorado na palavra "código" (case-insensitive), até 80 não-dígitos antes dos 6 dígitos. */
    private static final Pattern PADRAO_CODIGO = Pattern.compile("c.digo\\D{0,80}(\\d{6})", Pattern.CASE_INSENSITIVE);
    /** Qualquer sequência de 6 dígitos (para o log de candidatos). */
    private static final Pattern PADRAO_SEIS_DIGITOS = Pattern.compile("\\d{6}");

    private final Gmail gmail;
    private final String gmailUser;
    private final String remetente;
    private final Pattern tokenRegex;

    public ProjudiTokenReaderService(
            @Autowired(required = false) Gmail gmail,
            @Value("${gmail.user:me}") String gmailUser,
            @Value("${projudi.token.remetente:}") String remetente,
            @Value("${projudi.token.regex:}") String regex) {
        this.gmail = gmail;
        this.gmailUser = gmailUser;
        this.remetente = remetente == null ? "" : remetente.trim();
        this.tokenRegex = compilarRegex(regex);
    }

    /** Mesmo padrão tolerante de {@code GmailPublicacaoService}: indisponível se o bean Gmail não existe. */
    public boolean isDisponivel() {
        return gmail != null;
    }

    /** Conveniência: usa o timeout padrão de 2 minutos. */
    public Optional<String> aguardarToken(Instant inicioLogin) {
        return aguardarToken(inicioLogin, TIMEOUT_DEFAULT);
    }

    /**
     * Faz polling no Gmail a cada 5s, até localizar o token ou estourar o timeout.
     *
     * @param inicioLogin instante do início do login; e-mails anteriores a ele são
     *                    descartados (anti-stale).
     * @param timeout     tempo máximo de espera (nulo/≤0 ⇒ 2 minutos).
     * @return o primeiro grupo capturado pela regex configurada, ou vazio.
     */
    public Optional<String> aguardarToken(Instant inicioLogin, Duration timeout) {
        if (inicioLogin == null) {
            throw new IllegalArgumentException("inicioLogin é obrigatório.");
        }
        if (gmail == null) {
            log.warn("Leitura de token PROJUDI indisponível: bean Gmail não configurado.");
            return Optional.empty();
        }
        if (!StringUtils.hasText(remetente)) {
            log.warn("Leitura de token PROJUDI ignorada: projudi.token.remetente não configurado.");
            return Optional.empty();
        }
        if (tokenRegex == null) {
            log.warn("Leitura de token PROJUDI ignorada: projudi.token.regex não configurado/ inválido.");
            return Optional.empty();
        }

        Duration efetivo = (timeout == null || timeout.isZero() || timeout.isNegative())
                ? TIMEOUT_DEFAULT : timeout;
        Instant limite = Instant.now().plus(efetivo);
        log.info("Aguardando token PROJUDI (inicioLogin={}, timeout={}s).", inicioLogin, efetivo.toSeconds());

        while (true) {
            Optional<String> token = tentarLerToken(inicioLogin);
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
                log.warn("Espera por token PROJUDI interrompida.");
                return Optional.empty();
            }
        }
        log.info("Timeout aguardando token PROJUDI (nenhum e-mail válido após inicioLogin={}).", inicioLogin);
        return Optional.empty();
    }

    /** Uma varredura: lista candidatos, descarta stale, pega o mais recente e extrai o token. */
    private Optional<String> tentarLerToken(Instant inicioLogin) {
        try {
            long afterEpoch = inicioLogin.minusSeconds(MARGEM_AFTER_SEGUNDOS).getEpochSecond();
            String query = "from:" + remetente + " after:" + afterEpoch;

            List<Message> refs = listarMensagens(query);
            // Folga de 30s: internalDate vem truncado ao segundo; sem isso o e-mail certo cai por <1s.
            long corteStaleMs = inicioLogin.minusSeconds(TOLERANCIA_STALE_SEGUNDOS).toEpochMilli();

            Message maisRecente = null;
            long maisRecenteMs = Long.MIN_VALUE;
            for (Message ref : refs) {
                Message meta = gmail.users().messages()
                        .get(gmailUser, ref.getId())
                        .setFormat("metadata")
                        .execute();
                Long internalDate = meta.getInternalDate();
                if (internalDate == null) {
                    continue;
                }
                if (internalDate < corteStaleMs) {
                    // E-mail anterior à janela (inicioLogin - 30s): token de login passado (stale).
                    log.debug("Descartado e-mail stale (messageId={}, internalDate={}).",
                            meta.getId(), internalDate);
                    continue;
                }
                if (internalDate > maisRecenteMs) {
                    maisRecenteMs = internalDate;
                    maisRecente = meta;
                }
            }

            if (maisRecente == null) {
                return Optional.empty();
            }

            Message completa = gmail.users().messages()
                    .get(gmailUser, maisRecente.getId())
                    .setFormat("full")
                    .execute();
            String html = GmailMimeUtil.extrairHtml(completa.getPayload());
            String texto = PublicacaoTextoImportacaoParser.htmlParaTexto(html);

            Optional<String> token = extrairToken(texto);

            // TEMPORÁRIO - diagnóstico OTP
            log.info("[PROJUDI otp-debug] candidatos={} escolhido={} trecho={}",
                    todosSeisDigitos(texto), token.orElse(null), trechoAoRedor(texto, token.orElse(null)));

            if (token.isPresent()) {
                log.info("Token PROJUDI localizado (messageId={}, internalDate={}).",
                        completa.getId(), maisRecenteMs);
            } else {
                log.info("E-mail PROJUDI mais recente sem token reconhecível pela regex (messageId={}, internalDate={}).",
                        completa.getId(), maisRecenteMs);
            }
            return token;
        } catch (IOException e) {
            // Falha transitória de rede/API: loga e deixa o polling tentar de novo.
            log.warn("Falha ao consultar Gmail por token PROJUDI: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /**
     * Extrai o token. Primeiro tenta ancorado na palavra "código" ({@link #PADRAO_CODIGO});
     * se não casar, usa o fallback com a regex configurada ({@code projudi.token.regex}),
     * pegando o primeiro 6-dígitos.
     */
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
            log.warn("projudi.token.regex não possui grupo de captura; defina um grupo para isolar o token.");
            return Optional.empty();
        }
        String grupo = m.group(1);
        return StringUtils.hasText(grupo) ? Optional.of(grupo) : Optional.empty();
    }

    // TEMPORÁRIO - diagnóstico OTP
    private static List<String> todosSeisDigitos(String texto) {
        List<String> achados = new ArrayList<>();
        if (texto == null) {
            return achados;
        }
        Matcher m = PADRAO_SEIS_DIGITOS.matcher(texto);
        while (m.find()) {
            achados.add(m.group());
        }
        return achados;
    }

    // TEMPORÁRIO - diagnóstico OTP
    private static String trechoAoRedor(String texto, String token) {
        if (texto == null || texto.isEmpty()) {
            return "";
        }
        String limpo = texto.replaceAll("\\s+", " ").trim();
        int idx = token == null ? -1 : limpo.indexOf(token);
        if (idx < 0) {
            return limpo.length() <= 300 ? limpo : limpo.substring(0, 300);
        }
        int ini = Math.max(0, idx - 150);
        int fim = Math.min(limpo.length(), idx + token.length() + 150);
        return limpo.substring(ini, fim);
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

    private static Pattern compilarRegex(String regex) {
        if (!StringUtils.hasText(regex)) {
            return null;
        }
        try {
            return Pattern.compile(regex.trim());
        } catch (PatternSyntaxException e) {
            log.warn("projudi.token.regex inválida: {}", e.getMessage());
            return null;
        }
    }
}
