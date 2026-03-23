package br.com.vilareal.api.controller;

import br.com.vilareal.api.monitoring.datajud.DatajudTribunalInfo;
import br.com.vilareal.api.monitoring.domain.HitReviewStatus;
import br.com.vilareal.api.monitoring.dto.*;
import br.com.vilareal.api.monitoring.service.MonitoringPeopleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/monitoring")
@Tag(name = "Monitoramento de Pessoas", description = "DataJud / CNJ — pessoas monitoradas, runs, hits e revisão")
public class MonitoringController {

    private final MonitoringPeopleService monitoringPeopleService;

    public MonitoringController(MonitoringPeopleService monitoringPeopleService) {
        this.monitoringPeopleService = monitoringPeopleService;
    }

    @GetMapping("/people")
    @Operation(summary = "Listar pessoas em monitoramento ativo")
    public List<MonitoringPersonSummaryDto> listPeople() {
        return monitoringPeopleService.listSummaries();
    }

    @GetMapping("/people/candidates")
    @Operation(summary = "Cadastros marcados para monitoramento sem registro em monitored_people")
    public List<MonitoringPersonSummaryDto> listCandidates() {
        return monitoringPeopleService.listMarkedCandidatesWithoutRow();
    }

    @PostMapping("/people")
    @Operation(summary = "Registrar ou atualizar monitoramento para um cadastro de pessoa")
    public MonitoringPersonDetailDto register(@Valid @RequestBody MonitoringPersonUpsertRequest request) {
        return monitoringPeopleService.register(request);
    }

    @GetMapping("/people/{id}")
    public MonitoringPersonDetailDto detail(@PathVariable Long id) {
        return monitoringPeopleService.getDetail(id);
    }

    @PatchMapping("/people/{id}")
    public MonitoringPersonDetailDto patch(@PathVariable Long id, @RequestBody MonitoringPersonPatchRequest request) {
        return monitoringPeopleService.patch(id, request);
    }

    @PostMapping("/people/{id}/run")
    @Operation(summary = "Executar monitoramento agora (manual)")
    public ResponseEntity<Void> runNow(@PathVariable Long id) {
        boolean ok = monitoringPeopleService.runNow(id);
        return ok ? ResponseEntity.accepted().build() : ResponseEntity.status(409).build();
    }

    @PostMapping("/people/{id}/search-keys")
    public MonitoringSearchKeyDto addKey(@PathVariable Long id, @Valid @RequestBody MonitoringSearchKeyCreateRequest request) {
        return monitoringPeopleService.addSearchKey(id, request);
    }

    @GetMapping("/people/{id}/runs")
    public List<MonitoringRunDto> runs(@PathVariable Long id) {
        return monitoringPeopleService.listRuns(id);
    }

    @GetMapping("/people/{id}/hits")
    public List<MonitoringHitDto> hits(
            @PathVariable Long id,
            @RequestParam(required = false) HitReviewStatus reviewStatus) {
        return monitoringPeopleService.listHits(id, reviewStatus);
    }

    @PatchMapping("/hits/{hitId}/review")
    public MonitoringHitDto review(@PathVariable Long hitId, @Valid @RequestBody MonitoringHitReviewRequest request) {
        return monitoringPeopleService.reviewHit(hitId, request);
    }

    @GetMapping("/settings")
    public MonitoringSettingsDto getSettings() {
        return monitoringPeopleService.getSettings();
    }

    @PutMapping("/settings")
    public MonitoringSettingsDto putSettings(@RequestBody MonitoringSettingsDto dto) {
        return monitoringPeopleService.updateSettings(dto);
    }

    @GetMapping("/tribunals")
    public List<DatajudTribunalInfo> tribunals() {
        return monitoringPeopleService.listTribunals();
    }
}
