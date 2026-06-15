package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaBancariaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContaBancariaRepository extends JpaRepository<ContaBancariaEntity, Long> {

    Optional<ContaBancariaEntity> findByNumeroBanco(Integer numeroBanco);

    List<ContaBancariaEntity> findByTipo(String tipo);

    List<ContaBancariaEntity> findAllByOrderByNumeroBancoAsc();
}
