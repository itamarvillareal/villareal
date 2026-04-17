package br.com.vilareal.publicacao.infrastructure.persistence.repository;

import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface PublicacaoRepository extends JpaRepository<PublicacaoEntity, Long>, JpaSpecificationExecutor<PublicacaoEntity> {

    boolean existsByHashConteudo(String hashConteudo);
}
