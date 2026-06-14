package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.RecorrenciaPadraoDescarteEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RecorrenciaPadraoDescarteRepository extends JpaRepository<RecorrenciaPadraoDescarteEntity, Long> {

    List<RecorrenciaPadraoDescarteEntity> findByNumeroBanco(Integer numeroBanco);

    List<RecorrenciaPadraoDescarteEntity> findAll();
}
