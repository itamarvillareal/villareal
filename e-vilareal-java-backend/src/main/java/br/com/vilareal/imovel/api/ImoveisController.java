package br.com.vilareal.imovel.api;

import br.com.vilareal.imovel.api.dto.ImovelNumeroPlanilhaResponse;
import br.com.vilareal.imovel.api.dto.ImovelProcessoPatchRequest;
import br.com.vilareal.imovel.api.dto.ImovelProcessoResponse;
import br.com.vilareal.imovel.api.dto.ImovelProcessoWriteRequest;
import br.com.vilareal.imovel.api.dto.ImovelResponse;
import br.com.vilareal.imovel.api.dto.ImovelVinculoLocatarioResponse;
import br.com.vilareal.imovel.api.dto.ImovelVinculoLocatarioWriteRequest;
import br.com.vilareal.imovel.api.dto.ImovelVinculoPrincipalWriteRequest;
import br.com.vilareal.imovel.api.dto.ImovelVinculosProcessoResponse;
import br.com.vilareal.imovel.api.dto.ImovelVisaoGeralResponse;
import br.com.vilareal.imovel.api.dto.ImovelWriteRequest;
import br.com.vilareal.imovel.api.dto.RelatorioFinanceiroImoveisResponse;
import br.com.vilareal.imovel.application.ImovelApplicationService;
import br.com.vilareal.imovel.application.ImoveisVisaoGeralService;
import br.com.vilareal.imovel.application.RelatorioFinanceiroImoveisService;
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
    private final RelatorioFinanceiroImoveisService relatorioFinanceiroImoveisService;
    private final ImoveisVisaoGeralService imoveisVisaoGeralService;

    public ImoveisController(
            ImovelApplicationService imovelApplicationService,
            RelatorioFinanceiroImoveisService relatorioFinanceiroImoveisService,
            ImoveisVisaoGeralService imoveisVisaoGeralService) {
        this.imovelApplicationService = imovelApplicationService;
        this.relatorioFinanceiroImoveisService = relatorioFinanceiroImoveisService;
        this.imoveisVisaoGeralService = imoveisVisaoGeralService;
    }

    @GetMapping
    @Operation(summary = "Listar imóveis")
    public List<ImovelResponse> listar() {
        return imovelApplicationService.listarImoveis();
    }

    @GetMapping("/visao-geral")
    @Operation(summary = "Visão geral do portfólio: cadastro + contrato + status financeiro da competência, todos os imóveis numa chamada")
    public ImovelVisaoGeralResponse visaoGeral(
            @RequestParam(required = false) String competencia,
            @RequestParam(defaultValue = "false") boolean soOcupados) {
        return imoveisVisaoGeralService.gerar(competencia, soOcupados);
    }

    @GetMapping("/relatorio-financeiro")
    @Operation(summary = "Relatório financeiro imóveis × competência (totais no servidor, sem extrato no browser)")
    public RelatorioFinanceiroImoveisResponse relatorioFinanceiro(
            @RequestParam String competencia,
            @RequestParam(defaultValue = "true") boolean soOcupados) {
        return relatorioFinanceiroImoveisService.gerar(competencia, soOcupados);
    }

    @GetMapping("/numero-por-vinculo")
    @Operation(summary = "Número do imóvel na planilha (col. A) por código de cliente + proc")
    public ImovelNumeroPlanilhaResponse numeroPorVinculo(
            @RequestParam String codigoCliente, @RequestParam int numeroInterno) {
        return imovelApplicationService.resolverNumeroPlanilhaPorVinculo(codigoCliente, numeroInterno);
    }

    @GetMapping("/por-numero-planilha/{numeroPlanilha}")
    @Operation(summary = "Buscar imóvel pelo número da planilha (col. A); com duplicatas sem filtro, retorna o registro com mais dados de cadastro")
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

    @PutMapping("/por-numero-planilha/{numeroPlanilha}/vinculo-principal")
    @Operation(summary = "Definir o par Cod.+Proc. principal (vínculo atual) do imóvel na planilha")
    public ImovelVinculosProcessoResponse definirVinculoPrincipalPorNumeroPlanilha(
            @PathVariable int numeroPlanilha, @Valid @RequestBody ImovelVinculoPrincipalWriteRequest request) {
        return imovelApplicationService.definirVinculoProcessoPrincipal(numeroPlanilha, request);
    }

    @PutMapping("/{id}/vinculo-principal")
    @Operation(summary = "Definir o par Cod.+Proc. principal do imóvel (via nº da planilha)")
    public ImovelVinculosProcessoResponse definirVinculoPrincipalPorImovelId(
            @PathVariable Long id, @Valid @RequestBody ImovelVinculoPrincipalWriteRequest request) {
        return imovelApplicationService.definirVinculoProcessoPrincipalPorImovelId(id, request);
    }

    @GetMapping("/por-numero-planilha/{numeroPlanilha}/vinculo-locatario")
    @Operation(summary = "Dados de locatário/contrato gravados para um par Cod.+Proc. da planilha")
    public ImovelVinculoLocatarioResponse vinculoLocatarioPorNumeroPlanilha(
            @PathVariable int numeroPlanilha,
            @RequestParam String codigoCliente,
            @RequestParam int numeroInterno) {
        return imovelApplicationService.buscarVinculoLocatario(numeroPlanilha, codigoCliente, numeroInterno);
    }

    @PutMapping("/por-numero-planilha/{numeroPlanilha}/vinculo-locatario")
    @Operation(summary = "Gravar dados de locatário/contrato para um par Cod.+Proc. da planilha")
    public ImovelVinculoLocatarioResponse salvarVinculoLocatarioPorNumeroPlanilha(
            @PathVariable int numeroPlanilha, @Valid @RequestBody ImovelVinculoLocatarioWriteRequest request) {
        return imovelApplicationService.salvarVinculoLocatario(numeroPlanilha, request);
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
