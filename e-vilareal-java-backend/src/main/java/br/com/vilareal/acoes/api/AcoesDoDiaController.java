package br.com.vilareal.acoes.api;

import br.com.vilareal.acoes.api.dto.AcoesDoDiaResponse;
import br.com.vilareal.acoes.application.AcoesDoDiaApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/acoes-do-dia")
@Tag(name = "Ações do Dia", description = "Painel derivado do que fazer hoje (receber, repassar, conciliar, renegociar)")
public class AcoesDoDiaController {

    private final AcoesDoDiaApplicationService service;

    public AcoesDoDiaController(AcoesDoDiaApplicationService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(
            summary = "Painel Ações do Dia",
            description =
                    "Leitura derivada do quadro de recebíveis, repasses pendentes e contratos a vencer. "
                            + "Competência padrão = mês corrente (AAAA-MM).")
    public AcoesDoDiaResponse obter(@RequestParam(required = false) String competencia) {
        return service.obter(competencia);
    }
}
