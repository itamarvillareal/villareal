package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.EloFinanceiro;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EloFinanceiroRepository extends JpaRepository<EloFinanceiro, Long> {
    Optional<EloFinanceiro> findByCodigo(String codigo);
}
