package br.com.vilareal.imovel.infrastructure.persistence.repository;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelProcessoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ImovelProcessoRepository extends JpaRepository<ImovelProcessoEntity, Long> {

    List<ImovelProcessoEntity> findByImovel_IdOrderByCreatedAtDescIdDesc(Long imovelId);

    List<ImovelProcessoEntity> findByProcesso_IdOrderByIdAsc(Long processoId);

    Optional<ImovelProcessoEntity> findByImovel_IdAndProcesso_Id(Long imovelId, Long processoId);

    List<ImovelProcessoEntity> findByImovel_IdAndAtivoTrueOrderByIdDesc(Long imovelId);

    Optional<ImovelProcessoEntity> findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(Long imovelId);

    Optional<ImovelProcessoEntity> findFirstByProcesso_IdOrderByIdAsc(Long processoId);
}
