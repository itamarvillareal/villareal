package br.com.vilareal.imovel.infrastructure.persistence.repository;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelVinculoLocatarioEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ImovelVinculoLocatarioRepository extends JpaRepository<ImovelVinculoLocatarioEntity, Long> {

    Optional<ImovelVinculoLocatarioEntity> findByNumeroPlanilhaAndCodigoClienteAndNumeroInterno(
            Integer numeroPlanilha, String codigoCliente, Integer numeroInterno);

    List<ImovelVinculoLocatarioEntity> findByNumeroPlanilhaOrderByUpdatedAtDesc(Integer numeroPlanilha);
}
