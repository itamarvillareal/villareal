package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.MonitoredPersonSearchKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MonitoredPersonSearchKeyRepository extends JpaRepository<MonitoredPersonSearchKey, Long> {

    List<MonitoredPersonSearchKey> findByMonitoredPerson_IdAndEnabledTrueOrderByPriorityAsc(Long monitoredPersonId);
}
