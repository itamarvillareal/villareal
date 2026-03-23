package br.com.vilareal.api.monitoring.service;

import br.com.vilareal.api.entity.*;
import br.com.vilareal.api.monitoring.datajud.*;
import br.com.vilareal.api.monitoring.domain.HitReviewStatus;
import br.com.vilareal.api.monitoring.domain.MonitorMode;
import br.com.vilareal.api.monitoring.domain.MonitoringRunStatus;
import br.com.vilareal.api.repository.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Orquestra execução de monitoramento (estratégias A–D, deduplicação, persistência de runs/hits).
 */
@Service
public class MonitoringRunExecutor {

    private static final Logger log = LoggerFactory.getLogger(MonitoringRunExecutor.class);

    private final MonitoredPersonRepository monitoredPersonRepository;
    private final MonitoredPersonSearchKeyRepository searchKeyRepository;
    private final MonitoringRunRepository monitoringRunRepository;
    private final MonitoringHitRepository monitoringHitRepository;
    private final DatajudPublicApiClient datajudClient;
    private final DatajudTribunalResolver tribunalResolver;
    private final MonitoringDedupService dedupService;
    private final MonitoringMatchScoringService matchScoring;
    private final MonitoringFrequencyCalculator frequencyCalculator;
    private final ObjectMapper objectMapper;

    private final ConcurrentHashMap<Long, Boolean> inFlight = new ConcurrentHashMap<>();

    public MonitoringRunExecutor(
            MonitoredPersonRepository monitoredPersonRepository,
            MonitoredPersonSearchKeyRepository searchKeyRepository,
            MonitoringRunRepository monitoringRunRepository,
            MonitoringHitRepository monitoringHitRepository,
            DatajudPublicApiClient datajudClient,
            DatajudTribunalResolver tribunalResolver,
            MonitoringDedupService dedupService,
            MonitoringMatchScoringService matchScoring,
            MonitoringFrequencyCalculator frequencyCalculator,
            ObjectMapper objectMapper) {
        this.monitoredPersonRepository = monitoredPersonRepository;
        this.searchKeyRepository = searchKeyRepository;
        this.monitoringRunRepository = monitoringRunRepository;
        this.monitoringHitRepository = monitoringHitRepository;
        this.datajudClient = datajudClient;
        this.tribunalResolver = tribunalResolver;
        this.dedupService = dedupService;
        this.matchScoring = matchScoring;
        this.frequencyCalculator = frequencyCalculator;
        this.objectMapper = objectMapper;
    }

