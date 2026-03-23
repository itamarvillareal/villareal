package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.MonitoredPerson;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface MonitoredPersonRepository extends JpaRepository<MonitoredPerson, Long> {

    @Query("SELECT m FROM MonitoredPerson m JOIN FETCH m.person WHERE m.id = :id")
    Optional<MonitoredPerson> findByIdWithPerson(@Param("id") Long id);

    Optional<MonitoredPerson> findByPerson_Id(Long personId);

    @Query("SELECT DISTINCT m FROM MonitoredPerson m JOIN FETCH m.person WHERE m.enabled = true AND m.nextRunAt IS NOT NULL AND m.nextRunAt <= :now ORDER BY m.nextRunAt ASC")
    List<MonitoredPerson> findDueForRun(@Param("now") Instant now);
}
