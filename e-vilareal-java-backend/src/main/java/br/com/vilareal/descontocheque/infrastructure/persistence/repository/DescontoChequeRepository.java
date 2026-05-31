package br.com.vilareal.descontocheque.infrastructure.persistence.repository;

import br.com.vilareal.descontocheque.infrastructure.persistence.entity.DescontoChequeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DescontoChequeRepository extends JpaRepository<DescontoChequeEntity, Long> {

    List<DescontoChequeEntity> findAllByOrderByIdDesc();
}
