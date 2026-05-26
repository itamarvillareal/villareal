package br.com.vilareal.documento;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
    private final GoogleDriveService googleDriveService;
    private final DocumentoDrivePastaService documentoDrivePastaService;
    private final DocumentoArquivoImportacaoService arquivoImportacaoService;
    private final DocumentoReformatarService reformatarService;

    public DocumentoController(
            DocumentoPdfService pdfService,
            PeticaoAiService peticaoAiService,
            ProcuracaoService procuracaoService,
            GoogleDriveService googleDriveService,
            DocumentoDrivePastaService documentoDrivePastaService,
            DocumentoArquivoImportacaoService arquivoImportacaoService,
            DocumentoReformatarService reformatarService) {
        this.pdfService = pdfService;
        this.peticaoAiService = peticaoAiService;
        this.procuracaoService = procuracaoService;
        this.googleDriveService = googleDriveService;
        this.documentoDrivePastaService = documentoDrivePastaService;
        this.arquivoImportacaoService = arquivoImportacaoService;
        this.reformatarService = reformatarService;
    }

    @PostMapping("/gerar-pdf")
    public ResponseEntity<byte[]> gerarPdf(@RequestBody DocumentoGerarRequest request) {
        byte[] pdf = pdfService.gerarPeticaoPdf(request);
        LocalDate data = request.data() != null ? request.data() : LocalDate.now();
        String nomeArquivo = DocumentoDrivePastaService.formatarNomeArquivoPeticao("Peticao", data);
        salvarPdfNoDriveAsync(pdf, nomeArquivo, null, null, null, TipoDocumento.PETICAO);
        return respostaPdf(nomeArquivo, pdf);
    }

    @PostMapping("/gerar-pdf-ia")
    public ResponseEntity<byte[]> gerarPdfComIA(@RequestBody PeticaoAiRequest request) {
        DocumentoGerarRequest documentoRequest = peticaoAiService.gerarConteudoPeticao(request);
        byte[] pdf = pdfService.gerarPeticaoPdf(documentoRequest);
        LocalDate data = request.data() != null ? request.data() : LocalDate.now();
        String nomeArquivo = DocumentoDrivePastaService.formatarNomeArquivoPeticao(request.tipoPeca(), data);
        salvarPdfNoDriveAsync(
                pdf,
                nomeArquivo,
                request.codigoCliente(),
                request.numeroInterno(),
                null,
                TipoDocumento.PETICAO);
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
            @RequestParam(value = "numeroInterno", required = false) Integer numeroInterno)
            throws Exception {
        return responderReformatacao(
                arquivo, enderecamento, numeroProcesso, cidadeEstado, data, codigoCliente, numeroInterno);
    }

    @PostMapping("/formatar-arquivo")
    public ResponseEntity<byte[]> formatarArquivo(
            @RequestParam("arquivo") MultipartFile arquivo,
            @RequestParam(value = "enderecamento", required = false) String enderecamento,
            @RequestParam(value = "numeroProcesso", required = false) String numeroProcesso,
            @RequestParam(value = "cidadeEstado", required = false) String cidadeEstado,
            @RequestParam(value = "data", required = false) String data,
            @RequestParam(value = "codigoCliente", required = false) String codigoCliente,
            @RequestParam(value = "numeroInterno", required = false) Integer numeroInterno)
            throws Exception {
        return responderReformatacao(
                arquivo, enderecamento, numeroProcesso, cidadeEstado, data, codigoCliente, numeroInterno);
    }

    private ResponseEntity<byte[]> responderReformatacao(
            MultipartFile arquivo,
            String enderecamento,
            String numeroProcesso,
            String cidadeEstado,
            String data,
            String codigoCliente,
            Integer numeroInterno)
            throws Exception {
        byte[] pdf = reformatarService.reformatar(arquivo, enderecamento, numeroProcesso, cidadeEstado, data);
        LocalDate dataDoc = LocalDate.now();
        if (data != null && !data.isBlank()) {
            try {
                dataDoc = LocalDate.parse(data.trim());
            } catch (Exception ignored) {
                // mantém hoje
            }
        }
        String nomeSaida = nomePdfReformatado(arquivo.getOriginalFilename(), dataDoc);
        salvarPdfNoDriveAsync(pdf, nomeSaida, codigoCliente, numeroInterno, null, TipoDocumento.PETICAO);
        return respostaPdf(nomeSaida, pdf);
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

    @PostMapping("/gerar-pdf-teste")
    @Profile("dev")
    public ResponseEntity<byte[]> gerarPdfTeste() {
        return gerarPdf(criarExemplo());
    }

    @PostMapping("/gerar-pdf-ia-teste")
    @Profile("dev")
    public ResponseEntity<byte[]> gerarPdfIATeste() {
        return gerarPdfComIA(criarExemploIA());
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
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + nomeArquivo + "\"")
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
                LocalDate.now());
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
                1);
    }
}
