package br.com.vilareal.patrimonio.infrastructure.persistence.repository;

import br.com.vilareal.patrimonio.infrastructure.persistence.entity.OperacaoOpcaoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OperacaoOpcaoRepository extends JpaRepository<OperacaoOpcaoEntity, Long> {
    List<OperacaoOpcaoEntity> findByStatus(String status);
}
