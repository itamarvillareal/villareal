package br.com.vilareal.condominio.api;

import br.com.vilareal.condominio.api.dto.CobrancaExtracaoResponse;
import br.com.vilareal.condominio.api.dto.CobrancaProcessarRequest;
import br.com.vilareal.condominio.api.dto.CobrancaProprietarioDiagnosticoRequest;
import br.com.vilareal.condominio.api.dto.CobrancaProprietarioDiagnosticoResponse;
import br.com.vilareal.condominio.api.dto.RelatorioExecucaoCobranca;
import br.com.vilareal.condominio.application.CobrancaAutomaticaApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/cobranca")
@Tag(name = "Cobrança automática", description = "Inadimplência condominial via relatório .xls")
@Validated
public class CobrancaController {

    private final CobrancaAutomaticaApplicationService service;

    public CobrancaController(CobrancaAutomaticaApplicationService service) {
        this.service = service;
    }

    @PostMapping(value = "/extrair-pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Extrair unidades e débitos do relatório PDF Condo Id (sem gravar)")
    public ResponseEntity<CobrancaExtracaoResponse> extrairPdf(
            @RequestParam("clienteCodigo") String clienteCodigo, @RequestParam("arquivo") MultipartFile arquivo) {
        CobrancaExtracaoResponse body = service.extrairPdf(clienteCodigo, arquivo);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(body);
    }

    @PostMapping(value = "/extrair", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Extrair unidades e débitos do relatório .xls (sem gravar)")
    public ResponseEntity<CobrancaExtracaoResponse> extrair(@RequestParam("arquivo") MultipartFile arquivo) {
        CobrancaExtracaoResponse body = service.extrair(arquivo);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(body);
    }

    @PostMapping(value = "/diagnosticar-proprietarios", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Diagnosticar proprietário efetivo (planilha) vs processos legados por unidade")
    public ResponseEntity<CobrancaProprietarioDiagnosticoResponse> diagnosticarProprietarios(
            @Valid @RequestBody CobrancaProprietarioDiagnosticoRequest body) {
        CobrancaProprietarioDiagnosticoResponse res = service.diagnosticarProprietarios(body);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(res);
    }

    @PostMapping(value = "/processar", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Processar cobrança e devolver relatório de execução (JSON)")
    public ResponseEntity<RelatorioExecucaoCobranca> processar(@Valid @RequestBody CobrancaProcessarRequest body) {
        RelatorioExecucaoCobranca res = service.processar(body);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(res);
    }

    @GetMapping("/relatorio/{importacaoId}")
    @Operation(summary = "Relatório de execução persistido (JSON)")
    public ResponseEntity<RelatorioExecucaoCobranca> relatorio(@PathVariable String importacaoId) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(service.buscarRelatorio(importacaoId));
    }

    @GetMapping(value = "/relatorio/{importacaoId}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    @Operation(summary = "Relatório de execução em PDF")
    public ResponseEntity<byte[]> relatorioPdf(@PathVariable String importacaoId) {
        byte[] pdf = service.gerarRelatorioPdf(importacaoId);
        String filename = "relatorio-cobranca-" + importacaoId + ".pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .cacheControl(CacheControl.noStore())
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .body(pdf);
    }
}
