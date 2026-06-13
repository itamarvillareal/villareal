package br.com.vilareal.financeiro.api;

import br.com.vilareal.financeiro.api.dto.BackfillDescricaoNormRequest;
import br.com.vilareal.financeiro.api.dto.BackfillDescricaoNormResponse;
import br.com.vilareal.financeiro.application.FinanceiroDescricaoNormBackfillService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/financeiro/admin")
@Tag(name = "Financeiro Admin")
public class FinanceiroAdminController {

    private final FinanceiroDescricaoNormBackfillService backfillService;

    public FinanceiroAdminController(FinanceiroDescricaoNormBackfillService backfillService) {
        this.backfillService = backfillService;
    }

    @PostMapping("/backfill-descricao-norm")
    @Operation(description = "Preenche descricao_norm em lotes (idempotente). Requer ROLE_ADMIN.")
    public BackfillDescricaoNormResponse backfillDescricaoNorm(
            @RequestBody(required = false) BackfillDescricaoNormRequest request) {
        Integer lote = request != null ? request.getLoteSize() : null;
        return backfillService.backfill(lote);
    }
}
