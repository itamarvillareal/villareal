package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.MonitoringRun;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MonitoringRunRepository extends JpaRepository<MonitoringRun, Long> {

    List<MonitoringRun> findByMonitoredPerson_IdOrderByStartedAtDesc(Long monitoredPersonId);
}
