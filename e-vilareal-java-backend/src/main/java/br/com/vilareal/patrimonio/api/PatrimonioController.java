package br.com.vilareal.patrimonio.api;

import br.com.vilareal.patrimonio.api.dto.ComparadorItemResponse;
import br.com.vilareal.patrimonio.api.dto.ConsolidacaoResponse;
import br.com.vilareal.patrimonio.application.PatrimonioConsolidacaoService;
import br.com.vilareal.patrimonio.infrastructure.persistence.entity.ParametroEntity;
import br.com.vilareal.patrimonio.infrastructure.persistence.repository.ParametroRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/patrimonio")
@Tag(name = "Patrimônio — Gestão patrimonial")
public class PatrimonioController {

    private final PatrimonioConsolidacaoService consolidacaoService;
    private final ParametroRepository parametroRepository;

    public PatrimonioController(
            PatrimonioConsolidacaoService consolidacaoService,
            ParametroRepository parametroRepository) {
        this.consolidacaoService = consolidacaoService;
        this.parametroRepository = parametroRepository;
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
        return parametroRepository.findTopByVigenteAteIsNullOrderByVersaoDesc().orElse(null);
    }
}
