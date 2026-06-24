package br.com.vilareal.imovel.infrastructure.persistence.repository;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelVinculoProcessoPrincipalEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImovelVinculoProcessoPrincipalRepository
        extends JpaRepository<ImovelVinculoProcessoPrincipalEntity, Integer> {}
