package br.com.vilareal.documento;

import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/documentos")
public class DocumentoController {

    private static final Logger log = LoggerFactory.getLogger(DocumentoController.class);

    private final DocumentoPdfService pdfService;
    private final PeticaoAiService peticaoAiService;
    private final ProcuracaoService procuracaoService;
    private final ContratoHonorariosService contratoHonorariosService;
    private final ContratoHonorariosPersistenciaService contratoHonorariosPersistenciaService;
    private final ContratoAluguelService contratoAluguelService;
    private final ContratoLocacaoDocumentoService contratoLocacaoDocumentoService;
    private final GoogleDriveService googleDriveService;
    private final DocumentoDrivePastaService documentoDrivePastaService;
    private final DocumentoArquivoImportacaoService arquivoImportacaoService;
    private final DocumentoReformatarService reformatarService;
    private final PeticaoExecucaoService peticaoExecucaoService;
    private final PeticaoHomologacaoAcordoService peticaoHomologacaoAcordoService;
    private final DocumentoPastaAssinarService pastaAssinarService;

    public DocumentoController(
            DocumentoPdfService pdfService,
            PeticaoAiService peticaoAiService,
            ProcuracaoService procuracaoService,
            ContratoHonorariosService contratoHonorariosService,
            ContratoHonorariosPersistenciaService contratoHonorariosPersistenciaService,
            ContratoAluguelService contratoAluguelService,
            ContratoLocacaoDocumentoService contratoLocacaoDocumentoService,
            GoogleDriveService googleDriveService,
            DocumentoDrivePastaService documentoDrivePastaService,
            DocumentoArquivoImportacaoService arquivoImportacaoService,
            DocumentoReformatarService reformatarService,
            PeticaoExecucaoService peticaoExecucaoService,
            PeticaoHomologacaoAcordoService peticaoHomologacaoAcordoService,
            DocumentoPastaAssinarService pastaAssinarService) {
        this.pdfService = pdfService;
        this.peticaoAiService = peticaoAiService;
        this.procuracaoService = procuracaoService;
        this.contratoHonorariosService = contratoHonorariosService;
        this.contratoHonorariosPersistenciaService = contratoHonorariosPersistenciaService;
        this.contratoAluguelService = contratoAluguelService;
        this.contratoLocacaoDocumentoService = contratoLocacaoDocumentoService;
        this.googleDriveService = googleDriveService;
        this.documentoDrivePastaService = documentoDrivePastaService;
        this.arquivoImportacaoService = arquivoImportacaoService;
        this.reformatarService = reformatarService;
        this.peticaoExecucaoService = peticaoExecucaoService;
        this.peticaoHomologacaoAcordoService = peticaoHomologacaoAcordoService;
        this.pastaAssinarService = pastaAssinarService;
    }

    @PostMapping("/gerar-pdf")
    public ResponseEntity<byte[]> gerarPdf(
            @RequestBody DocumentoGerarRequest request,
            @RequestParam(value = "preview", required = false, defaultValue = "false") boolean preview) {
        byte[] pdf = pdfService.gerarPeticaoPdf(request);
        LocalDate data = request.data() != null ? request.data() : LocalDate.now();
        String nomeArquivo = DocumentoDrivePastaService.formatarNomeArquivoPeticao("Peticao", data);
        if (!preview) {
            salvarPeticaoGeradaNoDriveAsync(request.processoId(), null, null, pdf, nomeArquivo);
        }
        return respostaPdf(nomeArquivo, pdf, preview);
    }

    @PostMapping("/gerar-pdf-ia")
    public ResponseEntity<byte[]> gerarPdfComIA(@RequestBody PeticaoAiRequest request) {
        DocumentoGerarRequest documentoRequest = peticaoAiService.gerarConteudoPeticao(request);
        byte[] pdf = pdfService.gerarPeticaoPdf(documentoRequest);
        LocalDate data = request.data() != null ? request.data() : LocalDate.now();
        String nomeArquivo = DocumentoDrivePastaService.formatarNomeArquivoPeticao(request.tipoPeca(), data);
        salvarPeticaoGeradaNoDriveAsync(
                request.processoId(),
                request.codigoCliente(),
                request.numeroInterno(),
                pdf,
                nomeArquivo);
        return respostaPdf(nomeArquivo, pdf);
    }

