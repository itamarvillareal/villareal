package br.com.vilareal.orgaojulgador.api;

import br.com.vilareal.orgaojulgador.api.dto.OrgaoJulgadorSyncResponse;
import br.com.vilareal.orgaojulgador.api.dto.TribunalResponse;
import br.com.vilareal.orgaojulgador.application.OrgaoJulgadorSyncService;
import br.com.vilareal.orgaojulgador.application.TribunalApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tribunais")
@Tag(name = "Tribunais", description = "Tribunais de Justiça e sincronização DataJud")
public class TribunalController {

    private final TribunalApplicationService tribunalApplicationService;
    private final OrgaoJulgadorSyncService orgaoJulgadorSyncService;

    public TribunalController(
            TribunalApplicationService tribunalApplicationService, OrgaoJulgadorSyncService orgaoJulgadorSyncService) {
        this.tribunalApplicationService = tribunalApplicationService;
        this.orgaoJulgadorSyncService = orgaoJulgadorSyncService;
    }

    @GetMapping
    @Operation(summary = "Lista tribunais cadastrados")
    public List<TribunalResponse> listarTribunais(@RequestParam(required = false) Boolean ativo) {
        return tribunalApplicationService.listarTribunais(ativo);
    }

    @PostMapping("/{id}/sincronizar")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @Operation(summary = "Sincroniza órgãos julgadores via DataJud (admin)")
    public OrgaoJulgadorSyncResponse sincronizar(@PathVariable Integer id) {
        return orgaoJulgadorSyncService.sincronizar(id);
    }
}
