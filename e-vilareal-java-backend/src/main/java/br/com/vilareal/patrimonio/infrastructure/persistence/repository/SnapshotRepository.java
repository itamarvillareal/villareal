package br.com.vilareal.patrimonio.infrastructure.persistence.repository;

import br.com.vilareal.patrimonio.infrastructure.persistence.entity.SnapshotEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SnapshotRepository extends JpaRepository<SnapshotEntity, Long> {
    Optional<SnapshotEntity> findByDataRef(LocalDate dataRef);

    List<SnapshotEntity> findByDataRefGreaterThanEqualOrderByDataRefAsc(LocalDate desde);
}
