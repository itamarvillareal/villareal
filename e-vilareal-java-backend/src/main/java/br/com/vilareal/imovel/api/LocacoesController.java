package br.com.vilareal.imovel.api;

import br.com.vilareal.imovel.api.dto.*;
import br.com.vilareal.imovel.application.ImovelApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/locacoes")
@Tag(name = "Locações", description = "Contratos, repasses e despesas — paridade imoveisRepository.js")
public class LocacoesController {

    private final ImovelApplicationService imovelApplicationService;

    public LocacoesController(ImovelApplicationService imovelApplicationService) {
        this.imovelApplicationService = imovelApplicationService;
    }

    @GetMapping("/contratos")
    @Operation(summary = "Listar contratos por imóvel")
    public List<ContratoLocacaoResponse> listarContratos(@RequestParam Long imovelId) {
        return imovelApplicationService.listarContratos(imovelId);
    }

    @PostMapping("/contratos")
    public ResponseEntity<ContratoLocacaoResponse> criarContrato(@Valid @RequestBody ContratoLocacaoWriteRequest request) {
        ContratoLocacaoResponse body = imovelApplicationService.criarContrato(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @PutMapping("/contratos/{id}")
    public ContratoLocacaoResponse atualizarContrato(
            @PathVariable Long id, @Valid @RequestBody ContratoLocacaoWriteRequest request) {
        return imovelApplicationService.atualizarContrato(id, request);
    }

    @GetMapping("/repasses")
    public List<LocacaoRepasseResponse> listarRepasses(@RequestParam Long contratoId) {
        return imovelApplicationService.listarRepasses(contratoId);
    }

    @PostMapping("/repasses")
    public ResponseEntity<LocacaoRepasseResponse> criarRepasse(@Valid @RequestBody LocacaoRepasseWriteRequest request) {
        LocacaoRepasseResponse body = imovelApplicationService.criarRepasse(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @PutMapping("/repasses/{id}")
    public LocacaoRepasseResponse atualizarRepasse(
            @PathVariable Long id, @Valid @RequestBody LocacaoRepasseWriteRequest request) {
        return imovelApplicationService.atualizarRepasse(id, request);
    }

    @GetMapping("/despesas")
    public List<LocacaoDespesaResponse> listarDespesas(@RequestParam Long contratoId) {
        return imovelApplicationService.listarDespesas(contratoId);
    }

    @PostMapping("/despesas")
    public ResponseEntity<LocacaoDespesaResponse> criarDespesa(@Valid @RequestBody LocacaoDespesaWriteRequest request) {
        LocacaoDespesaResponse body = imovelApplicationService.criarDespesa(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @PutMapping("/despesas/{id}")
    public LocacaoDespesaResponse atualizarDespesa(
            @PathVariable Long id, @Valid @RequestBody LocacaoDespesaWriteRequest request) {
        return imovelApplicationService.atualizarDespesa(id, request);
    }
}
