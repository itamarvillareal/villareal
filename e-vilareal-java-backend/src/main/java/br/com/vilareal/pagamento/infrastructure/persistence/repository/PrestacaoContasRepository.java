package br.com.vilareal.pagamento.infrastructure.persistence.repository;

import br.com.vilareal.pagamento.domain.PrestacaoContasStatus;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PrestacaoContasEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface PrestacaoContasRepository extends JpaRepository<PrestacaoContasEntity, Long> {

    List<PrestacaoContasEntity> findByCliente_IdOrderByCriadoEmDesc(Long clienteId);

    List<PrestacaoContasEntity> findByCliente_IdAndStatusOrderByCriadoEmDesc(
            Long clienteId, PrestacaoContasStatus status);

    List<PrestacaoContasEntity> findByPeriodoInicioGreaterThanEqualAndPeriodoFimLessThanEqualOrderByCriadoEmDesc(
            LocalDate periodoInicio, LocalDate periodoFim);
}
