package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.MonitoringHit;
import br.com.vilareal.api.monitoring.domain.HitReviewStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MonitoringHitRepository extends JpaRepository<MonitoringHit, Long> {

    long countByMonitoredPerson_IdAndReviewStatus(Long monitoredPersonId, HitReviewStatus reviewStatus);

    long countByMonitoredPerson_Id(Long monitoredPersonId);

    List<MonitoringHit> findByMonitoredPerson_IdOrderByCreatedAtDesc(Long monitoredPersonId);

    List<MonitoringHit> findByMonitoredPerson_IdAndReviewStatusOrderByCreatedAtDesc(Long monitoredPersonId, HitReviewStatus reviewStatus);

    Optional<MonitoringHit> findFirstByDedupHash(String dedupHash);
}
