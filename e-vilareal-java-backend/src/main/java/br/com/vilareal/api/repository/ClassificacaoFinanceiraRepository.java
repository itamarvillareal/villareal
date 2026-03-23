package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.ClassificacaoFinanceira;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClassificacaoFinanceiraRepository extends JpaRepository<ClassificacaoFinanceira, Long> {
}
