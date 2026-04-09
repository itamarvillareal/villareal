package br.com.vilareal.imovel.infrastructure.persistence.repository;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ImovelRepository extends JpaRepository<ImovelEntity, Long> {

    List<ImovelEntity> findAllByOrderByIdAsc();

    Optional<ImovelEntity> findByNumeroPlanilha(Integer numeroPlanilha);

    Optional<ImovelEntity> findFirstByProcesso_IdOrderByIdAsc(Long processoId);
}
