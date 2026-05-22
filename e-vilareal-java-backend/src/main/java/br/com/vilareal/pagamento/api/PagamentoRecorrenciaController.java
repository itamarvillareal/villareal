package br.com.vilareal.pagamento.api;

import br.com.vilareal.pagamento.api.dto.recorrencia.*;
import br.com.vilareal.pagamento.application.PagamentoRecorrenciaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pagamentos/recorrencias")
@Tag(name = "Pagamentos recorrentes", description = "Configuração e geração mensal de lançamentos")
public class PagamentoRecorrenciaController {

    private final PagamentoRecorrenciaService pagamentoRecorrenciaService;

    public PagamentoRecorrenciaController(PagamentoRecorrenciaService pagamentoRecorrenciaService) {
        this.pagamentoRecorrenciaService = pagamentoRecorrenciaService;
    }

    @GetMapping
    @Operation(summary = "Listar configurações de recorrência")
    public List<PagamentoRecorrenciaConfigResponse> listar(
            @RequestParam(required = false) Long imovelId,
            @RequestParam(required = false) String categoria,
            @RequestParam(required = false) Boolean ativo) {
        return pagamentoRecorrenciaService.listar(imovelId, categoria, ativo);
    }

    @GetMapping("/{id}")
    public PagamentoRecorrenciaConfigResponse buscar(@PathVariable Long id) {
        return pagamentoRecorrenciaService.buscar(id);
    }

    @PostMapping
    public PagamentoRecorrenciaConfigResponse criar(@Valid @RequestBody PagamentoRecorrenciaConfigWriteRequest req) {
        return pagamentoRecorrenciaService.criar(req);
    }

    @PutMapping("/{id}")
    public PagamentoRecorrenciaConfigResponse atualizar(
            @PathVariable Long id, @Valid @RequestBody PagamentoRecorrenciaConfigWriteRequest req) {
        return pagamentoRecorrenciaService.atualizar(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desativar(@PathVariable Long id) {
        pagamentoRecorrenciaService.desativar(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/ativar")
    public PagamentoRecorrenciaConfigResponse ativar(@PathVariable Long id) {
        return pagamentoRecorrenciaService.ativar(id);
    }

    @GetMapping("/{id}/pagamentos-gerados")
    public PagamentoRecorrenciaGeradosPageResponse pagamentosGerados(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size) {
        return pagamentoRecorrenciaService.pagamentosGerados(id, page, size);
    }

    @PostMapping("/gerar-mes")
    public PagamentoRecorrenciaGerarMesResponse gerarMes(@RequestParam(required = false) String mesAno) {
        return pagamentoRecorrenciaService.gerarMes(mesAno);
    }
}