    @PostMapping("/gerar-conteudo-ia")
    public ResponseEntity<DocumentoGerarRequest> gerarConteudoComIA(@RequestBody PeticaoAiRequest request) {
        DocumentoGerarRequest documentoRequest = peticaoAiService.gerarConteudoPeticao(request);
        return ResponseEntity.ok(documentoRequest);
    }

    @PostMapping("/reformatar")
    public ResponseEntity<byte[]> reformatar(
            @RequestParam("arquivo") MultipartFile arquivo,
            @RequestParam(value = "enderecamento", required = false) String enderecamento,
            @RequestParam(value = "numeroProcesso", required = false) String numeroProcesso,
            @RequestParam(value = "cidadeEstado", required = false) String cidadeEstado,
            @RequestParam(value = "data", required = false) String data,
            @RequestParam(value = "codigoCliente", required = false) String codigoCliente,
            @RequestParam(value = "numeroInterno", required = false) Integer numeroInterno,
            @RequestParam(value = "processoId", required = false) Long processoId,
            @RequestParam(value = "preview", required = false, defaultValue = "false") boolean preview)
            throws Exception {
        return responderReformatacao(
                arquivo,
                enderecamento,
                numeroProcesso,
                cidadeEstado,
                data,
                codigoCliente,
                numeroInterno,
                processoId,
                preview);
    }

    @PostMapping("/reformatar/conteudo")
    public ResponseEntity<DocumentoReformatarConteudoRequest> extrairConteudoReformatar(
            @RequestParam("arquivo") MultipartFile arquivo,
            @RequestParam(value = "enderecamento", required = false) String enderecamento,
            @RequestParam(value = "numeroProcesso", required = false) String numeroProcesso,
            @RequestParam(value = "cidadeEstado", required = false) String cidadeEstado,
            @RequestParam(value = "data", required = false) String data,
            @RequestParam(value = "processoId", required = false) Long processoId)
            throws Exception {
        DocumentoReformatarConteudoRequest conteudo =
                reformatarService.extrairConteudo(arquivo, enderecamento, numeroProcesso, cidadeEstado, data, processoId);
        return ResponseEntity.ok(reformatarService.enriquecerComCorpoUnico(conteudo));
    }

    @PostMapping("/reformatar/gerar-pdf")
    public ResponseEntity<byte[]> gerarPdfReformatado(
            @RequestBody DocumentoReformatarConteudoRequest conteudo,
            @RequestParam(value = "nomeArquivo", required = false) String nomeArquivo,
            @RequestParam(value = "codigoCliente", required = false) String codigoCliente,
            @RequestParam(value = "numeroInterno", required = false) Integer numeroInterno,
            @RequestParam(value = "processoId", required = false) Long processoId,
            @RequestParam(value = "preview", required = false, defaultValue = "false") boolean preview) {
        byte[] pdf = reformatarService.gerarPdfFromConteudo(conteudo);
        LocalDate dataDoc = LocalDate.now();
        if (conteudo.data() != null && !conteudo.data().isBlank()) {
            try {
                dataDoc = LocalDate.parse(conteudo.data().trim());
            } catch (Exception ignored) {
                // mantém hoje
            }
        }
        String nomeSaida = nomeArquivo != null && !nomeArquivo.isBlank()
                ? nomeArquivo.replaceAll("[^a-zA-Z0-9._\\- ]", "_")
                : DocumentoDrivePastaService.formatarNomeArquivoPeticao("Documento_Formatado", dataDoc);
        if (!preview) {
            salvarPeticaoGeradaNoDriveAsync(processoId, codigoCliente, numeroInterno, pdf, nomeSaida);
        }
        return respostaPdf(nomeSaida, pdf, preview);
    }

