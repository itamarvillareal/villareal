package br.com.vilareal.pagamento.api;

import br.com.vilareal.pagamento.api.dto.relatorio.*;
import br.com.vilareal.pagamento.application.RelatoriosPagamentosService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/relatorios/pagamentos")
@Tag(name = "Relatórios de pagamentos", description = "Análises de desempenho e lucratividade")
public class RelatoriosPagamentosController {

    private final RelatoriosPagamentosService relatoriosPagamentosService;

    public RelatoriosPagamentosController(RelatoriosPagamentosService relatoriosPagamentosService) {
        this.relatoriosPagamentosService = relatoriosPagamentosService;
    }

    @GetMapping("/gastos-por-imovel")
    @Operation(summary = "Gastos por imóvel e categoria no período")
    public GastosPorImovelResponse gastosPorImovel(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodoInicio,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodoFim,
            @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) List<String> categorias) {
        return relatoriosPagamentosService.gastosPorImovel(periodoInicio, periodoFim, clienteId, categorias);
    }

    @GetMapping("/comparativo-mensal")
    public ComparativoMensalResponse comparativoMensal(
            @RequestParam int ano,
            @RequestParam(required = false) Long imovelId) {
        return relatoriosPagamentosService.comparativoMensal(ano, imovelId);
    }

    @GetMapping("/lucratividade")
    public LucratividadeResponse lucratividade(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodoInicio,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodoFim) {
        return relatoriosPagamentosService.lucratividade(periodoInicio, periodoFim);
    }

    @GetMapping("/eficiencia")
    public EficienciaResponse eficiencia(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodoInicio,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodoFim) {
        return relatoriosPagamentosService.eficiencia(periodoInicio, periodoFim);
    }

    @GetMapping("/pendencias")
    public PendenciasResponse pendencias() {
        return relatoriosPagamentosService.pendencias();
    }
}
