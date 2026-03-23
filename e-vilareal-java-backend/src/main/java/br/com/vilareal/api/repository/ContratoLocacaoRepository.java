package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.ContratoLocacao;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ContratoLocacaoRepository extends JpaRepository<ContratoLocacao, Long> {
    List<ContratoLocacao> findByImovelIdOrderByDataInicioDesc(Long imovelId);

    @Query("SELECT c FROM ContratoLocacao c JOIN c.imovel i WHERE i.cliente.id = :clienteId ORDER BY c.dataInicio DESC")
    List<ContratoLocacao> findByImovelClienteId(@Param("clienteId") Long clienteId);
}
