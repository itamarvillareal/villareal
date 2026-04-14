package br.com.vilareal.condominio.api;

import br.com.vilareal.condominio.api.dto.InadimplenciaExtracaoResponse;
import br.com.vilareal.condominio.api.dto.InadimplenciaImportRequest;
import br.com.vilareal.condominio.api.dto.InadimplenciaImportResponse;
import br.com.vilareal.condominio.api.dto.UnidadesPessoasExtracaoResponse;
import br.com.vilareal.condominio.api.dto.UnidadesPessoasImportRequest;
import br.com.vilareal.condominio.api.dto.UnidadesPessoasImportResponse;
import br.com.vilareal.condominio.api.dto.InadimplenciaReversaoResponse;
import br.com.vilareal.condominio.application.CondominioImportacaoReversaoService;
import br.com.vilareal.condominio.application.CondominioInadimplenciaApplicationService;
import br.com.vilareal.condominio.application.CondominioUnidadesPessoasPlanilhaApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.validation.annotation.Validated;

@RestController
@RequestMapping("/api/condominio/inadimplencia")
@Tag(name = "Condomínio — Inadimplência", description = "Importação de relatório PDF de inadimplência por unidade")
@Validated
public class CondominioInadimplenciaController {

    private final CondominioInadimplenciaApplicationService service;
    private final CondominioUnidadesPessoasPlanilhaApplicationService unidadesPessoasPlanilhaService;
    private final CondominioImportacaoReversaoService importacaoReversaoService;

    public CondominioInadimplenciaController(
            CondominioInadimplenciaApplicationService service,
            CondominioUnidadesPessoasPlanilhaApplicationService unidadesPessoasPlanilhaService,
            CondominioImportacaoReversaoService importacaoReversaoService) {
        this.service = service;
        this.unidadesPessoasPlanilhaService = unidadesPessoasPlanilhaService;
        this.importacaoReversaoService = importacaoReversaoService;
    }

    @PostMapping(value = "/extrair", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Extrair cobranças do PDF (sem gravar)")
    public ResponseEntity<InadimplenciaExtracaoResponse> extrair(
            @RequestParam("clienteCodigo") String clienteCodigo,
            @RequestParam("arquivo") MultipartFile arquivo) {
        InadimplenciaExtracaoResponse body = service.extrair(clienteCodigo, arquivo);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(body);
    }

    @PostMapping(value = "/importar", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Importar cobranças confirmadas (processo + cálculo)")
    public ResponseEntity<InadimplenciaImportResponse> importar(@Valid @RequestBody InadimplenciaImportRequest body) {
        InadimplenciaImportResponse res = service.importar(body);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(res);
    }

    @PostMapping(value = "/extrair-pessoas", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Extrair proprietários/inquilinos da planilha XLS/XLSX (sem gravar)")
    public ResponseEntity<UnidadesPessoasExtracaoResponse> extrairPessoas(
            @RequestParam("clienteCodigo") String clienteCodigo,
            @RequestParam("arquivo") MultipartFile arquivo) {
        UnidadesPessoasExtracaoResponse body = unidadesPessoasPlanilhaService.extrairPessoas(clienteCodigo, arquivo);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(body);
    }

    @PostMapping(value = "/importar-pessoas", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Importar pessoas da planilha e vincular proprietário (RÉU) ao processo por unidade")
    public ResponseEntity<UnidadesPessoasImportResponse> importarPessoas(
            @Valid @RequestBody UnidadesPessoasImportRequest body) {
        UnidadesPessoasImportResponse res = unidadesPessoasPlanilhaService.importarPessoas(body);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(res);
    }

    @DeleteMapping("/reverter/{importacaoId}")
    @Operation(summary = "Reverter importação (apaga registros criados na sessão identificada por importacaoId)")
    public ResponseEntity<InadimplenciaReversaoResponse> reverter(@PathVariable String importacaoId) {
        InadimplenciaReversaoResponse body = importacaoReversaoService.reverter(importacaoId);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(body);
    }
}
