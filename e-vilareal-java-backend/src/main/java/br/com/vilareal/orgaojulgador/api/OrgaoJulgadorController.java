package br.com.vilareal.orgaojulgador.api;

import br.com.vilareal.orgaojulgador.api.dto.OrgaoJulgadorResponse;
import br.com.vilareal.orgaojulgador.application.OrgaoJulgadorApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orgaos-julgadores")
@Tag(name = "Órgãos Julgadores", description = "Varas, juizados e câmaras (autocomplete)")
public class OrgaoJulgadorController {

    private final OrgaoJulgadorApplicationService orgaoJulgadorApplicationService;

    public OrgaoJulgadorController(OrgaoJulgadorApplicationService orgaoJulgadorApplicationService) {
        this.orgaoJulgadorApplicationService = orgaoJulgadorApplicationService;
    }

    @GetMapping
    @Operation(summary = "Autocomplete de órgãos julgadores")
    public List<OrgaoJulgadorResponse> buscarOrgaos(
            @RequestParam(required = false) Integer tribunalId,
            @RequestParam(required = false) Integer municipioId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer limit) {
        return orgaoJulgadorApplicationService.buscarOrgaos(tribunalId, municipioId, q, limit);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Resolve órgão julgador por id")
    public OrgaoJulgadorResponse obterOrgao(@PathVariable Long id) {
        return orgaoJulgadorApplicationService.obterOrgao(id);
    }
}
