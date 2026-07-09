package br.com.vilareal.documento.importacao.api;

import br.com.vilareal.documento.importacao.api.dto.*;
import br.com.vilareal.documento.importacao.application.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/documentos/contratos-honorarios/importar")
@Tag(name = "Contratos honorários — importação celebrados")
public class ContratoHonorariosImportacaoController {

    private final ContratoHonorariosImportacaoApplicationService importacaoService;
    private final ContratoHonorariosConciliacaoRetroativaService conciliacaoRetroativaService;
    private final ExtratoCoberturaApplicationService extratoCoberturaService;
    private final ContratoHonorariosCobrancaGateService cobrancaGateService;
    private final ContratoHonorariosExpectativaService expectativaService;

    public ContratoHonorariosImportacaoController(
            ContratoHonorariosImportacaoApplicationService importacaoService,
            ContratoHonorariosConciliacaoRetroativaService conciliacaoRetroativaService,
            ExtratoCoberturaApplicationService extratoCoberturaService,
            ContratoHonorariosCobrancaGateService cobrancaGateService,
            ContratoHonorariosExpectativaService expectativaService) {
        this.importacaoService = importacaoService;
        this.conciliacaoRetroativaService = conciliacaoRetroativaService;
        this.extratoCoberturaService = extratoCoberturaService;
        this.cobrancaGateService = cobrancaGateService;
        this.expectativaService = expectativaService;
    }

    @PostMapping(value = "/lote", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload em lote de PDFs de contratos celebrados")
    public ContratoHonorariosImportarLoteResponse uploadLote(
            @RequestParam("arquivos") List<MultipartFile> arquivos,
            @RequestParam(required = false) String codigoCliente,
            @RequestParam(required = false) Long processoId) throws Exception {
        List<ContratoHonorariosImportacaoApplicationService.ArquivoPdf> pdfs = new ArrayList<>();
        for (MultipartFile f : arquivos) {
            if (f == null || f.isEmpty()) {
                continue;
            }
            pdfs.add(new ContratoHonorariosImportacaoApplicationService.ArquivoPdf(
                    f.getOriginalFilename() != null ? f.getOriginalFilename() : "contrato.pdf",
                    f.getBytes()));
        }
        return importacaoService.enfileirarLote(pdfs, codigoCliente, processoId);
    }

    @GetMapping("/lote/{loteId}")
    public ContratoHonorariosImportacaoLoteStatusResponse statusLote(@PathVariable String loteId) {
        return importacaoService.statusLote(loteId);
    }

    @GetMapping("/fila")
    public Page<ContratoHonorariosImportacaoItemResponse> fila(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String codigoCliente,
            @RequestParam(required = false) String importacaoLoteId,
            @PageableDefault(size = 20, sort = "scoreConfianca") Pageable pageable) {
        return importacaoService.listarFila(status, codigoCliente, importacaoLoteId, pageable);
    }

    @GetMapping("/{importacaoId}")
    public ContratoHonorariosImportacaoItemResponse obter(@PathVariable Long importacaoId) {
        return importacaoService.obter(importacaoId);
    }

    @GetMapping("/{importacaoId}/pdf")
    @Operation(description = "PDF temporário da importação (preview na conferência).")
    public ResponseEntity<byte[]> obterPdf(@PathVariable Long importacaoId) {
        var pdf = importacaoService.obterPdfTemporario(importacaoId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + pdf.nomeArquivo() + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf.bytes());
    }

    @PatchMapping("/{importacaoId}/revisao")
    public ContratoHonorariosImportacaoItemResponse revisao(
            @PathVariable Long importacaoId, @RequestBody RevisaoImportacaoRequest body) {
        return importacaoService.salvarRevisao(
                importacaoId, body.dadosAprovados(), body.roteamentoTipo(), body.processoId());
    }

    @PostMapping("/{importacaoId}/aprovar")
    public ContratoHonorariosImportacaoItemResponse aprovar(
            @PathVariable Long importacaoId, @Valid @RequestBody ContratoHonorariosImportarAprovarRequest body) {
        return importacaoService.aprovar(importacaoId, body);
    }

    @PostMapping("/{importacaoId}/rejeitar")
    public ResponseEntity<Void> rejeitar(@PathVariable Long importacaoId) {
        importacaoService.rejeitar(importacaoId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{importacaoId}/conciliar-retroativo")
    public ContratoHonorariosConciliacaoRetroativaResponse conciliarRetroativo(@PathVariable Long importacaoId) {
        return conciliacaoRetroativaService.rodar(importacaoId);
    }

    @GetMapping("/extrato-cobertura")
    public ExtratoCoberturaResponse extratoCobertura(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return extratoCoberturaService.verificar(de, ate);
    }

    @PostMapping("/cobranca/armar")
    public List<Long> armarCobranca(@Valid @RequestBody ContratoHonorariosArmarCobrancaRequest body) {
        return cobrancaGateService.armar(body);
    }

    @PostMapping("/cobranca/desarmar")
    public ResponseEntity<Void> desarmarCobranca(@RequestBody List<Long> contratoHonorariosIds) {
        cobrancaGateService.desarmar(contratoHonorariosIds);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{importacaoId}")
    public ResponseEntity<Void> reverter(@PathVariable Long importacaoId) {
        importacaoService.reverter(importacaoId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/relatorio/censo")
    public CensoHonorariosRelatorioResponse relatorioCenso() {
        return importacaoService.relatorioCenso();
    }

    @GetMapping("/expectativas-contingentes")
    public List<ExpectativaContingenteItemResponse> expectativasContingentes() {
        return expectativaService.listarContingentes();
    }

    public record RevisaoImportacaoRequest(
            ContratoHonorariosExtracaoDados dadosAprovados,
            String roteamentoTipo,
            Long processoId) {}
}
