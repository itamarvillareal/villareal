package br.com.vilareal.api.monitoring.service;

import br.com.vilareal.api.entity.*;
import br.com.vilareal.api.monitoring.datajud.DatajudTribunalInfo;
import br.com.vilareal.api.monitoring.datajud.DatajudTribunalResolver;
import br.com.vilareal.api.monitoring.domain.HitReviewStatus;
import br.com.vilareal.api.monitoring.domain.MonitorMode;
import br.com.vilareal.api.monitoring.domain.MonitoringFrequencyType;
import br.com.vilareal.api.monitoring.dto.*;
import br.com.vilareal.api.monitoring.exception.MonitoringNotFoundException;
import br.com.vilareal.api.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class MonitoringPeopleService {

    private final MonitoredPersonRepository monitoredPersonRepository;
    private final MonitoredPersonSearchKeyRepository searchKeyRepository;
    private final MonitoringRunRepository monitoringRunRepository;
    private final MonitoringHitRepository monitoringHitRepository;
    private final MonitoringSettingsRepository monitoringSettingsRepository;
    private final CadastroPessoasRepository cadastroPessoasRepository;
    private final MonitoringRunExecutor monitoringRunExecutor;
    private final MonitoringFrequencyCalculator frequencyCalculator;
    private final DatajudTribunalResolver tribunalResolver;

    public MonitoringPeopleService(
            MonitoredPersonRepository monitoredPersonRepository,
            MonitoredPersonSearchKeyRepository searchKeyRepository,
            MonitoringRunRepository monitoringRunRepository,
            MonitoringHitRepository monitoringHitRepository,
            MonitoringSettingsRepository monitoringSettingsRepository,
            CadastroPessoasRepository cadastroPessoasRepository,
            MonitoringRunExecutor monitoringRunExecutor,
            MonitoringFrequencyCalculator frequencyCalculator,
            DatajudTribunalResolver tribunalResolver) {
        this.monitoredPersonRepository = monitoredPersonRepository;
        this.searchKeyRepository = searchKeyRepository;
        this.monitoringRunRepository = monitoringRunRepository;
        this.monitoringHitRepository = monitoringHitRepository;
        this.monitoringSettingsRepository = monitoringSettingsRepository;
        this.cadastroPessoasRepository = cadastroPessoasRepository;
        this.monitoringRunExecutor = monitoringRunExecutor;
        this.frequencyCalculator = frequencyCalculator;
        this.tribunalResolver = tribunalResolver;
    }

    @Transactional(readOnly = true)
    public List<MonitoringPersonSummaryDto> listSummaries() {
        List<MonitoringPersonSummaryDto> out = new ArrayList<>();
        for (MonitoredPerson m : monitoredPersonRepository.findAll()) {
            out.add(toSummary(m));
        }
        return out;
    }

    /**
     * Chamado após salvar o cadastro de pessoas: mantém {@code monitored_people} alinhado ao flag
     * {@code marcado_monitoramento} (lista de monitorados e candidatos no front).
     */
    @Transactional
    public void syncMonitoringAfterCadastroSave(Long personId, boolean marcado) {
        if (personId == null) {
            return;
        }
        if (marcado) {
            MonitoringPersonUpsertRequest req = new MonitoringPersonUpsertRequest();
            req.setPersonId(personId);
            req.setEnabled(true);
            register(req);
        } else {
            monitoredPersonRepository.findByPerson_Id(personId).ifPresent(m -> {
                m.setEnabled(false);
                monitoredPersonRepository.save(m);
            });
        }
    }

    @Transactional(readOnly = true)
    public List<MonitoringPersonSummaryDto> listMarkedCandidatesWithoutRow() {
        List<CadastroPessoa> marcados = cadastroPessoasRepository.findByMarcadoMonitoramentoTrue();
        List<MonitoringPersonSummaryDto> out = new ArrayList<>();
        for (CadastroPessoa p : marcados) {
            if (monitoredPersonRepository.findByPerson_Id(p.getId()).isEmpty()) {
                MonitoringPersonSummaryDto d = new MonitoringPersonSummaryDto();
                d.setPersonId(p.getId());
                d.setNome(p.getNome());
                d.setDocumentoPrincipal(p.getCpf());
                d.setEnabled(false);
                d.setLastStatus("CANDIDATO_SEM_REGISTRO_MONITORAMENTO");
                out.add(d);
            }
        }
        return out;
    }

    @Transactional(readOnly = true)
    public MonitoringPersonDetailDto getDetail(Long monitoredId) {
        MonitoredPerson m = monitoredPersonRepository.findByIdWithPerson(monitoredId)
                .orElseThrow(() -> new MonitoringNotFoundException("Pessoa monitorada não encontrada: " + monitoredId));
        MonitoringPersonDetailDto d = new MonitoringPersonDetailDto();
        copySummary(m, d);
        d.setMonitorMode(m.getMonitorMode().name());
        d.setMonitorByName(m.isMonitorByName());
        d.setMonitorByCpfCnpj(m.isMonitorByCpfCnpj());
        d.setMonitorByKnownProcesses(m.isMonitorByKnownProcesses());
        d.setPreferredTribunalsJson(m.getPreferredTribunalsJson());
        d.setSearchKeys(searchKeyRepository.findByMonitoredPerson_IdAndEnabledTrueOrderByPriorityAsc(m.getId()).stream()
                .map(this::toKeyDto).collect(Collectors.toList()));
        d.setRecentRuns(monitoringRunRepository.findByMonitoredPerson_IdOrderByStartedAtDesc(m.getId()).stream()
                .limit(20).map(this::toRunDto).collect(Collectors.toList()));
        return d;
    }

    @Transactional
    public MonitoringPersonDetailDto register(MonitoringPersonUpsertRequest req) {
        CadastroPessoa person = cadastroPessoasRepository.findById(req.getPersonId())
                .orElseThrow(() -> new MonitoringNotFoundException("Cadastro de pessoa não encontrado: " + req.getPersonId()));
        MonitoredPerson m = monitoredPersonRepository.findByPerson_Id(person.getId()).orElseGet(MonitoredPerson::new);
        m.setPerson(person);
        applyUpsert(m, req);
        if (m.getId() == null) {
            MonitoringSettings st = monitoringSettingsRepository.findById(1L).orElse(null);
            if (m.getGlobalFrequencyType() == null && st != null) {
                m.setGlobalFrequencyType(st.getDefaultFrequencyType());
            }
            m.setNextRunAt(Instant.now());
        }
        m = monitoredPersonRepository.save(m);
        person.setMarcadoMonitoramento(true);
        cadastroPessoasRepository.save(person);
        seedDefaultKeysIfEmpty(m, person);
        return getDetail(m.getId());
    }

    @Transactional
    public MonitoringPersonDetailDto patch(Long monitoredId, MonitoringPersonPatchRequest req) {
        MonitoredPerson m = monitoredPersonRepository.findById(monitoredId)
                .orElseThrow(() -> new MonitoringNotFoundException("Pessoa monitorada não encontrada: " + monitoredId));
        if (req.getEnabled() != null) {
            m.setEnabled(req.getEnabled());
        }
        if (req.getMonitorMode() != null) {
            m.setMonitorMode(req.getMonitorMode());
        }
        if (req.getGlobalFrequencyType() != null) {
            m.setGlobalFrequencyType(req.getGlobalFrequencyType());
        }
        if (req.getGlobalFrequencyValue() != null) {
            m.setGlobalFrequencyValue(req.getGlobalFrequencyValue());
        }
        if (req.getPreferredTribunalsJson() != null) {
            m.setPreferredTribunalsJson(req.getPreferredTribunalsJson());
        }
        if (req.getMonitorByName() != null) {
            m.setMonitorByName(req.getMonitorByName());
        }
        if (req.getMonitorByCpfCnpj() != null) {
            m.setMonitorByCpfCnpj(req.getMonitorByCpfCnpj());
        }
        if (req.getMonitorByKnownProcesses() != null) {
            m.setMonitorByKnownProcesses(req.getMonitorByKnownProcesses());
        }
        if (req.getGlobalFrequencyType() != null || req.getGlobalFrequencyValue() != null) {
            m.setNextRunAt(frequencyCalculator.computeNextRun(m.getGlobalFrequencyType(), Instant.now()));
        }
        monitoredPersonRepository.save(m);
        return getDetail(monitoredId);
    }

    @Transactional
    public MonitoringSearchKeyDto addSearchKey(Long monitoredId, MonitoringSearchKeyCreateRequest req) {
        MonitoredPerson m = monitoredPersonRepository.findById(monitoredId)
                .orElseThrow(() -> new MonitoringNotFoundException("Pessoa monitorada não encontrada: " + monitoredId));
        MonitoredPersonSearchKey k = new MonitoredPersonSearchKey();
        k.setMonitoredPerson(m);
        k.setKeyType(req.getKeyType());
        k.setKeyValue(req.getKeyValue());
        k.setNormalizedValue(req.getNormalizedValue() != null ? req.getNormalizedValue() : req.getKeyValue());
        k.setEnabled(req.isEnabled());
        k.setPriority(req.getPriority());
        k.setNotes(req.getNotes());
        k = searchKeyRepository.save(k);
        return toKeyDto(k);
    }

    public boolean runNow(Long monitoredId) {
        return monitoringRunExecutor.executeRun(monitoredId, "MANUAL");
    }

    @Transactional(readOnly = true)
    public List<MonitoringRunDto> listRuns(Long monitoredId) {
        return monitoringRunRepository.findByMonitoredPerson_IdOrderByStartedAtDesc(monitoredId).stream()
                .map(this::toRunDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<MonitoringHitDto> listHits(Long monitoredId, HitReviewStatus status) {
        List<MonitoringHit> list = status == null
                ? monitoringHitRepository.findByMonitoredPerson_IdOrderByCreatedAtDesc(monitoredId)
                : monitoringHitRepository.findByMonitoredPerson_IdAndReviewStatusOrderByCreatedAtDesc(monitoredId, status);
        return list.stream().map(this::toHitDto).collect(Collectors.toList());
    }

    @Transactional
    public MonitoringHitDto reviewHit(Long hitId, MonitoringHitReviewRequest req) {
        MonitoringHit h = monitoringHitRepository.findById(hitId)
                .orElseThrow(() -> new MonitoringNotFoundException("Hit não encontrado: " + hitId));
        h.setReviewStatus(req.getReviewStatus());
        h.setLinkedProcessId(req.getLinkedProcessId());
        h.setLinkedClientId(req.getLinkedClientId());
        monitoringHitRepository.save(h);
        return toHitDto(h);
    }

    @Transactional(readOnly = true)
    public MonitoringSettingsDto getSettings() {
        MonitoringSettings s = monitoringSettingsRepository.findById(1L)
                .orElseThrow(() -> new IllegalStateException("monitoring_settings não inicializado"));
        return toSettingsDto(s);
    }

    @Transactional
    public MonitoringSettingsDto updateSettings(MonitoringSettingsDto dto) {
        MonitoringSettings s = monitoringSettingsRepository.findById(1L)
                .orElseThrow(() -> new IllegalStateException("monitoring_settings não inicializado"));
        s.setSchedulerEnabled(dto.isSchedulerEnabled());
        if (dto.getDefaultFrequencyType() != null) {
            s.setDefaultFrequencyType(dto.getDefaultFrequencyType());
        }
        if (dto.getDefaultFrequencyValue() != null) {
            s.setDefaultFrequencyValue(dto.getDefaultFrequencyValue());
        }
        s.setBatchSize(dto.getBatchSize());
        s.setRetryLimit(dto.getRetryLimit());
        s.setRequestTimeoutMs(dto.getRequestTimeoutMs());
        s.setCacheTtlMinutes(dto.getCacheTtlMinutes());
        if (dto.getTribunalRateLimitsJson() != null) {
            s.setTribunalRateLimitsJson(dto.getTribunalRateLimitsJson());
        }
        if (dto.getStrategyFlagsJson() != null) {
            s.setStrategyFlagsJson(dto.getStrategyFlagsJson());
        }
        monitoringSettingsRepository.save(s);
        return toSettingsDto(s);
    }

    public List<DatajudTribunalInfo> listTribunals() {
        return tribunalResolver.listSupportedWithIndex();
    }

    private void applyUpsert(MonitoredPerson m, MonitoringPersonUpsertRequest req) {
        if (req.getEnabled() != null) {
            m.setEnabled(req.getEnabled());
        } else if (m.getId() == null) {
            m.setEnabled(true);
        }
        if (req.getMonitorMode() != null) {
            m.setMonitorMode(req.getMonitorMode());
        } else if (m.getId() == null) {
            m.setMonitorMode(MonitorMode.HYBRID);
        }
        if (req.getGlobalFrequencyType() != null) {
            m.setGlobalFrequencyType(req.getGlobalFrequencyType());
        } else if (m.getId() == null) {
            m.setGlobalFrequencyType(MonitoringFrequencyType.HOURS_6);
        }
        if (req.getGlobalFrequencyValue() != null) {
            m.setGlobalFrequencyValue(req.getGlobalFrequencyValue());
        }
        if (req.getPreferredTribunalsJson() != null) {
            m.setPreferredTribunalsJson(req.getPreferredTribunalsJson());
        }
        if (req.getMonitorByName() != null) {
            m.setMonitorByName(req.getMonitorByName());
        } else if (m.getId() == null) {
            m.setMonitorByName(false);
        }
        if (req.getMonitorByCpfCnpj() != null) {
            m.setMonitorByCpfCnpj(req.getMonitorByCpfCnpj());
        } else if (m.getId() == null) {
            m.setMonitorByCpfCnpj(false);
        }
        if (req.getMonitorByKnownProcesses() != null) {
            m.setMonitorByKnownProcesses(req.getMonitorByKnownProcesses());
        } else if (m.getId() == null) {
            m.setMonitorByKnownProcesses(true);
        }
    }

    private void seedDefaultKeysIfEmpty(MonitoredPerson m, CadastroPessoa person) {
        List<MonitoredPersonSearchKey> existing = searchKeyRepository.findByMonitoredPerson_IdAndEnabledTrueOrderByPriorityAsc(m.getId());
        if (!existing.isEmpty()) {
            return;
        }
        int p = 0;
        String cpfRaw = person.getCpf();
        if (cpfRaw != null && !cpfRaw.isBlank()) {
            MonitoredPersonSearchKey cpf = new MonitoredPersonSearchKey();
            cpf.setMonitoredPerson(m);
            cpf.setKeyType("cpf");
            cpf.setKeyValue(cpfRaw);
            cpf.setNormalizedValue(cpfRaw.replaceAll("\\D", ""));
            cpf.setPriority(p++);
            cpf.setNotes("Gerado automaticamente a partir do cadastro");
            searchKeyRepository.save(cpf);
        }
        String nomeRaw = person.getNome();
        if (nomeRaw != null && !nomeRaw.isBlank()) {
            MonitoredPersonSearchKey nome = new MonitoredPersonSearchKey();
            nome.setMonitoredPerson(m);
            nome.setKeyType("nome");
            nome.setKeyValue(nomeRaw);
            nome.setNormalizedValue(nomeRaw.toUpperCase());
            nome.setPriority(p);
            nome.setNotes("Gerado automaticamente — busca por nome depende do índice do tribunal");
            searchKeyRepository.save(nome);
        }
    }

    private MonitoringPersonSummaryDto toSummary(MonitoredPerson m) {
        MonitoringPersonSummaryDto d = new MonitoringPersonSummaryDto();
        copySummary(m, d);
        return d;
    }

    private void copySummary(MonitoredPerson m, MonitoringPersonSummaryDto d) {
        d.setId(m.getId());
        CadastroPessoa p = m.getPerson();
        if (p != null) {
            d.setPersonId(p.getId());
            d.setNome(p.getNome());
            d.setDocumentoPrincipal(p.getCpf());
        } else {
            d.setPersonId(null);
            d.setNome("—");
            d.setDocumentoPrincipal(null);
        }
        d.setEnabled(m.isEnabled());
        d.setFrequencyType(
                m.getGlobalFrequencyType() != null ? m.getGlobalFrequencyType().name() : MonitoringFrequencyType.HOURS_6.name());
        d.setLastRunAt(m.getLastRunAt());
        d.setNextRunAt(m.getNextRunAt());
        d.setLastStatus(m.getLastStatus());
        d.setTotalHits(monitoringHitRepository.countByMonitoredPerson_Id(m.getId()));
        d.setPendingReviewHits(monitoringHitRepository.countByMonitoredPerson_IdAndReviewStatus(m.getId(), HitReviewStatus.PENDING));
        d.setRecentFailureCount(m.getRecentFailureCount());
    }

    private MonitoringSearchKeyDto toKeyDto(MonitoredPersonSearchKey k) {
        MonitoringSearchKeyDto d = new MonitoringSearchKeyDto();
        d.setId(k.getId());
        d.setKeyType(k.getKeyType());
        d.setKeyValue(k.getKeyValue());
        d.setNormalizedValue(k.getNormalizedValue());
        d.setEnabled(k.isEnabled());
        d.setPriority(k.getPriority());
        d.setNotes(k.getNotes());
        return d;
    }

    private MonitoringRunDto toRunDto(MonitoringRun r) {
        MonitoringRunDto d = new MonitoringRunDto();
        d.setId(r.getId());
        d.setMonitoredPersonId(r.getMonitoredPerson().getId());
        d.setStartedAt(r.getStartedAt());
        d.setFinishedAt(r.getFinishedAt());
        d.setStatus(r.getStatus().name());
        d.setTriggerType(r.getTriggerType());
        d.setTribunalAlias(r.getTribunalAlias());
        d.setQueryStrategy(r.getQueryStrategy());
        d.setTotalHits(r.getTotalHits());
        d.setNewHits(r.getNewHits());
        d.setDuplicatesSkipped(r.getDuplicatesSkipped());
        d.setErrorMessage(r.getErrorMessage());
        d.setDurationMs(r.getDurationMs());
        d.setLimitationNote(r.getLimitationNote());
        return d;
    }

    private MonitoringHitDto toHitDto(MonitoringHit h) {
        MonitoringHitDto d = new MonitoringHitDto();
        d.setId(h.getId());
        d.setMonitoredPersonId(h.getMonitoredPerson().getId());
        d.setMonitoringRunId(h.getMonitoringRun().getId());
        d.setTribunal(h.getTribunal());
        d.setProcessNumber(h.getProcessNumber());
        d.setProcessNumberNormalized(h.getProcessNumberNormalized());
        d.setHitType(h.getHitType());
        d.setSourceStrategy(h.getSourceStrategy());
        d.setClassName(h.getClassName());
        d.setCourtUnitName(h.getCourtUnitName());
        d.setLastMovementName(h.getLastMovementName());
        d.setLastMovementAt(h.getLastMovementAt());
        d.setMatchScore(h.getMatchScore());
        d.setMatchReason(h.getMatchReason());
        d.setReviewStatus(h.getReviewStatus().name());
        d.setSuggestedLinkNote(h.getSuggestedLinkNote());
        d.setLinkedProcessId(h.getLinkedProcessId());
        d.setLinkedClientId(h.getLinkedClientId());
        d.setRawPayloadJson(h.getRawPayloadJson());
        d.setCreatedAt(h.getCreatedAt());
        return d;
    }

    private MonitoringSettingsDto toSettingsDto(MonitoringSettings s) {
        MonitoringSettingsDto d = new MonitoringSettingsDto();
        d.setId(s.getId());
        d.setSchedulerEnabled(s.isSchedulerEnabled());
        d.setDefaultFrequencyType(s.getDefaultFrequencyType());
        d.setDefaultFrequencyValue(s.getDefaultFrequencyValue());
        d.setBatchSize(s.getBatchSize());
        d.setRetryLimit(s.getRetryLimit());
        d.setRequestTimeoutMs(s.getRequestTimeoutMs());
        d.setCacheTtlMinutes(s.getCacheTtlMinutes());
        d.setTribunalRateLimitsJson(s.getTribunalRateLimitsJson());
        d.setStrategyFlagsJson(s.getStrategyFlagsJson());
        return d;
    }
}
