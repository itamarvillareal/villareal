package br.com.vilareal.pagamento.infrastructure.persistence.repository;

import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoHistoricoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PagamentoHistoricoRepository extends JpaRepository<PagamentoHistoricoEntity, Long> {
    List<PagamentoHistoricoEntity> findByPagamento_IdOrderByCriadoEmDesc(Long pagamentoId);
}
