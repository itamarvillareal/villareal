package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.AcertoFechamentoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AcertoFechamentoRepository extends JpaRepository<AcertoFechamentoEntity, Long> {

    List<AcertoFechamentoEntity> findByCliente_IdAndNumeroBancoOrderByIdDesc(Long clienteId, Integer numeroBanco);

    Optional<AcertoFechamentoEntity> findFirstByCliente_IdAndNumeroBancoAndStatusOrderByIdDesc(
            Long clienteId, Integer numeroBanco, String status);

    boolean existsByCliente_IdAndNumeroBancoAndStatus(Long clienteId, Integer numeroBanco, String status);
}
