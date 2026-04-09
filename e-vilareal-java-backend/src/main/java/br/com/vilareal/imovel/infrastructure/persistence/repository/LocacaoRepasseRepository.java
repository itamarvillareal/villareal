package br.com.vilareal.imovel.infrastructure.persistence.repository;

import br.com.vilareal.imovel.infrastructure.persistence.entity.LocacaoRepasseEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LocacaoRepasseRepository extends JpaRepository<LocacaoRepasseEntity, Long> {

    List<LocacaoRepasseEntity> findByContratoLocacao_IdOrderByCompetenciaMesDescIdDesc(Long contratoLocacaoId);
}
