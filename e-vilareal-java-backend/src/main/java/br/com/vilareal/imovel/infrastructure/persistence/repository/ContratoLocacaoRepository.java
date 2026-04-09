package br.com.vilareal.imovel.infrastructure.persistence.repository;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ContratoLocacaoRepository extends JpaRepository<ContratoLocacaoEntity, Long> {

    List<ContratoLocacaoEntity> findByImovel_IdOrderByDataInicioDescIdDesc(Long imovelId);
}
