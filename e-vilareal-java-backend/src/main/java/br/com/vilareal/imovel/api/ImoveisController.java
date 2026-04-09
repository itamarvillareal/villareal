package br.com.vilareal.imovel.api;

import br.com.vilareal.imovel.api.dto.ImovelNumeroPlanilhaResponse;
import br.com.vilareal.imovel.api.dto.ImovelResponse;
import br.com.vilareal.imovel.api.dto.ImovelWriteRequest;
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
@RequestMapping("/api/imoveis")
@Tag(name = "Imóveis", description = "Cadastro de imóveis — paridade imoveisRepository.js")
public class ImoveisController {

    private final ImovelApplicationService imovelApplicationService;

    public ImoveisController(ImovelApplicationService imovelApplicationService) {
        this.imovelApplicationService = imovelApplicationService;
    }

    @GetMapping
    @Operation(summary = "Listar imóveis")
    public List<ImovelResponse> listar() {
        return imovelApplicationService.listarImoveis();
    }

    @GetMapping("/numero-por-vinculo")
    @Operation(summary = "Número do imóvel na planilha (col. A) por código de cliente + proc")
    public ImovelNumeroPlanilhaResponse numeroPorVinculo(
            @RequestParam String codigoCliente, @RequestParam int numeroInterno) {
        return imovelApplicationService.resolverNumeroPlanilhaPorVinculo(codigoCliente, numeroInterno);
    }

    @GetMapping("/por-numero-planilha/{numeroPlanilha}")
    @Operation(summary = "Buscar imóvel pelo número da planilha (col. A)")
    public ImovelResponse porNumeroPlanilha(@PathVariable int numeroPlanilha) {
        return imovelApplicationService.buscarImovelPorNumeroPlanilha(numeroPlanilha);
    }

    @GetMapping("/{id}")
    public ImovelResponse buscar(@PathVariable Long id) {
        return imovelApplicationService.buscarImovel(id);
    }

    @PostMapping
    public ResponseEntity<ImovelResponse> criar(@Valid @RequestBody ImovelWriteRequest request) {
        ImovelResponse body = imovelApplicationService.criarImovel(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @PutMapping("/{id}")
    public ImovelResponse atualizar(@PathVariable Long id, @Valid @RequestBody ImovelWriteRequest request) {
        return imovelApplicationService.atualizarImovel(id, request);
    }
}
