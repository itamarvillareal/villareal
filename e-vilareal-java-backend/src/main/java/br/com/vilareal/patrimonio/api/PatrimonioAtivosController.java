package br.com.vilareal.patrimonio.api;

import br.com.vilareal.patrimonio.api.dto.AtivoCadastroDtos.*;
import br.com.vilareal.patrimonio.application.PatrimonioAtivoApplicationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/patrimonio/ativos")
@Tag(name = "Patrimônio — Ativos")
public class PatrimonioAtivosController {

    private final PatrimonioAtivoApplicationService service;

    public PatrimonioAtivosController(PatrimonioAtivoApplicationService service) {
        this.service = service;
    }

    @GetMapping("/caixa")
    public List<CaixaResponse> listarCaixa() {
        return service.listarCaixa();
    }

    @PostMapping("/caixa")
    @ResponseStatus(HttpStatus.CREATED)
    public CaixaResponse criarCaixa(@Valid @RequestBody CaixaRequest req) {
        return service.salvarCaixa(null, req);
    }

    @PutMapping("/caixa/{id}")
    public CaixaResponse atualizarCaixa(@PathVariable Long id, @Valid @RequestBody CaixaRequest req) {
        return service.salvarCaixa(id, req);
    }

    @DeleteMapping("/caixa/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desativarCaixa(@PathVariable Long id) {
        service.desativarCaixa(id);
    }

    @GetMapping("/renda-fixa")
    public List<RendaFixaResponse> listarRf() {
        return service.listarRf();
    }

    @PostMapping("/renda-fixa")
    @ResponseStatus(HttpStatus.CREATED)
    public RendaFixaResponse criarRf(@Valid @RequestBody RendaFixaRequest req) {
        return service.salvarRf(null, req);
    }

    @PutMapping("/renda-fixa/{id}")
    public RendaFixaResponse atualizarRf(@PathVariable Long id, @Valid @RequestBody RendaFixaRequest req) {
        return service.salvarRf(id, req);
    }

    @DeleteMapping("/renda-fixa/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desativarRf(@PathVariable Long id) {
        service.desativarRf(id);
    }

    @GetMapping("/imoveis")
    public List<ImovelResponse> listarImoveis() {
        return service.listarImoveis();
    }

    @PostMapping("/imoveis")
    @ResponseStatus(HttpStatus.CREATED)
    public ImovelResponse criarImovel(@Valid @RequestBody ImovelRequest req) {
        return service.salvarImovel(null, req);
    }

    @PutMapping("/imoveis/{id}")
    public ImovelResponse atualizarImovel(@PathVariable Long id, @Valid @RequestBody ImovelRequest req) {
        return service.salvarImovel(id, req);
    }

    @DeleteMapping("/imoveis/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desativarImovel(@PathVariable Long id) {
        service.desativarImovel(id);
    }

    @GetMapping("/renda-variavel")
    public List<RvResponse> listarRv() {
        return service.listarRv();
    }

    @PostMapping("/renda-variavel")
    @ResponseStatus(HttpStatus.CREATED)
    public RvResponse criarRv(@Valid @RequestBody RvRequest req) {
        return service.salvarRv(null, req);
    }

    @PutMapping("/renda-variavel/{id}")
    public RvResponse atualizarRv(@PathVariable Long id, @Valid @RequestBody RvRequest req) {
        return service.salvarRv(id, req);
    }

    @DeleteMapping("/renda-variavel/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desativarRv(@PathVariable Long id) {
        service.desativarRv(id);
    }

    @GetMapping("/veiculos")
    public List<VeiculoResponse> listarVeiculos() {
        return service.listarVeiculos();
    }

    @PostMapping("/veiculos")
    @ResponseStatus(HttpStatus.CREATED)
    public VeiculoResponse criarVeiculo(@Valid @RequestBody VeiculoRequest req) {
        return service.salvarVeiculo(null, req);
    }

    @PutMapping("/veiculos/{id}")
    public VeiculoResponse atualizarVeiculo(@PathVariable Long id, @Valid @RequestBody VeiculoRequest req) {
        return service.salvarVeiculo(id, req);
    }

    @DeleteMapping("/veiculos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desativarVeiculo(@PathVariable Long id) {
        service.desativarVeiculo(id);
    }

    @GetMapping("/opcoes")
    public List<OpcaoResponse> listarOpcoes(@RequestParam(required = false) String status) {
        return service.listarOpcoes(status);
    }

    @PostMapping("/opcoes")
    @ResponseStatus(HttpStatus.CREATED)
    public OpcaoResponse criarOpcao(@Valid @RequestBody OpcaoRequest req) {
        return service.salvarOpcao(null, req);
    }

    @PutMapping("/opcoes/{id}")
    public OpcaoResponse atualizarOpcao(@PathVariable Long id, @Valid @RequestBody OpcaoRequest req) {
        return service.salvarOpcao(id, req);
    }
}
