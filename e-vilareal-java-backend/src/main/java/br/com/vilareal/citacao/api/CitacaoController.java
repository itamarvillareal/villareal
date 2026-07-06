package br.com.vilareal.citacao.api;

import br.com.vilareal.citacao.api.dto.*;
import br.com.vilareal.citacao.application.CitacaoApplicationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/processos/{processoId}/citacao")
@Tag(name = "Citação", description = "Controle de endereços tentados para citação do réu")
public class CitacaoController {

    private final CitacaoApplicationService citacaoService;

    public CitacaoController(CitacaoApplicationService citacaoService) {
        this.citacaoService = citacaoService;
    }

    @GetMapping("/rea/{processoParteId}")
    public CitacaoReuPainelResponse painelReu(
            @PathVariable Long processoId, @PathVariable Long processoParteId) {
        return citacaoService.painelReu(processoId, processoParteId);
    }

    @PostMapping("/solicitar")
    public CitacaoTentativaResponse solicitar(
            @PathVariable Long processoId, @Valid @RequestBody CitacaoSolicitarRequest body) {
        return citacaoService.solicitar(processoId, body);
    }

    @PostMapping("/registrar-retorno")
    public CitacaoTentativaResponse registrarRetorno(
            @PathVariable Long processoId, @Valid @RequestBody CitacaoRegistrarRetornoRequest body) {
        return citacaoService.registrarRetorno(processoId, body);
    }

    @PostMapping("/registrar-positivo")
    public CitacaoTentativaResponse registrarPositivo(
            @PathVariable Long processoId, @Valid @RequestBody CitacaoRegistrarPositivoRequest body) {
        return citacaoService.registrarPositivo(processoId, body);
    }

    @DeleteMapping("/{tentativaId}")
    public ResponseEntity<Void> excluir(
            @PathVariable Long processoId, @PathVariable Long tentativaId) {
        citacaoService.excluirTentativa(processoId, tentativaId);
        return ResponseEntity.noContent().build();
    }
}
