package br.com.vilareal.iptu.infrastructure.persistence.repository;

import br.com.vilareal.iptu.infrastructure.persistence.entity.IptuParcelaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface IptuParcelaRepository
        extends JpaRepository<IptuParcelaEntity, Long>, JpaSpecificationExecutor<IptuParcelaEntity> {

    List<IptuParcelaEntity> findByIptuAnual_IdOrderByCompetenciaMesAsc(Long iptuAnualId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from IptuParcelaEntity p where p.iptuAnual.id = :anualId and p.status in :st")
    int deleteByIptuAnual_IdAndStatusIn(@Param("anualId") Long anualId, @Param("st") Collection<String> status);

    List<IptuParcelaEntity> findByContratoLocacao_Id(Long contratoLocacaoId);
}
