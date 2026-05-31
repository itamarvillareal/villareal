package br.com.vilareal.projudi.api;

// TEMPORÁRIO - remover após validação

import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.projudi.ProjudiOrquestradorService;
import br.com.vilareal.projudi.ProjudiBackfillSubmenuDiagnosticoService;
import br.com.vilareal.projudi.ProjudiDrivePdfOcrBackfillService;
import br.com.vilareal.projudi.ProjudiDrivePdfTextoDiagnosticoService;
import br.com.vilareal.projudi.ProjudiDrivePdfTextoDiagnosticoService.ItemDrivePdfTexto;
import br.com.vilareal.projudi.ProjudiOrquestradorService.ResultadoOrquestracao;
import br.com.vilareal.projudi.ProjudiPublicacaoLimpezaDiagnosticoService;
import br.com.vilareal.projudi.ProjudiSelecaoAutomaticaDiagnosticoService;
import br.com.vilareal.projudi.ProjudiSessionService;
import br.com.vilareal.projudi.ProjudiTeorService;
import br.com.vilareal.projudi.ProjudiTeorService.MovimentacaoProjudi;
import br.com.vilareal.projudi.ProjudiTokenReaderService;
import br.com.vilareal.projudi.api.dto.ProjudiCredencialResponse;
import br.com.vilareal.projudi.application.ProjudiCredencialService;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * TEMPORÁRIO - remover após validação.
 *
 * <p>Controller de diagnóstico do módulo PROJUDI. Protegido por JWT como os demais
 * controllers (cai em {@code anyRequest().authenticated()} do SecurityConfig — NÃO é público).
 * Serve para cadastrar a credencial real, validar login+OTP+parse de ponta a ponta e
 * capturar o corpo bruto da listagem de arquivos para finalizar o parser.</p>
 */
@RestController
@RequestMapping("/api/projudi/admin")
public class ProjudiDiagnosticoController {

    private static final Logger log = LoggerFactory.getLogger(ProjudiDiagnosticoController.class);

    private static final Pattern PADRAO_ID_MOVIMENTACAO =
            Pattern.compile("buscarArquivosMovimentacaoJSON\\('([^']+)'");

    private final ProjudiCredencialService credencialService;
    private final ProjudiTeorService teorService;
    private final ProjudiSessionService sessionService;
    private final ProjudiTokenReaderService tokenReader;
    private final ProjudiOrquestradorService orquestradorService;
    private final GoogleDriveService googleDriveService;
    private final ProjudiSelecaoAutomaticaDiagnosticoService selecaoAutomaticaDiagnosticoService;
    private final ProjudiPublicacaoLimpezaDiagnosticoService publicacaoLimpezaDiagnosticoService;
    private final ProjudiBackfillSubmenuDiagnosticoService backfillSubmenuDiagnosticoService;
    private final ProjudiDrivePdfTextoDiagnosticoService drivePdfTextoDiagnosticoService;
    private final ProjudiDrivePdfOcrBackfillService drivePdfOcrBackfillService;

    @Value("${gmail.credentials.path:}")
    private String gmailCredentialsPath;

    @Value("${gmail.tokens.directory:}")
    private String gmailTokensDirectory;

    @Value("${gmail.user:}")
    private String gmailUser;

    public ProjudiDiagnosticoController(ProjudiCredencialService credencialService,
                                        ProjudiTeorService teorService,
                                        ProjudiSessionService sessionService,
                                        ProjudiTokenReaderService tokenReader,
                                        ProjudiOrquestradorService orquestradorService,
                                        GoogleDriveService googleDriveService,
                                        ProjudiSelecaoAutomaticaDiagnosticoService selecaoAutomaticaDiagnosticoService,
                                        ProjudiPublicacaoLimpezaDiagnosticoService publicacaoLimpezaDiagnosticoService,
                                        ProjudiBackfillSubmenuDiagnosticoService backfillSubmenuDiagnosticoService,
                                        ProjudiDrivePdfTextoDiagnosticoService drivePdfTextoDiagnosticoService,
                                        ProjudiDrivePdfOcrBackfillService drivePdfOcrBackfillService) {
        this.credencialService = credencialService;
        this.teorService = teorService;
        this.sessionService = sessionService;
        this.tokenReader = tokenReader;
        this.orquestradorService = orquestradorService;
        this.googleDriveService = googleDriveService;
        this.selecaoAutomaticaDiagnosticoService = selecaoAutomaticaDiagnosticoService;
        this.publicacaoLimpezaDiagnosticoService = publicacaoLimpezaDiagnosticoService;
        this.backfillSubmenuDiagnosticoService = backfillSubmenuDiagnosticoService;
        this.drivePdfTextoDiagnosticoService = drivePdfTextoDiagnosticoService;
        this.drivePdfOcrBackfillService = drivePdfOcrBackfillService;
    }

