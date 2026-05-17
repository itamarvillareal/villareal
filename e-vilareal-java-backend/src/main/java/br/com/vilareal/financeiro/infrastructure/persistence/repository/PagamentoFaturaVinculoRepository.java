package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.PagamentoFaturaVinculoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PagamentoFaturaVinculoRepository extends JpaRepository<PagamentoFaturaVinculoEntity, Long> {

    Optional<PagamentoFaturaVinculoEntity> findByLancamentoBancoId(Long lancamentoBancoId);

    Optional<PagamentoFaturaVinculoEntity> findByLancamentoCartaoId(Long lancamentoCartaoId);
}
