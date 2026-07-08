package br.com.vilareal.documento.importacao.infrastructure.persistence.repository;

import br.com.vilareal.documento.importacao.infrastructure.persistence.entity.ContratoHonorariosCobrancaArmadaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ContratoHonorariosCobrancaArmadaRepository
        extends JpaRepository<ContratoHonorariosCobrancaArmadaEntity, Long> {

    Optional<ContratoHonorariosCobrancaArmadaEntity> findByContratoHonorarios_Id(Long contratoHonorariosId);
}
