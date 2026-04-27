package br.com.vilareal.iptu.infrastructure.persistence.repository;

import br.com.vilareal.iptu.infrastructure.persistence.entity.IptuAnualEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface IptuAnualRepository extends JpaRepository<IptuAnualEntity, Long> {

    Optional<IptuAnualEntity> findByImovel_IdAndAnoReferencia(Long imovelId, short anoReferencia);

    List<IptuAnualEntity> findByImovel_IdOrderByAnoReferenciaDesc(Long imovelId);

    List<IptuAnualEntity> findByAnoReferencia(short anoReferencia);

    List<IptuAnualEntity> findByImovel_IdAndAnoReferenciaBetween(Long imovelId, short anoIni, short anoFim);
}
