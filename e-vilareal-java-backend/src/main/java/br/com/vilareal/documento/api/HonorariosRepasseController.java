package br.com.vilareal.documento.api;

import br.com.vilareal.documento.api.dto.*;
import br.com.vilareal.documento.application.HonorarioRepasseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/honorarios")
@Tag(name = "Honorários — repasse de alvará", description = "Vínculos alvará × repasse ao contratante (contrato percentual)")
public class HonorariosRepasseController {

    private final HonorarioRepasseService honorarioRepasseService;

    public HonorariosRepasseController(HonorarioRepasseService honorarioRepasseService) {
        this.honorarioRepasseService = honorarioRepasseService;
    }

    @GetMapping("/repasses-pendentes")
    @Operation(
            summary = "Carteira de repasses de honorários em aberto",
            description =
                    "Alvarás classificados com repasse PENDENTE ou DIVERGENTE (contrato PERCENTUAL_PROVEITO). Valores derivados dos vínculos.")
    public RepassePendenteHonorarioCarteiraResponse repassesPendentes() {
        return honorarioRepasseService.repassesPendentesHonorario();
    }

    @PostMapping("/classificar-alvara")
    @Operation(
            summary = "Classificar crédito como alvará",
            description = "Cria vínculo papel=ALVARA (idempotente). Exige processo com contrato PERCENTUAL_PROVEITO.")
    public HonorarioRepasseVinculoResponse classificarAlvara(@Valid @RequestBody ClassificarAlvaraHonorarioRequest request) {
        return honorarioRepasseService.classificarAlvara(request.lancamentoId());
    }

    @PostMapping("/vincular-repasse")
    @Operation(
            summary = "Vincular débito como repasse ao contratante",
            description =
                    "Cria vínculo papel=REPASSE ligado ao alvará pendente. Informe alvaraLancamentoId se houver mais de um pendente.")
    public HonorarioRepasseVinculoResponse vincularRepasse(@Valid @RequestBody VincularRepasseHonorarioRequest request) {
        return honorarioRepasseService.vincularRepasse(request.lancamentoDebitoId(), request.alvaraLancamentoId());
    }
}
