package br.com.vilareal.patrimonio.infrastructure.persistence.repository;

import br.com.vilareal.patrimonio.infrastructure.persistence.entity.ImovelPatrimonioEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ImovelPatrimonioRepository extends JpaRepository<ImovelPatrimonioEntity, Long> {
    List<ImovelPatrimonioEntity> findByAtivoTrue();
}