    @PostMapping("/reformatar/inserir-pasta-assinar")
    public ResponseEntity<DocumentoInserirPastaAssinarResponse> inserirReformatadoNaPastaAssinar(
            @RequestBody DocumentoReformatarConteudoRequest conteudo,
            @RequestParam(value = "nomeArquivo", required = false) String nomeArquivo,
            @RequestParam(value = "codigoCliente", required = false) String codigoCliente,
            @RequestParam(value = "numeroInterno", required = false) Integer numeroInterno,
            @RequestParam(value = "processoId", required = false) Long processoId) {
        byte[] pdf = reformatarService.gerarPdfFromConteudo(conteudo);
        LocalDate dataDoc = LocalDate.now();
        if (conteudo.data() != null && !conteudo.data().isBlank()) {
            try {
                dataDoc = LocalDate.parse(conteudo.data().trim());
            } catch (Exception ignored) {
                // mantém hoje
            }
        }
        String nomeSaida = nomeArquivo != null && !nomeArquivo.isBlank()
                ? nomeArquivo.replaceAll("[^a-zA-Z0-9._\\- ]", "_")
                : DocumentoDrivePastaService.formatarNomeArquivoPeticao("Documento_Formatado", dataDoc);
        DocumentoInserirPastaAssinarResponse resp =
                pastaAssinarService.inserirPdf(processoId, codigoCliente, numeroInterno, pdf, nomeSaida);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/formatar-arquivo")
    public ResponseEntity<byte[]> formatarArquivo(
            @RequestParam("arquivo") MultipartFile arquivo,
            @RequestParam(value = "enderecamento", required = false) String enderecamento,
            @RequestParam(value = "numeroProcesso", required = false) String numeroProcesso,
            @RequestParam(value = "cidadeEstado", required = false) String cidadeEstado,
            @RequestParam(value = "data", required = false) String data,
            @RequestParam(value = "codigoCliente", required = false) String codigoCliente,
            @RequestParam(value = "numeroInterno", required = false) Integer numeroInterno,
            @RequestParam(value = "processoId", required = false) Long processoId,
            @RequestParam(value = "preview", required = false, defaultValue = "false") boolean preview)
            throws Exception {
        return responderReformatacao(
                arquivo,
                enderecamento,
                numeroProcesso,
                cidadeEstado,
                data,
                codigoCliente,
                numeroInterno,
                processoId,
                preview);
    }

    private ResponseEntity<byte[]> responderReformatacao(
            MultipartFile arquivo,
            String enderecamento,
            String numeroProcesso,
            String cidadeEstado,
            String data,
            String codigoCliente,
            Integer numeroInterno,
            Long processoId,
            boolean preview)
            throws Exception {
        byte[] pdf = reformatarService.reformatar(arquivo, enderecamento, numeroProcesso, cidadeEstado, data, processoId);
        LocalDate dataDoc = LocalDate.now();
        if (data != null && !data.isBlank()) {
            try {
                dataDoc = LocalDate.parse(data.trim());
            } catch (Exception ignored) {
                // mantém hoje
            }
        }
        String nomeSaida = nomePdfReformatado(arquivo.getOriginalFilename(), dataDoc);
        if (!preview) {
            salvarPeticaoGeradaNoDriveAsync(processoId, codigoCliente, numeroInterno, pdf, nomeSaida);
        }
        return respostaPdf(nomeSaida, pdf, preview);
    }

    private static String nomePdfReformatado(String nomeOriginal, LocalDate data) {
        if (nomeOriginal != null && !nomeOriginal.isBlank()) {
            String base = nomeOriginal.replaceAll("(?i)\\.(docx|pdf)$", "") + "_formatado.pdf";
            return base.replaceAll("[^a-zA-Z0-9._\\- ]", "_");
        }
        return DocumentoDrivePastaService.formatarNomeArquivoPeticao("Documento_Formatado", data);
    }

    @PostMapping("/procuracao")
    public ResponseEntity<byte[]> gerarProcuracao(@RequestBody ProcuracaoRequest request) {
        byte[] pdf = procuracaoService.gerarProcuracao(request);
        LocalDate data = request.data() != null ? request.data() : LocalDate.now();
        String nomePessoa = documentoDrivePastaService.resolverNomePessoa(request.pessoaId());
        String nomeArquivo = DocumentoDrivePastaService.formatarNomeArquivoProcuracao(nomePessoa, data);
        salvarPdfNoDriveAsync(
                pdf,
                nomeArquivo,
                request.codigoCliente(),
                request.numeroInterno(),
                request.pessoaId(),
                TipoDocumento.PROCURACAO);
        return respostaPdf(nomeArquivo, pdf);
    }

    @PostMapping("/contrato-honorarios/clausula3-texto")
    public ContratoHonorariosClausula3TextoResponse montarClausula3Texto(
            @RequestBody ContratoHonorariosClausula3TextoRequest request) {
        return new ContratoHonorariosClausula3TextoResponse(contratoHonorariosService.montarClausula3Texto(request));
    }

    @PostMapping("/contrato-honorarios/preview-conteudo")
    public ContratoHonorariosConteudoPreview previewConteudoContratoHonorarios(
            @RequestBody ContratoHonorariosRequest request) {
        return contratoHonorariosService.montarConteudoPreview(request);
    }

    @PostMapping("/contrato-honorarios/preview-pdf")
    public ResponseEntity<byte[]> previewPdfContratoHonorarios(
            @RequestBody ContratoHonorariosPreviewPdfRequest request) {
        byte[] pdf = contratoHonorariosService.gerarPdfPreview(request);
        return respostaPdf("contrato_honorarios_preview.pdf", pdf, true);
    }

    @GetMapping("/contratos-honorarios")
    public List<ContratoHonorariosResumoResponse> listarContratosHonorarios(
            @RequestParam(required = false) Long processoId,
            @RequestParam(required = false) Long pessoaId,
            @RequestParam(required = false) LocalDate de,
            @RequestParam(required = false) LocalDate ate) {
        return contratoHonorariosPersistenciaService.listar(processoId, pessoaId, de, ate);
    }

    @GetMapping("/contratos-honorarios/sugestoes-financeiro")
    public List<ContratoHonorariosSugestaoFinanceiroResponse> listarSugestoesFinanceiroHonorarios(
            @RequestParam(required = false) Long processoId,
            @RequestParam(required = false) Long pessoaId,
            @RequestParam(required = false) LocalDate de,
            @RequestParam(required = false) LocalDate ate) {
        return contratoHonorariosPersistenciaService.listarSugestoesFinanceiro(processoId, pessoaId, de, ate);
    }

    @PostMapping("/contratos-honorarios/sugestoes-financeiro/aprovar")
    public ContratoHonorariosAprovarSugestaoResponse aprovarSugestaoFinanceiroHonorarios(
            @Valid @RequestBody ContratoHonorariosAprovarSugestaoRequest request) {
        return contratoHonorariosPersistenciaService.aprovarSugestaoFinanceiro(request);
    }

    @GetMapping("/contrato-honorarios/processo/{processoId}")
    public ResponseEntity<ContratoHonorariosProcessoResponse> buscarContratoHonorariosProcesso(
            @PathVariable Long processoId) {
        ContratoHonorariosProcessoResponse resp = contratoHonorariosService.buscarContratacaoProcesso(processoId);
        return resp != null ? ResponseEntity.ok(resp) : ResponseEntity.notFound().build();
    }

    @PutMapping("/contrato-honorarios/processo/{processoId}")
    public ContratoHonorariosProcessoResponse salvarContratoHonorariosProcesso(
            @PathVariable Long processoId, @RequestBody ContratoHonorariosRequest request) {
        return contratoHonorariosService.salvarContratacaoProcesso(processoId, request);
    }

    @PostMapping("/contrato-honorarios")
    public ResponseEntity<byte[]> gerarContratoHonorarios(@RequestBody ContratoHonorariosRequest request) {
        byte[] pdf = contratoHonorariosService.gerarContrato(request);
        LocalDate data = request.data() != null ? request.data() : LocalDate.now();
        String nomePessoa = documentoDrivePastaService.resolverNomePessoa(request.pessoaId());
        String nomeArquivo = DocumentoDrivePastaService.formatarNomeArquivoContrato(nomePessoa, data);
        salvarPdfNoDriveAsync(
                pdf,
                nomeArquivo,
                request.codigoCliente(),
                request.numeroInterno(),
                request.pessoaId(),
                TipoDocumento.CONTRATO);
        return respostaPdf(nomeArquivo, pdf);
    }

    @PostMapping("/contrato-aluguel")
    public ResponseEntity<byte[]> gerarContratoAluguel(@RequestBody ContratoAluguelRequest request) {
        byte[] pdf = contratoAluguelService.gerarContrato(request);
        LocalDate data = request.data() != null ? request.data() : LocalDate.now();
        String nomeArquivo = DocumentoDrivePastaService.formatarNomeArquivoContrato(
                "Contrato Aluguel", "Processo " + request.processoId(), data);
        salvarPdfNoDriveAsync(
                pdf,
                nomeArquivo,
                request.codigoCliente(),
                request.numeroInterno(),
                null,
                TipoDocumento.CONTRATO);
        return respostaPdf(nomeArquivo, pdf);
    }

    @PostMapping("/contrato-locacao/preview-conteudo")
    public ContratoLocacaoConteudoPreview previewConteudoContratoLocacao(@RequestBody ContratoLocacaoRequest request) {
        return contratoLocacaoDocumentoService.montarConteudoPreview(request);
    }

    @PostMapping("/contrato-locacao/preview-pdf")
    public ResponseEntity<byte[]> previewPdfContratoLocacao(@RequestBody ContratoLocacaoPreviewPdfRequest request) {
        byte[] pdf = contratoLocacaoDocumentoService.gerarPdfPreview(request);
        return respostaPdf("contrato_locacao_preview.pdf", pdf, true);
    }

    @PostMapping("/contrato-locacao")
    public ResponseEntity<byte[]> gerarContratoLocacao(@RequestBody ContratoLocacaoRequest request) {
        byte[] pdf = contratoLocacaoDocumentoService.gerarContrato(request);
        LocalDate data = request.data() != null ? request.data() : LocalDate.now();
        String nomeArquivo = DocumentoDrivePastaService.formatarNomeArquivoContrato(
                "Contrato Locacao", "Contrato " + request.contratoLocacaoId(), data);
        salvarPdfNoDriveAsync(
                pdf,
                nomeArquivo,
                request.codigoCliente(),
                request.numeroInterno(),
                null,
                TipoDocumento.CONTRATO);
        return respostaPdf(nomeArquivo, pdf);
    }

    @PostMapping("/gerar-pdf-teste")
    @Profile("dev")
    public ResponseEntity<byte[]> gerarPdfTeste() {
        return gerarPdf(criarExemplo(), true);
    }

    @PostMapping("/gerar-pdf-ia-teste")
    @Profile("dev")
    public ResponseEntity<byte[]> gerarPdfIATeste() {
        return gerarPdfComIA(criarExemploIA());
    }

    @PostMapping("/peticao-execucao")
    public ResponseEntity<byte[]> peticaoExecucao(@RequestBody PeticaoExecucaoRequest request) {
        byte[] pdf = peticaoExecucaoService.gerar(request);
        LocalDate data = request != null && request.data() != null ? request.data() : LocalDate.now();
        String nomeArquivo = DocumentoDrivePastaService.formatarNomeArquivoPeticao("Execucao", data);
        salvarPdfNoDriveAsync(pdf, nomeArquivo, null, null, null, TipoDocumento.PETICAO);
        return respostaPdf(nomeArquivo, pdf, false);
    }

    @PostMapping("/peticao-homologacao-acordo/preview-conteudo")
    public PeticaoHomologacaoAcordoConteudoPreview previewConteudoPeticaoHomologacaoAcordo(
            @RequestBody PeticaoHomologacaoAcordoRequest request) {
        return peticaoHomologacaoAcordoService.montarConteudoPreview(request);
    }

    @PostMapping("/peticao-homologacao-acordo/preview-pdf")
    public ResponseEntity<byte[]> previewPdfPeticaoHomologacaoAcordo(
            @RequestBody PeticaoHomologacaoAcordoPreviewPdfRequest request) {
        byte[] pdf = peticaoHomologacaoAcordoService.gerarPdfPreview(request);
        return respostaPdf("01.Homologatoria de Acordo_preview.pdf", pdf, true);
    }

    @PostMapping("/peticao-homologacao-acordo")
    public ResponseEntity<byte[]> peticaoHomologacaoAcordo(
            @RequestBody PeticaoHomologacaoAcordoRequest request,
            @RequestParam(value = "preview", required = false, defaultValue = "false") boolean preview) {
        byte[] pdf = peticaoHomologacaoAcordoService.gerar(request);
        String nomeArquivo = "01.Homologatoria de Acordo.pdf";
        if (!preview) {
            salvarPdfNoDriveAsync(pdf, nomeArquivo, null, null, null, TipoDocumento.PETICAO);
        }
        return respostaPdf(nomeArquivo, pdf, preview);
    }

    /**
     * Exemplo visual (dev) da petição de execução de taxa condominial: monta variáveis fake cobrindo
     * todas as classes do corpo e realces, gera o PDF pelo template novo e salva em
     * {@code /tmp/peticao_execucao_exemplo.pdf}.
     */
    @PostMapping("/peticao-execucao-exemplo")
    @Profile("dev")
    public ResponseEntity<byte[]> peticaoExecucaoExemplo() {
        java.util.Map<String, Object> vars = new java.util.HashMap<>();
        vars.put("advogadoNome", "Dr. Itamar Alexandre Felix Villa Real Junior");
        vars.put("advogadoOab", "OAB/GO 33.329");
        vars.put(
                "enderecamentoHtml",
                "Excelentíssimo Senhor Doutor Juiz de Direito da ___ Vara Cível da Comarca de Anápolis - GO");
        vars.put(
                "qualificacaoCabecalhoHtml",
                "<strong>CONDOMÍNIO RESIDENCIAL EXEMPLO</strong>, pessoa jurídica de direito privado, "
                        + "inscrito no CNPJ sob o nº 00.000.000/0001-00, com sede na Av. Exemplo, nº 100, "
                        + "Anápolis-GO, vem, respeitosamente, à presença de Vossa Excelência, por seu advogado "
                        + "que esta subscreve, propor a presente <strong>AÇÃO DE EXECUÇÃO DE TÍTULO EXECUTIVO "
                        + "EXTRAJUDICIAL</strong> em face de <strong>FULANO DE TAL</strong>, brasileiro, solteiro, "
                        + "inscrito no CPF sob o nº 000.000.000-00, residente e domiciliado na Rua Exemplo, nº 200, "
                        + "Anápolis-GO, pelos fatos e fundamentos a seguir expostos:");
        vars.put(
                "corpoHtml",
                "<p class=\"titulo\">DOS FATOS:</p>"
                        + "<p class=\"subtitulo\">Da obrigação <em>propter rem</em> do condômino</p>"
                        + "<p class=\"paragrafo\">O Executado é <strong>proprietário</strong> da unidade autônoma "
                        + "constituída pelo <span class=\"fundo-amarelo\">Apto 101, Bloco A</span>, integrante do "
                        + "condomínio Exequente, e encontra-se <u>inadimplente</u> quanto às taxas condominiais "
                        + "vencidas e não pagas.</p>"
                        + "<p class=\"paragrafo\">A importância total do débito perfaz "
                        + "<strong><u>R$ 12.345,67</u></strong> (doze mil, trezentos e quarenta e cinco reais e "
                        + "sessenta e sete centavos), conforme planilha anexa.</p>"
                        + "<p class=\"subtitulo\">Do título executivo extrajudicial</p>"
                        + "<p class=\"paragrafo\">Os títulos encontram-se devidamente <span class=\"txt-vermelho\">"
                        + "acostados</span> aos autos, revestindo-se de certeza, liquidez e exigibilidade.</p>"
                        + "<p class=\"recuado\">Art. 1.336. São deveres do condômino: I - contribuir para as despesas "
                        + "do condomínio na proporção das suas frações ideais, salvo disposição em contrário na "
                        + "convenção.</p>"
                        + "<p class=\"titulo\">DO DIREITO:</p>"
                        + "<p class=\"paragrafo\">A cobrança encontra amparo no art. 784, X, do CPC, que confere "
                        + "natureza de título executivo extrajudicial ao crédito referente às contribuições "
                        + "condominiais, <span class=\"fundo-azul-claro\">conforme previsto na convenção</span>.</p>"
                        + "<p class=\"titulo\">DOS PEDIDOS:</p>"
                        + "<p class=\"pedido\">Seja o Executado citado para, no prazo de 3 (três) dias, efetuar o "
                        + "pagamento da dívida, sob pena de penhora (art. 829 do CPC);</p>"
                        + "<p class=\"pedido\">A condenação do Executado ao pagamento das custas processuais e "
                        + "honorários advocatícios, ora fixados em <span class=\"fundo-laranja\">10% sobre o valor "
                        + "da execução</span>.</p>");
        vars.put(
                "fechoHtml",
                "<p style=\"text-indent:0;margin:0;\">Nestes termos,</p>"
                        + "<p style=\"text-indent:0;margin:0 0 18pt 0;\">pede deferimento.</p>"
                        + "<p style=\"text-align:center;margin:0 0 36pt 0;\">Anápolis, estado de Goiás, "
                        + "9 de junho de 2026.</p>"
                        + "<p style=\"text-align:center;margin:0;font-weight:bold;\">Dr. ITAMAR ALEXANDRE FÉLIX "
                        + "VILLA REAL JÚNIOR</p>"
                        + "<p style=\"text-align:center;margin:0;font-weight:bold;\">OAB/GO n° 33.329</p>");

        byte[] pdf = pdfService.gerarPdfDeTemplate("documentos/peticao-execucao", vars);
        try {
            java.nio.file.Files.write(java.nio.file.Path.of("/tmp/peticao_execucao_exemplo.pdf"), pdf);
            log.info("PDF de exemplo salvo em /tmp/peticao_execucao_exemplo.pdf ({} bytes)", pdf.length);
        } catch (java.io.IOException e) {
            log.warn("Não foi possível salvar o PDF de exemplo em /tmp", e);
        }
        return respostaPdf("peticao_execucao_exemplo.pdf", pdf, true);
    }

    private void salvarPeticaoGeradaNoDriveAsync(
            Long processoId, String codigoCliente, Integer numeroInterno, byte[] pdf, String nomeArquivo) {
        CompletableFuture.runAsync(() -> {
            if (!googleDriveService.isConfigurado()) {
                return;
            }
            if (!temContextoProcesso(processoId, codigoCliente, numeroInterno)) {
                salvarPdfNoDriveAsync(pdf, nomeArquivo, codigoCliente, numeroInterno, null, TipoDocumento.PETICAO);
                return;
            }
            try {
                pastaAssinarService.inserirPdf(processoId, codigoCliente, numeroInterno, pdf, nomeArquivo);
            } catch (Exception e) {
                log.warn(
                        "Erro ao salvar petição em Petições/Assinar (processoId={}, cliente={}, proc={}): {}",
                        processoId,
                        codigoCliente,
                        numeroInterno,
                        e.getMessage());
            }
        });
    }

    static boolean temContextoProcesso(Long processoId, String codigoCliente, Integer numeroInterno) {
        if (processoId != null && processoId > 0) {
            return true;
        }
        return StringUtils.hasText(codigoCliente) && numeroInterno != null && numeroInterno >= 0;
    }

    private void salvarPdfNoDriveAsync(
            byte[] pdf,
            String nomeArquivo,
            String codigoCliente,
            Integer numeroInterno,
            Long pessoaIdFallback,
            TipoDocumento tipoDocumento) {
        CompletableFuture.runAsync(() -> {
            if (!googleDriveService.isConfigurado()) {
                return;
            }
            try {
                String pastaId = documentoDrivePastaService.resolverPastaDestino(
                        googleDriveService,
                        codigoCliente,
                        numeroInterno,
                        pessoaIdFallback,
                        tipoDocumento);
                googleDriveService.salvarPdfEmPasta(pdf, nomeArquivo, pastaId);
            } catch (Exception e) {
                log.warn("Erro ao salvar no Drive: {}", e.getMessage());
            }
        });
    }

    private static ResponseEntity<byte[]> respostaPdf(String nomeArquivo, byte[] pdf) {
        return respostaPdf(nomeArquivo, pdf, false);
    }

    private static ResponseEntity<byte[]> respostaPdf(String nomeArquivo, byte[] pdf, boolean inline) {
        String disposition = inline ? "inline" : "attachment";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"" + nomeArquivo + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    private static DocumentoGerarRequest criarExemplo() {
        return new DocumentoGerarRequest(
                "MERITÍSSIMO JUÍZO DO 3º JUIZADO ESPECIAL CÍVEL DA COMARCA DE ANÁPOLIS - GO",
                "5099999-00.2026.8.09.0007",
                "<strong>FULANO DE TAL</strong>, brasileiro, solteiro, empresário, "
                        + "inscrito no CPF sob o nº 000.000.000-00, residente e domiciliado na "
                        + "Rua Exemplo, nº 100, Bairro Centro, Anápolis-GO, CEP 75.000-000, "
                        + "vem respeitosamente à presença de Vossa Excelência, por seu advogado "
                        + "que esta subscreve, propor a presente <strong>AÇÃO DE INDENIZAÇÃO POR DANOS MORAIS</strong> "
                        + "em face de <strong>EMPRESA EXEMPLO LTDA</strong>, pessoa jurídica de direito privado, "
                        + "inscrita no CNPJ sob o nº 00.000.000/0001-00, com sede na Av. Teste, nº 200, "
                        + "Anápolis-GO, pelos fatos e fundamentos a seguir expostos:",
                List.of(
                        new DocumentoGerarRequest.SecaoPeticao(
                                "DOS FATOS",
                                "<p>O Autor adquiriu em 10/01/2026 o produto X junto à empresa Ré, "
                                        + "pelo valor de R$ 5.000,00 (cinco mil reais).</p>"
                                        + "<p>Ocorre que, após apenas 15 dias de uso, o produto apresentou defeito "
                                        + "de fabricação, tornando-se inutilizável.</p>"
                                        + "<p>Diante disso, o Autor entrou em contato com a Ré por diversas vezes, "
                                        + "sem obter solução para o problema, configurando verdadeiro descaso "
                                        + "com o consumidor.</p>"),
                        new DocumentoGerarRequest.SecaoPeticao(
                                "DO DIREITO",
                                "<p>A responsabilidade da Ré é objetiva, conforme dispõe o art. 14 "
                                        + "do Código de Defesa do Consumidor.</p>"
                                        + "<p>O dano moral restou configurado pela frustração, angústia e "
                                        + "transtornos sofridos pelo Autor, que ultrapassam o mero "
                                        + "aborrecimento cotidiano.</p>")),
                List.of(
                        "A inversão do ônus da prova, nos termos do art. 6º, VIII, do CDC;",
                        "A condenação da Ré ao pagamento de indenização por danos morais no valor de R$ 10.000,00 (dez mil reais);",
                        "A condenação da Ré ao pagamento das custas processuais e honorários advocatícios."),
                "Anápolis, estado de Goiás",
                LocalDate.now(),
                null);
    }

    private static PeticaoAiRequest criarExemploIA() {
        return new PeticaoAiRequest(
                "MERITÍSSIMO JUÍZO DO 3º JUIZADO ESPECIAL CÍVEL DA COMARCA DE ANÁPOLIS - GO",
                null,
                "PETIÇÃO INICIAL DE INDENIZAÇÃO POR DANOS MORAIS E MATERIAIS",
                "MARIA OLIVEIRA SANTOS",
                "brasileira, solteira, vendedora, inscrita no CPF sob o nº 000.000.000-00, "
                        + "residente e domiciliada na Rua das Flores, nº 150, Bairro Jundiaí, "
                        + "Anápolis-GO, CEP 75.110-000",
                "LOJA ELETRO MEGA LTDA",
                "pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 00.000.000/0001-00, "
                        + "com sede na Av. Brasil, nº 500, Centro, Anápolis-GO",
                """
                        A autora adquiriu um notebook da marca XYZ no dia 15/03/2026, pelo valor de
                        R$ 4.500,00, na loja física da ré em Anápolis. Após 10 dias de uso, o aparelho
                        apresentou defeito na tela (manchas escuras e pixels mortos). A autora retornou
                        à loja e foi informada de que deveria enviar o produto para a assistência técnica
                        do fabricante, sem oferecer qualquer solução imediata. Após 45 dias sem retorno
                        da assistência e sem o produto, a autora voltou à loja e exigiu a troca ou
                        devolução do dinheiro, sendo tratada com descaso e grosseria pelo gerente.
                        A autora registrou reclamação no Procon (protocolo nº 2026/12345) sem resolução.
                        Até a presente data (90 dias após a compra), a autora segue sem o notebook
                        e sem o reembolso.
                        """,
                "Aplicar a teoria do desvio produtivo do consumidor (Marcos Dessaune). "
                        + "Responsabilidade objetiva do fornecedor (art. 14 CDC).",
                "4.500,00",
                List.of(
                        "A inversão do ônus da prova, nos termos do art. 6º, VIII, do CDC",
                        "A devolução integral do valor pago (R$ 4.500,00) a título de danos materiais",
                        "A condenação ao pagamento de indenização por danos morais",
                        "A condenação ao pagamento das custas processuais e honorários advocatícios"),
                null,
                null,
                "Anápolis, estado de Goiás",
                LocalDate.now(),
                "00000001",
                1,
                null);
    }
}
