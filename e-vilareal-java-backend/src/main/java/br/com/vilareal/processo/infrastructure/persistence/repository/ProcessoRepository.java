package br.com.vilareal.processo.infrastructure.persistence.repository;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProcessoRepository extends JpaRepository<ProcessoEntity, Long> {

    List<ProcessoEntity> findByPessoa_IdOrderByNumeroInternoAsc(Long pessoaId);

    Optional<ProcessoEntity> findByPessoa_IdAndNumeroInterno(Long pessoaId, Integer numeroInterno);
}
