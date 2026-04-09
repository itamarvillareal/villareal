package br.com.vilareal.imovel.infrastructure.persistence.repository;

import br.com.vilareal.imovel.infrastructure.persistence.entity.LocacaoDespesaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LocacaoDespesaRepository extends JpaRepository<LocacaoDespesaEntity, Long> {

    List<LocacaoDespesaEntity> findByContratoLocacao_IdOrderByCompetenciaMesDescIdDesc(Long contratoLocacaoId);
}
