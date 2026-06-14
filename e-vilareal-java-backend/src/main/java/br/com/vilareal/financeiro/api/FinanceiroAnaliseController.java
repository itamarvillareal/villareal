package br.com.vilareal.financeiro.api;

import br.com.vilareal.financeiro.api.dto.DescartarRecorrenciaRequest;
import br.com.vilareal.financeiro.api.dto.AplicarRecorrenciaRequest;
import br.com.vilareal.financeiro.api.dto.AplicarRecorrenciaResponse;
import br.com.vilareal.financeiro.api.dto.RecorrenciaDetectadaResponse;
import br.com.vilareal.financeiro.application.FinanceiroAnaliseService;
import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.financeiro.domain.PrecisaoValorRecorrencia;
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
    @Operation(description = "Padrões recorrentes agregados com contagem de pendentes e parciais a completar.")
    public Page<RecorrenciaDetectadaResponse> recorrencias(
            @RequestParam(value = "confiancaMinima", defaultValue = "MEDIA") ConfiancaSugestao confiancaMinima,
            @RequestParam(value = "numeroBanco", required = false) Integer numeroBanco,
            @RequestParam(value = "apenasAcionaveis", defaultValue = "true") boolean apenasAcionaveis,
            @RequestParam(value = "contaContabilId", required = false) Long contaContabilId,
            @RequestParam(value = "precisaoValor", defaultValue = "EXATO") PrecisaoValorRecorrencia precisaoValor,
            @RequestParam(value = "somenteConfiancaPerfeita", defaultValue = "false") boolean somenteConfiancaPerfeita,
            @PageableDefault(size = 50) Pageable pageable) {
        return analiseService.listarRecorrencias(
                confiancaMinima,
                numeroBanco,
                apenasAcionaveis,
                contaContabilId,
                precisaoValor,
                somenteConfiancaPerfeita,
                pageable);
    }

    @PostMapping("/recorrencias/descartar")
    @Operation(description = "Oculta padrão recorrente ou vínculo sugerido do painel de análises.")
    public void descartarRecorrencia(@Valid @RequestBody DescartarRecorrenciaRequest request) {
        analiseService.descartarRecorrencia(request);
    }

    @PostMapping("/recorrencias/aplicar")
    @Operation(description = "Classifica todos os pendentes de um padrão; opcionalmente cria regra CONTAINS.")
    public AplicarRecorrenciaResponse aplicarRecorrencia(@Valid @RequestBody AplicarRecorrenciaRequest request) {
        return analiseService.aplicarRecorrencia(request);
    }
}
