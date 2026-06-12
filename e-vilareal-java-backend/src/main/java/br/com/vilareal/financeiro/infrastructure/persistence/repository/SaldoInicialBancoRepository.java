package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.SaldoInicialBancoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

/** Saldo de abertura por conta bancária ({@code numero_banco}). Ver V107. */
public interface SaldoInicialBancoRepository extends JpaRepository<SaldoInicialBancoEntity, Integer> {
}
