package br.com.vilareal.financeiro.api;

import br.com.vilareal.financeiro.api.dto.AplicarRecorrenciaRequest;
import br.com.vilareal.financeiro.api.dto.AplicarRecorrenciaResponse;
import br.com.vilareal.financeiro.api.dto.RecorrenciaDetectadaResponse;
import br.com.vilareal.financeiro.application.FinanceiroAnaliseService;
import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/financeiro/analises")
@Tag(name = "Financeiro Análises")
public class FinanceiroAnaliseController {

    private final FinanceiroAnaliseService analiseService;

    public FinanceiroAnaliseController(FinanceiroAnaliseService analiseService) {
        this.analiseService = analiseService;
    }

    @GetMapping("/recorrencias")
    @Operation(description = "Padrões recorrentes agregados com contagem de pendentes.")
    public Page<RecorrenciaDetectadaResponse> recorrencias(
            @RequestParam(value = "confiancaMinima", defaultValue = "MEDIA") ConfiancaSugestao confiancaMinima,
            @RequestParam(value = "numeroBanco", required = false) Integer numeroBanco,
            @RequestParam(value = "apenasComPendentes", defaultValue = "true") boolean apenasComPendentes,
            @RequestParam(value = "contaContabilId", required = false) Long contaContabilId,
            @PageableDefault(size = 50) Pageable pageable) {
        return analiseService.listarRecorrencias(
                confiancaMinima, numeroBanco, apenasComPendentes, contaContabilId, pageable);
    }

    @PostMapping("/recorrencias/aplicar")
    @Operation(description = "Classifica todos os pendentes de um padrão; opcionalmente cria regra CONTAINS.")
    public AplicarRecorrenciaResponse aplicarRecorrencia(@Valid @RequestBody AplicarRecorrenciaRequest request) {
        return analiseService.aplicarRecorrencia(request);
    }
}
