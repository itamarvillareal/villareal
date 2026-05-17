package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.CartaoEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CartaoRepository extends JpaRepository<CartaoEntity, Long> {

    List<CartaoEntity> findByAtivoTrueOrderByOrdemExibicaoAscIdAsc();

    Optional<CartaoEntity> findByNomeIgnoreCase(String nome);

    Optional<CartaoEntity> findByNumeroCartao(Integer numeroCartao);
}
