package br.com.vilareal.processo.infrastructure.persistence.repository;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteAdvogadoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProcessoParteAdvogadoRepository extends JpaRepository<ProcessoParteAdvogadoEntity, Long> {

    List<ProcessoParteAdvogadoEntity> findByProcessoParte_IdOrderByOrdemAscIdAsc(Long processoParteId);

    void deleteByProcessoParte_Id(Long processoParteId);
}
