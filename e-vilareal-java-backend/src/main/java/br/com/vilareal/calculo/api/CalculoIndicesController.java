package br.com.vilareal.calculo.api;

import br.com.vilareal.calculo.api.dto.CalculoIndicesMensaisResponse;
import br.com.vilareal.calculo.application.CalculoIndicesBcbService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/calculos/indices-mensais")
@Tag(name = "Cálculos — índices", description = "SGS BCB (INPC 1649, IPCA 433) — paridade monetaryIndicesService.js")
public class CalculoIndicesController {

    private final CalculoIndicesBcbService indicesBcbService;

    public CalculoIndicesController(CalculoIndicesBcbService indicesBcbService) {
        this.indicesBcbService = indicesBcbService;
    }

    @GetMapping
    @Operation(summary = "Índices mensais (% variação)", description = "Chaves `yyyy-MM` como no front; competências sem dado retornam 0.")
    public CalculoIndicesMensaisResponse obter(
            @RequestParam String indice,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicial,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFinal) {
        return new CalculoIndicesMensaisResponse(indicesBcbService.obterIndicesMensais(indice, dataInicial, dataFinal));
    }
}
