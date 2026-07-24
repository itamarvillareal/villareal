package br.com.vilareal.patrimonio.api;

import br.com.vilareal.patrimonio.api.dto.ComparadorItemResponse;
import br.com.vilareal.patrimonio.api.dto.ConsolidacaoResponse;
import br.com.vilareal.patrimonio.api.dto.TaxaReferenciaRequest;
import br.com.vilareal.patrimonio.application.ParametroPatrimonioApplicationService;
import br.com.vilareal.patrimonio.application.PatrimonioConsolidacaoService;
import br.com.vilareal.patrimonio.infrastructure.persistence.entity.ParametroEntity;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/patrimonio")
@Tag(name = "Patrimônio — Gestão patrimonial")
public class PatrimonioController {

    private final PatrimonioConsolidacaoService consolidacaoService;
    private final ParametroPatrimonioApplicationService parametroService;

    public PatrimonioController(
            PatrimonioConsolidacaoService consolidacaoService,
            ParametroPatrimonioApplicationService parametroService) {
        this.consolidacaoService = consolidacaoService;
        this.parametroService = parametroService;
    }

    @GetMapping("/consolidacao")
    @Operation(description = "Patrimônio bruto, passivo, PL, alavancagem, breakdown e caixa livre vs vinculado.")
    public ConsolidacaoResponse consolidacao() {
        return consolidacaoService.consolidar();
    }

    @PostMapping("/consolidacao/snapshot")
    @Operation(description = "Recalcula e persiste snapshot do dia (série histórica de PL).")
    public ConsolidacaoResponse snapshot() {
        return consolidacaoService.consolidarEPersistirSnapshot();
    }

    @GetMapping("/comparador")
    @Operation(description = "Comparador universal: ativos e dívidas na mesma métrica (% a.a. líquido).")
    public List<ComparadorItemResponse> comparador() {
        return consolidacaoService.consolidar().comparadorUniversal();
    }

    @GetMapping("/parametros")
    @Operation(description = "Parâmetros vigentes (§6). Valores iniciais são sugestões — confirmar com o usuário.")
    public ParametroEntity parametros() {
        return parametroService.vigente();
    }

    @PutMapping("/parametros/taxa-referencia")
    @Operation(description = "Atualiza taxa de referência líquida e carimba data (visível no comparador).")
    public ParametroEntity atualizarTaxa(@Valid @RequestBody TaxaReferenciaRequest request) {
        return parametroService.atualizarTaxaReferencia(request);
    }

    @PutMapping("/parametros/teto-amortizacao")
    @Operation(description = "Define teto anual de amortização extraordinária.")
    public ParametroEntity atualizarTeto(@RequestBody Map<String, BigDecimal> body) {
        return parametroService.atualizarTetoAnual(body.get("tetoAmortizacaoAnual"));
    }

    @PutMapping("/parametros/renda-mensal")
    @Operation(description = "Define renda mensal recorrente (base do comprometimento de renda).")
    public ParametroEntity atualizarRenda(@RequestBody Map<String, BigDecimal> body) {
        return parametroService.atualizarRendaMensal(body.get("rendaMensalRecorrente"));
    }
}
