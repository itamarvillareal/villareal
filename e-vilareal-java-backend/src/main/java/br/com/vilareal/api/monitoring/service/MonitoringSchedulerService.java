package br.com.vilareal.api.monitoring.service;

import br.com.vilareal.api.entity.MonitoredPerson;
import br.com.vilareal.api.entity.MonitoringSettings;
import br.com.vilareal.api.repository.MonitoredPersonRepository;
import br.com.vilareal.api.repository.MonitoringSettingsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * Agenda execuções automáticas respeitando batch, flag global e anti-concorrência por pessoa.
 */
@Service
public class MonitoringSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(MonitoringSchedulerService.class);

    private final MonitoredPersonRepository monitoredPersonRepository;
    private final MonitoringSettingsRepository monitoringSettingsRepository;
    private final MonitoringRunExecutor monitoringRunExecutor;

    public MonitoringSchedulerService(
            MonitoredPersonRepository monitoredPersonRepository,
            MonitoringSettingsRepository monitoringSettingsRepository,
            MonitoringRunExecutor monitoringRunExecutor) {
        this.monitoredPersonRepository = monitoredPersonRepository;
        this.monitoringSettingsRepository = monitoringSettingsRepository;
        this.monitoringRunExecutor = monitoringRunExecutor;
    }

    @Scheduled(fixedDelayString = "${vilareal.monitoring.scheduler.fixed-delay-ms:60000}")
    public void tick() {
        MonitoringSettings st = monitoringSettingsRepository.findById(1L).orElse(null);
        if (st == null || !st.isSchedulerEnabled()) {
            return;
        }
        Instant now = Instant.now();
        List<MonitoredPerson> due = monitoredPersonRepository.findDueForRun(now);
        int n = 0;
        for (MonitoredPerson m : due) {
            if (n >= st.getBatchSize()) {
                break;
            }
            try {
                boolean started = monitoringRunExecutor.executeRun(m.getId(), "SCHEDULED");
                if (started) {
                    n++;
                }
            } catch (Exception e) {
                log.warn("Scheduler: falha personId={} monitoredId={}", m.getPerson().getId(), m.getId(), e);
            }
        }
    }
}
