package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.PagamentoFaturaVinculoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface PagamentoFaturaVinculoRepository extends JpaRepository<PagamentoFaturaVinculoEntity, Long> {

    Optional<PagamentoFaturaVinculoEntity> findByLancamentoBancoId(Long lancamentoBancoId);

    Optional<PagamentoFaturaVinculoEntity> findByLancamentoCartaoId(Long lancamentoCartaoId);

    @Query("SELECT v.lancamentoBanco.id FROM PagamentoFaturaVinculoEntity v")
    List<Long> findAllLancamentoBancoIds();

    @Query("SELECT v.lancamentoCartao.id FROM PagamentoFaturaVinculoEntity v")
    List<Long> findAllLancamentoCartaoIds();
}
