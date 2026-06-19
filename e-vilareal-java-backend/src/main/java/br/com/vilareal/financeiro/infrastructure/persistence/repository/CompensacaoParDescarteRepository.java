package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.CompensacaoParDescarteEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompensacaoParDescarteRepository extends JpaRepository<CompensacaoParDescarteEntity, Long> {

    boolean existsByLancamentoIdMenorAndLancamentoIdMaior(Long lancamentoIdMenor, Long lancamentoIdMaior);
}
