package br.com.vilareal.localidade.api;

import br.com.vilareal.localidade.api.dto.EstadoResponse;
import br.com.vilareal.localidade.api.dto.MunicipioResponse;
import br.com.vilareal.localidade.application.MunicipioApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@Tag(name = "Localidade", description = "Estados e municípios IBGE (autocomplete)")
public class LocalidadeController {

    private final MunicipioApplicationService municipioApplicationService;

    public LocalidadeController(MunicipioApplicationService municipioApplicationService) {
        this.municipioApplicationService = municipioApplicationService;
    }

    @GetMapping("/estados")
    @Operation(summary = "Lista UFs brasileiras")
    public List<EstadoResponse> listarEstados() {
        return municipioApplicationService.listarEstados();
    }

    @GetMapping("/municipios")
    @Operation(summary = "Autocomplete de municípios")
    public List<MunicipioResponse> buscarMunicipios(
            @RequestParam(required = false) String uf,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer limit) {
        return municipioApplicationService.buscarMunicipios(uf, q, limit);
    }

    @GetMapping("/municipios/{id}")
    @Operation(summary = "Resolve código IBGE em município")
    public MunicipioResponse obterMunicipio(@PathVariable Integer id) {
        return municipioApplicationService.obterMunicipio(id);
    }
}
