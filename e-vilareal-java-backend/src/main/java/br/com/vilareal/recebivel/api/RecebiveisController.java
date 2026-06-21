package br.com.vilareal.recebivel.api;

import br.com.vilareal.recebivel.api.dto.RecebivelQuadroResponse;
import br.com.vilareal.recebivel.application.RecebivelQuadroApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/recebiveis")
@Tag(name = "Recebíveis", description = "Quadro consolidado de recebíveis em aberto (leitura derivada)")
public class RecebiveisController {

    private final RecebivelQuadroApplicationService quadroService;

    public RecebiveisController(RecebivelQuadroApplicationService quadroService) {
        this.quadroService = quadroService;
    }

    @GetMapping("/quadro")
    @Operation(
            summary = "Quadro consolidado de recebíveis",
            description =
                    "Agrega pagamentos RECEBER em aberto, parcelas de honorários sem pagamento e IPTU pendente/atrasado.")
    public RecebivelQuadroResponse quadro(
            @RequestParam(required = false, defaultValue = "ESTE_MES") String periodo,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim) {
        return quadroService.quadro(periodo, inicio, fim);
    }
}
