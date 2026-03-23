package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.DespesaLocacao;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DespesaLocacaoRepository extends JpaRepository<DespesaLocacao, Long> {
    List<DespesaLocacao> findByContratoIdOrderByIdDesc(Long contratoId);
}
