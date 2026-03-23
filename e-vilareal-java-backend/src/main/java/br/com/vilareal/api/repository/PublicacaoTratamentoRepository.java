package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.PublicacaoTratamento;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PublicacaoTratamentoRepository extends JpaRepository<PublicacaoTratamento, Long> {
    List<PublicacaoTratamento> findByPublicacao_IdOrderByCreatedAtDesc(Long publicacaoId);
}
