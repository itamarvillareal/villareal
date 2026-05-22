package br.com.vilareal.pagamento.infrastructure.persistence.repository;

import br.com.vilareal.pagamento.infrastructure.persistence.entity.PrestacaoContasPagamentoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PrestacaoContasPagamentoRepository extends JpaRepository<PrestacaoContasPagamentoEntity, Long> {

    List<PrestacaoContasPagamentoEntity> findByPrestacaoContas_IdOrderByIdAsc(Long prestacaoContasId);

    Optional<PrestacaoContasPagamentoEntity> findByPagamento_Id(Long pagamentoId);

    void deleteByPrestacaoContas_Id(Long prestacaoContasId);
}
