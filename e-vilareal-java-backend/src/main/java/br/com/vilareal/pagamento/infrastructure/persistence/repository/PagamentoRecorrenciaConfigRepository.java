package br.com.vilareal.pagamento.infrastructure.persistence.repository;

import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoRecorrenciaConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PagamentoRecorrenciaConfigRepository extends JpaRepository<PagamentoRecorrenciaConfigEntity, Long> {

    List<PagamentoRecorrenciaConfigEntity> findByAtivoTrueOrderByIdAsc();

    List<PagamentoRecorrenciaConfigEntity> findByImovel_IdAndAtivoTrueOrderByIdAsc(Long imovelId);
}
