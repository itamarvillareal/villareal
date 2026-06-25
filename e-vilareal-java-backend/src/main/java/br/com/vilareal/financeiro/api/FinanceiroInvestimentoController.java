package br.com.vilareal.financeiro.api;

import br.com.vilareal.financeiro.api.dto.InvestimentoImportResponse;
import br.com.vilareal.financeiro.api.dto.InvestimentoOperacaoResponse;
import br.com.vilareal.financeiro.api.dto.InvestimentoResumoResponse;
import br.com.vilareal.financeiro.application.InvestimentoMovimentacaoApplicationService;
import br.com.vilareal.financeiro.domain.InvestimentoOperacaoStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/financeiro/investimentos")
@Tag(name = "Financeiro Investimentos")
public class FinanceiroInvestimentoController {

    private final InvestimentoMovimentacaoApplicationService investimentoService;

    public FinanceiroInvestimentoController(InvestimentoMovimentacaoApplicationService investimentoService) {
        this.investimentoService = investimentoService;
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(description = "Importa export xlsx de Movimentação BTG, vincula ao extrato e recalcula operações.")
    public InvestimentoImportResponse importar(
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "numeroBanco", required = false) Integer numeroBanco)
            throws IOException {
        return investimentoService.importar(file, numeroBanco);
    }

    @PostMapping("/recalcular")
    @Operation(description = "Re-vincula extrato e recalcula operações/taxas para a conta.")
    public ResponseEntity<Void> recalcular(
            @RequestParam(value = "contaBancariaId", required = false) Long contaBancariaId,
            @RequestParam(value = "numeroBanco", required = false) Integer numeroBanco) {
        investimentoService.vincularExtrato(resolverContaId(contaBancariaId, numeroBanco));
        investimentoService.recalcularOperacoes(resolverContaId(contaBancariaId, numeroBanco));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/operacoes")
    @Operation(description = "Lista operações (flips) com taxa mensal líquida quando disponível.")
    public Page<InvestimentoOperacaoResponse> operacoes(
            @RequestParam(value = "contaBancariaId", required = false) Long contaBancariaId,
            @RequestParam(value = "numeroBanco", required = false) Integer numeroBanco,
            @RequestParam(value = "status", required = false) InvestimentoOperacaoStatus status,
            @RequestParam(value = "dataInicio", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                    LocalDate dataInicio,
            @RequestParam(value = "dataFim", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                    LocalDate dataFim,
            @RequestParam(value = "somenteComTaxa", defaultValue = "false") boolean somenteComTaxa,
            @PageableDefault(size = 50) Pageable pageable) {
        return investimentoService.listarOperacoes(
                resolverContaId(contaBancariaId, numeroBanco), status, dataInicio, dataFim, somenteComTaxa, pageable);
    }

    @GetMapping("/resumo")
    @Operation(description = "KPIs agregados: mediana taxa a.m. líquida, abertas, volume.")
    public InvestimentoResumoResponse resumo(
            @RequestParam(value = "contaBancariaId", required = false) Long contaBancariaId,
            @RequestParam(value = "numeroBanco", required = false) Integer numeroBanco) {
        return investimentoService.obterResumo(resolverContaId(contaBancariaId, numeroBanco));
    }

    @GetMapping("/imports")
    @Operation(description = "Histórico de cargas xlsx por conta.")
    public List<InvestimentoImportResponse> imports(
            @RequestParam(value = "contaBancariaId", required = false) Long contaBancariaId,
            @RequestParam(value = "numeroBanco", required = false) Integer numeroBanco) {
        return investimentoService.listarImports(resolverContaId(contaBancariaId, numeroBanco));
    }

    private Long resolverContaId(Long contaBancariaId, Integer numeroBanco) {
        return investimentoService.resolverContaBancariaId(contaBancariaId, numeroBanco);
    }
}
