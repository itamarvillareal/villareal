package br.com.vilareal.calculo.infrastructure.persistence.repository;

import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoRodadaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CalculoRodadaRepository extends JpaRepository<CalculoRodadaEntity, Long> {

    Optional<CalculoRodadaEntity> findByCodigoClienteAndNumeroProcessoAndDimensao(
            String codigoCliente, Integer numeroProcesso, Integer dimensao);
}