    /** Cadastra/atualiza a credencial real no cofre (senha cifrada; resposta sem segredos). */
    @PostMapping("/credencial")
    public ProjudiCredencialResponse salvarCredencial(@RequestBody CredencialRequest body) {
        return credencialService.salvar(body.cpf(), body.senha(), body.rotulo());
    }

    /** Apaga a credencial do cofre (cleanup após validação). */
    @DeleteMapping("/credencial/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void excluirCredencial(@PathVariable Long id) {
        credencialService.excluir(id);
    }

    /** Consulta read-only: lista as movimentações (mostra quais têm documento + idMovimentacaoArquivo). */
    @GetMapping("/movimentacoes")
    public List<MovimentacaoProjudi> movimentacoes(@RequestParam Long credencialId,
                                                   @RequestParam String numero) {
        return teorService.listarMovimentacoes(credencialId, numero);
    }

    /** Captura o JSON BRUTO da listagem de arquivos de uma movimentação (AJAX, PaginaAtual=8). */
    @GetMapping(value = "/arquivos-raw", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> arquivosRaw(@RequestParam Long credencialId,
                                              @RequestParam String numero,
                                              @RequestParam String idMov) {
        sessionService.buscarProcessoConsulta(credencialId, numero); // garante processo selecionado na sessão
        var resp = sessionService.getAutenticadoAjax(
                credencialId,
                "MovimentacaoArquivo?AJAX=ajax&PaginaAtual=8&Id_Movimentacao=" + idMov);
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .body("status=" + resp.statusCode() + "\n" + resp.body());
    }

    /**
     * Diagnóstico: busca + listagem na MESMA chamada (hipótese de token de sessão).
     * Extrai o primeiro link buscarArquivosMovimentacaoJSON da resposta da busca e
     * chama MovimentacaoArquivo imediatamente, sem reutilizar id de outra sessão.
     */
    @GetMapping(value = "/arquivos-auto", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> arquivosAuto(@RequestParam Long credencialId,
                                               @RequestParam String numero) {
        var resp = sessionService.buscarProcessoConsulta(credencialId, numero);
        Document doc = Jsoup.parse(resp.body());
        Element link = doc.selectFirst("a[href*=buscarArquivosMovimentacaoJSON]");
        if (link == null) {
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("sem link de arquivo na primeira página");
        }
        Matcher m = PADRAO_ID_MOVIMENTACAO.matcher(link.attr("href"));
        if (!m.find()) {
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("sem link de arquivo na primeira página");
        }
        String token = m.group(1);
        var list = sessionService.getAutenticadoAjax(
                credencialId,
                "MovimentacaoArquivo?AJAX=ajax&PaginaAtual=8&Id_Movimentacao=" + token);
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .body("token=" + token + "\nstatus=" + list.statusCode() + "\n" + list.body());
    }

    /**
     * Teste de download na mesma sessão da busca: extrai o primeiro token de documento
     * e baixa os arquivos (retorna só metadados + magic bytes, não o conteúdo inteiro).
     */
    @GetMapping("/baixar-auto")
    public ResponseEntity<?> baixarAuto(@RequestParam Long credencialId,
                                        @RequestParam String numero) {
        var resp = sessionService.buscarProcessoConsulta(credencialId, numero);
        Document doc = Jsoup.parse(resp.body());
        Element link = doc.selectFirst("a[href*=buscarArquivosMovimentacaoJSON]");
        if (link == null) {
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("sem documento na primeira pagina");
        }
        Matcher m = PADRAO_ID_MOVIMENTACAO.matcher(link.attr("href"));
        if (!m.find()) {
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_PLAIN)
                    .body("sem documento na primeira pagina");
        }
        String token = m.group(1);
        List<ArquivoBaixadoResumo> resumo = teorService.baixarDocumentos(credencialId, token).stream()
                .map(a -> new ArquivoBaixadoResumo(
                        a.nomeArquivo(),
                        a.arquivoTipo(),
                        a.conteudo() == null ? 0 : a.conteudo().length,
                        magicHex(a.conteudo())))
                .toList();
        return ResponseEntity.ok(resumo);
    }

    /**
     * Testa SÓ a leitura/extração do token (sem login, sem disparar novos envios), contra um
     * e-mail de OTP já na caixa. O log [PROJUDI otp-debug] mostra candidatos/escolhido/trecho.
     */
    @GetMapping(value = "/testar-token", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> testarToken(@RequestParam(defaultValue = "240") long desdeMinutos) {
        Instant inicio = Instant.now().minus(desdeMinutos, ChronoUnit.MINUTES);
        Optional<String> token = tokenReader.aguardarToken(inicio, Duration.ofSeconds(15));
        String corpo = token.orElse("VAZIO - nenhum token extraido");
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .body(corpo);
    }

    /** Devolve o HTML cru da consulta (BUSCA + página), para descobrir por que a lista volta vazia. */
    @GetMapping(value = "/get-raw", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getRaw(@RequestParam Long credencialId,
                                         @RequestParam String numero,
                                         @RequestParam(defaultValue = "4") int pagina) {
        // Reaproveita a sessão existente (getSessao internamente; não força novo login).
        var respBusca = sessionService.buscarProcessoConsulta(credencialId, numero);
        var respPagina = sessionService.getAutenticado(credencialId, "BuscaProcesso?PaginaAtual=" + pagina);
        String corpo = "=== BUSCA status=" + respBusca.statusCode() + " ===\n" + respBusca.body()
                + "\n\n=== PAGINA " + pagina + " status=" + respPagina.statusCode() + " ===\n" + respPagina.body();
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .body(corpo);
    }

    /** Execução manual do orquestrador PROJUDI (PASSO A — dry-run por default). */
    @PostMapping("/orquestrador/run")
    public ResultadoOrquestracao runOrquestrador(
            @RequestParam Long credencialId,
            @RequestParam(defaultValue = "true") boolean dryRun,
            @RequestParam(required = false) String numero,
            @RequestParam(required = false) Integer limite,
            @RequestParam(required = false) Integer maxMovimentacoesComDoc) {
        String numeroNorm = (numero != null && !numero.isBlank()) ? numero.trim() : null;
        return orquestradorService.executar(
                credencialId, dryRun, numeroNorm, limite, maxMovimentacoesComDoc);
    }

    /** TEMP — diagnóstico da seleção automática (findParaConsultaAutomaticaProjudi). Remover após validação. */
    @GetMapping("/selecao-auto")
    public Map<String, Object> selecaoAutomaticaDiagnostico(
            @RequestParam(required = false) String numero) {
        String numeroNorm = (numero != null && !numero.isBlank()) ? numero.trim() : null;
        return selecaoAutomaticaDiagnosticoService.diagnosticar(numeroNorm);
    }

    /** TEMP — apaga publicações PROJUDI (por ids ou CNJ) para reprocessar movimentações em testes. Remover antes de produção. */
    @DeleteMapping("/publicacoes-projudi")
    public Map<String, Object> apagarPublicacoesProjudi(
            @RequestParam(required = false) String ids,
            @RequestParam(required = false) String numero) {
        return publicacaoLimpezaDiagnosticoService.apagarPublicacoesProjudi(ids, numero);
    }

    /** TEMP — backfill progressivo Drive para processos do submenu Movimentações Email (PROJUDI). Remover antes de produção. */
    @PostMapping("/backfill-submenu")
    public Map<String, Object> backfillSubmenu(
            @RequestParam(defaultValue = "3") int limite,
            @RequestParam(defaultValue = "30") int delaySegundos,
            @RequestParam(defaultValue = "true") boolean incluirMonitoramentoTjgo) {
        return backfillSubmenuDiagnosticoService.executarBackfillSubmenu(
                limite, delaySegundos, incluirMonitoramentoTjgo);
    }

    /** TEMP — extrai texto dos PDFs na pasta Movimentações do Drive (read-only). Remover após prototipar triagem. */
    @GetMapping("/drive-pdf-texto")
    public List<ItemDrivePdfTexto> drivePdfTexto(@RequestParam List<String> cnj) throws Exception {
        return drivePdfTextoDiagnosticoService.extrairTextos(cnj);
    }

    /**
     * TEMP — backfill OCR em todos os PDFs da pasta Movimentações (Drive only).
     * Padrão: {@code --skip-text}. {@code redoOcr=true}: {@code --redo-ocr} (reprocessa OCR antigo).
     * {@code cnj=…} repetível ou {@code todos=true} (opcional {@code limite}).
     */
    @PostMapping("/ocr-backfill")
    public Map<String, Object> ocrBackfill(
            @RequestParam(required = false) List<String> cnj,
            @RequestParam(defaultValue = "false") boolean todos,
            @RequestParam(defaultValue = "50") int limite,
            @RequestParam(defaultValue = "false") boolean redoOcr) throws Exception {
        return drivePdfOcrBackfillService.executar(cnj, todos, limite, redoOcr);
    }

    /** TEMP — diagnóstico Google Drive (credencial, metadados de pastas, Shared Drives). Remover após validação. */
    @GetMapping("/drive-diag")
    public Map<String, Object> driveDiagnostico() {
        Map<String, Object> out = new LinkedHashMap<>(googleDriveService.executarDiagnosticoDriveApi());
        out.put("autenticacaoGmail", montarAutenticacaoGmailDiagnostico());
        return out;
    }

    private Map<String, Object> montarAutenticacaoGmailDiagnostico() {
        Map<String, Object> gmail = new LinkedHashMap<>();
        gmail.put("tipoCredencial", "oauth_usuario (installed app)");
        gmail.put("credentialsPathConfig", gmailCredentialsPath);
        gmail.put("tokensDirectoryConfig", gmailTokensDirectory);
        gmail.put("gmailUserConfig", gmailUser);
        gmail.put("escoposConfigurados", List.of("https://www.googleapis.com/auth/gmail.modify"));
        gmail.put("escoposDrive", List.of());
        gmail.put("conta",
                "Chave OAuth no token store: \""
                        + gmailUser
                        + "\" (valor literal de gmail.user; não é necessariamente o e-mail). "
                        + "Tokens em "
                        + gmailTokensDirectory
                        + ". Separado do Google Drive — sem escopo Drive.");
        return gmail;
    }

    /** Diagnóstico: devolve a mensagem do erro (inclui o corpo bruto quando houver) com status 500. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> tratarErro(Exception e) {
        log.warn("Falha no diagnóstico PROJUDI: {}", e.getMessage());
        String msg = e.getClass().getSimpleName() + ": " + e.getMessage();
        return ResponseEntity.status(500)
                .contentType(MediaType.TEXT_PLAIN)
                .body(msg);
    }

    /** Corpo do cadastro de credencial. */
    public record CredencialRequest(String cpf, String senha, String rotulo) {
    }

    /** Resumo de arquivo baixado (sem conteúdo binário). */
    public record ArquivoBaixadoResumo(String nomeArquivo, String arquivoTipo, int tamanho, String magic) {
    }

    private static String magicHex(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            return "";
        }
        int n = Math.min(8, bytes.length);
        StringBuilder sb = new StringBuilder(n * 2);
        for (int i = 0; i < n; i++) {
            sb.append(String.format("%02x", bytes[i]));
        }
        return sb.toString();
    }
}
