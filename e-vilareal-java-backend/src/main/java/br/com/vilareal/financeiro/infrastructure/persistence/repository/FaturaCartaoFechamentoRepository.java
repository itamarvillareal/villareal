package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.FaturaCartaoFechamentoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface FaturaCartaoFechamentoRepository extends JpaRepository<FaturaCartaoFechamentoEntity, Long> {

    Optional<FaturaCartaoFechamentoEntity> findByCartaoIdAndDataVencimento(Long cartaoId, LocalDate dataVencimento);

    Optional<FaturaCartaoFechamentoEntity> findByLancamentoCartaoId(Long lancamentoCartaoId);
}
