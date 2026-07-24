package br.com.vilareal.patrimonio.infrastructure.persistence.repository;

import br.com.vilareal.patrimonio.infrastructure.persistence.entity.PassivoParcelaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PassivoParcelaRepository extends JpaRepository<PassivoParcelaEntity, Long> {
    List<PassivoParcelaEntity> findByPassivoIdAndStatusOrderByNumeroAsc(Long passivoId, String status);

    void deleteByPassivoId(Long passivoId);
}