    /**
     * @return false se já havia execução concorrente para a mesma pessoa monitorada.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean executeRun(Long monitoredPersonId, String triggerType) {
        if (inFlight.putIfAbsent(monitoredPersonId, Boolean.TRUE) != null) {
            return false;
        }
        try {
            runInternal(monitoredPersonId, triggerType);
            return true;
        } finally {
            inFlight.remove(monitoredPersonId);
        }
    }

    private void runInternal(Long monitoredPersonId, String triggerType) {
        MonitoredPerson mp = monitoredPersonRepository.findByIdWithPerson(monitoredPersonId).orElse(null);
        if (mp == null || !mp.isEnabled()) {
            return;
        }
        if (mp.getExecutionLockUntil() != null && mp.getExecutionLockUntil().isAfter(Instant.now())) {
            return;
        }
        mp.setExecutionLockUntil(Instant.now().plus(15, ChronoUnit.MINUTES));
        monitoredPersonRepository.save(mp);

        Instant started = Instant.now();
        MonitoringRun run = new MonitoringRun();
        run.setMonitoredPerson(mp);
        run.setStartedAt(started);
        run.setStatus(MonitoringRunStatus.RUNNING);
        run.setTriggerType(triggerType != null ? triggerType : "SCHEDULED");
        run.setQueryStrategy("MULTI");
        monitoringRunRepository.save(run);

        int total = 0;
        int newHits = 0;
        int dups = 0;
        StringBuilder limitation = new StringBuilder();
        StringBuilder summary = new StringBuilder();

        try {
            var person = mp.getPerson();

            List<MonitoredPersonSearchKey> keys = searchKeyRepository.findByMonitoredPerson_IdAndEnabledTrueOrderByPriorityAsc(mp.getId());

            if (mp.isMonitorByKnownProcesses()) {
                for (MonitoredPersonSearchKey key : keys) {
                    if (!"numero_processo".equalsIgnoreCase(key.getKeyType())) {
                        continue;
                    }
                    Optional<String> cnjOpt = CnjFormatUtil.extractFirstCnj(key.getKeyValue());
                    if (cnjOpt.isEmpty()) {
                        continue;
                    }
                    String cnj = cnjOpt.get();
                    var tribOpt = tribunalResolver.resolveByCnj(cnj);
                    if (tribOpt.isEmpty() || tribOpt.get().apiIndex() == null) {
                        limitation.append("CNJ sem índice mapeado: ").append(cnj).append("; ");
                        continue;
                    }
                    var trib = tribOpt.get();
                    var body = datajudClient.buildProcessNumberQuery(cnj, 3);
                    run.setTribunalAlias(trib.apiIndex());
                    run.setRequestPayload(truncateJson(body));
                    DatajudSearchResult res = datajudClient.search(trib.apiIndex(), body);
                    if (!res.ok()) {
                        limitation.append(trib.sigla()).append(": ").append(res.motivo()).append("; ");
                        summary.append(res.motivo()).append(" ");
                        continue;
                    }
                    List<Map<String, Object>> hits = DatajudElasticResponseParser.extractHits(res.responseJson());
                    total += hits.size();
                    for (Map<String, Object> h : hits) {
                        Map<String, Object> src = DatajudElasticResponseParser.sourceOfHit(h);
                        var lm = DatajudElasticResponseParser.lastMovement(src);
                        String num = DatajudElasticResponseParser.numeroProcesso(src);
                        if (num.isBlank()) {
                            num = cnj;
                        }
                        String sigilo = DatajudElasticResponseParser.nivelSigilo(src);
                        MonitoringMatchScoringService.Score sc = sigilo != null && !sigilo.isBlank() && !"0".equals(sigilo)
                                ? matchScoring.scoreSigiloso()
                                : matchScoring.scoreKnownProcessRequery();
                        String fp = fingerprint(src);
                        String dedup = dedupService.buildHash(mp.getId(), trib.sigla(), num.toUpperCase(Locale.ROOT),
                                "processo_ja_conhecido_atualizado", lm.dataHora(), fp);
                        if (monitoringHitRepository.findFirstByDedupHash(dedup).isPresent()) {
                            dups++;
                            continue;
                        }
                        MonitoringHit hit = buildHit(mp, run, trib.sigla(), num, src, lm, sc, dedup,
                                "processo_ja_conhecido_atualizado", "SearchByKnownProcessesStrategy");
                        monitoringHitRepository.save(hit);
                        newHits++;
                    }
                }
            }

            if (mp.getMonitorMode() != MonitorMode.KNOWN_PROCESSES_ONLY && mp.isMonitorByCpfCnpj()) {
                String cpfDigits = person.getCpf() != null ? person.getCpf().replaceAll("\\D", "") : "";
                if (cpfDigits.length() >= 11) {
                    var tribunals = tribunalResolver.listSupportedWithIndex().stream()
                            .filter(t -> t.apiIndex() != null)
                            .limit(2)
                            .toList();
                    boolean anyAttempt = false;
                    for (var t : tribunals) {
                        anyAttempt = true;
                        var q = datajudClient.buildFuzzyPartyQuery(cpfDigits, 5);
                        DatajudSearchResult res = datajudClient.search(t.apiIndex(), q);
                        if (!res.ok()) {
                            limitation.append("Busca por documento não suportada ou erro em ")
                                    .append(t.sigla()).append(": ").append(res.motivo()).append("; ");
                            continue;
                        }
                        List<Map<String, Object>> hits = DatajudElasticResponseParser.extractHits(res.responseJson());
                        total += hits.size();
                        for (Map<String, Object> h : hits) {
                            Map<String, Object> src = DatajudElasticResponseParser.sourceOfHit(h);
                            var lm = DatajudElasticResponseParser.lastMovement(src);
                            String num = DatajudElasticResponseParser.numeroProcesso(src);
                            if (num.isBlank()) {
                                continue;
                            }
                            MonitoringMatchScoringService.Score sc = matchScoring.scoreDocumentKeyMatch();
                            String fp = fingerprint(src);
                            String dedup = dedupService.buildHash(mp.getId(), t.sigla(), num.toUpperCase(Locale.ROOT),
                                    "novo_processo_suspeito", lm.dataHora(), fp);
                            if (monitoringHitRepository.findFirstByDedupHash(dedup).isPresent()) {
                                dups++;
                                continue;
                            }
                            MonitoringHit hit = buildHit(mp, run, t.sigla(), num, src, lm, sc, dedup,
                                    "novo_processo_suspeito", "SearchByDocumentStrategy");
                            hit.setSuggestedLinkNote("Possível vínculo por CPF — revisar antes de gravar no processo interno.");
                            monitoringHitRepository.save(hit);
                            newHits++;
                        }
                    }
                    if (!anyAttempt) {
                        limitation.append("Nenhum tribunal com índice configurado para busca ampla por documento.");
                    }
                }
            }

            if (mp.getMonitorMode() != MonitorMode.KNOWN_PROCESSES_ONLY && mp.isMonitorByName() && person.getNome() != null) {
                limitation.append("Busca por nome completa não executada automaticamente (alto risco de falso positivo); use chaves manuais ou processos conhecidos.");
            }

            run.setStatus(limitation.isEmpty() ? MonitoringRunStatus.SUCCESS : MonitoringRunStatus.PARTIAL);
            if (limitation.toString().contains("sem índice") && newHits == 0 && total == 0) {
                run.setStatus(MonitoringRunStatus.NO_PUBLIC_SUPPORT);
            }
            run.setLimitationNote(limitation.isEmpty() ? null : limitation.toString());
        } catch (Exception e) {
            log.error("Monitoramento falhou person={}", monitoredPersonId, e);
            run.setStatus(MonitoringRunStatus.FAILED);
            run.setErrorMessage(truncate(e.getMessage(), 2000));
        }

        run.setFinishedAt(Instant.now());
        run.setDurationMs(ChronoUnit.MILLIS.between(started, run.getFinishedAt()));
        run.setTotalHits(total);
        run.setNewHits(newHits);
        run.setDuplicatesSkipped(dups);
        run.setUpdatedHits(0);
        run.setResponseSummary(summary.length() > 0 ? summary.toString() : "OK");
        monitoringRunRepository.save(run);

        mp.setLastRunAt(run.getFinishedAt());
        mp.setNextRunAt(frequencyCalculator.computeNextRun(mp.getGlobalFrequencyType(), run.getFinishedAt()));
        mp.setLastStatus(run.getStatus().name());
        mp.setExecutionLockUntil(null);
        if (run.getStatus() == MonitoringRunStatus.FAILED) {
            mp.setRecentFailureCount(mp.getRecentFailureCount() + 1);
        } else {
            mp.setRecentFailureCount(0);
        }
        monitoredPersonRepository.save(mp);
    }

    private MonitoringHit buildHit(MonitoredPerson mp, MonitoringRun run, String tribunal, String num,
                                   Map<String, Object> src, DatajudElasticResponseParser.LastMovement lm,
                                   MonitoringMatchScoringService.Score sc, String dedup, String hitType, String strategy) {
        MonitoringHit hit = new MonitoringHit();
        hit.setMonitoredPerson(mp);
        hit.setMonitoringRun(run);
        hit.setTribunal(tribunal);
        hit.setProcessNumber(num);
        hit.setProcessNumberNormalized(num.toUpperCase(Locale.ROOT));
        hit.setHitType(hitType);
        hit.setSourceStrategy(strategy);
        hit.setClassName(DatajudElasticResponseParser.classeNome(src));
        hit.setCourtUnitName(DatajudElasticResponseParser.orgaoJulgadorNome(src));
        hit.setLastMovementName(lm.texto());
        hit.setLastMovementAt(lm.dataHora());
        hit.setSecrecyLevel(DatajudElasticResponseParser.nivelSigilo(src));
        hit.setMatchScore(sc.level());
        hit.setMatchReason(sc.reason());
        hit.setDedupHash(dedup);
        hit.setReviewStatus(HitReviewStatus.PENDING);
        try {
            hit.setRawPayloadJson(objectMapper.writeValueAsString(src));
        } catch (JsonProcessingException e) {
            hit.setRawPayloadJson("{}");
        }
        return hit;
    }

    private String fingerprint(Map<String, Object> src) {
        try {
            String j = objectMapper.writeValueAsString(src);
            return j.length() > 400 ? j.substring(0, 400) : j;
        } catch (JsonProcessingException e) {
            return "";
        }
    }

    private String truncateJson(Map<String, Object> body) {
        try {
            return truncate(objectMapper.writeValueAsString(body), 8000);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
