package br.com.vilareal.iptu.infrastructure.persistence.repository;

import br.com.vilareal.iptu.infrastructure.persistence.entity.IptuConsultaDebitoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IptuConsultaDebitoRepository extends JpaRepository<IptuConsultaDebitoEntity, Long> {

    List<IptuConsultaDebitoEntity> findByImovel_IdOrderByDataConsultaDescIdDesc(Long imovelId);
}
