package br.com.vilareal.imovel.api;

import br.com.vilareal.imovel.api.dto.ImovelNumeroPlanilhaResponse;
import br.com.vilareal.imovel.api.dto.ImovelProcessoPatchRequest;
import br.com.vilareal.imovel.api.dto.ImovelProcessoResponse;
import br.com.vilareal.imovel.api.dto.ImovelProcessoWriteRequest;
import br.com.vilareal.imovel.api.dto.ImovelResponse;
import br.com.vilareal.imovel.api.dto.ImovelVinculosProcessoResponse;
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
    @Operation(summary = "Buscar imóvel pelo número da planilha (col. A); use clienteId ou codigoCliente quando houver mais de um cliente")
    public ImovelResponse porNumeroPlanilha(
            @PathVariable int numeroPlanilha,
            @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) String codigoCliente) {
        return imovelApplicationService.buscarImovelPorNumeroPlanilha(numeroPlanilha, clienteId, codigoCliente);
    }

    @GetMapping("/por-numero-planilha/{numeroPlanilha}/vinculos-processo")
    @Operation(summary = "Listar todos os pares cliente+proc. vinculados ao nº do imóvel (planilha)")
    public ImovelVinculosProcessoResponse vinculosPorNumeroPlanilha(@PathVariable int numeroPlanilha) {
        return imovelApplicationService.listarVinculosProcessoPorNumeroPlanilha(numeroPlanilha);
    }

    @GetMapping("/{id}/vinculos-processo")
    @Operation(summary = "Listar vínculos processo do imóvel (pelo nº da planilha ou legado nas observações)")
    public ImovelVinculosProcessoResponse vinculosPorImovelId(@PathVariable Long id) {
        return imovelApplicationService.listarVinculosProcessoPorImovelId(id);
    }

    @GetMapping("/{id}/processos")
    @Operation(summary = "Histórico de processos vinculados ao imóvel")
    public List<ImovelProcessoResponse> listarProcessos(@PathVariable Long id) {
        return imovelApplicationService.listarProcessosDoImovel(id);
    }

    @PostMapping("/{id}/processos")
    @Operation(summary = "Vincular processo ao imóvel (N:N com histórico)")
    public ResponseEntity<ImovelProcessoResponse> vincularProcesso(
            @PathVariable Long id, @Valid @RequestBody ImovelProcessoWriteRequest request) {
        ImovelProcessoResponse body = imovelApplicationService.vincularProcesso(id, request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{processoId}")
                .buildAndExpand(request.getProcessoId())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @PatchMapping("/{id}/processos/{processoId}")
    @Operation(summary = "Desativar vínculo imóvel-processo (fim da locação)")
    public ImovelProcessoResponse desativarVinculoProcesso(
            @PathVariable Long id,
            @PathVariable Long processoId,
            @RequestBody(required = false) ImovelProcessoPatchRequest request) {
        return imovelApplicationService.desativarVinculoProcesso(
                id, processoId, request != null ? request : new ImovelProcessoPatchRequest());
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
