package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.Publicacao;
import br.com.vilareal.api.entity.enums.PublicacaoOrigemImportacao;
import br.com.vilareal.api.entity.enums.PublicacaoStatusTratamento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface PublicacaoRepository extends JpaRepository<Publicacao, Long> {
    boolean existsByHashConteudo(String hashConteudo);
    boolean existsByHashConteudoAndIdNot(String hashConteudo, Long id);

    @Query("SELECT p FROM Publicacao p " +
            "WHERE (:dataInicio IS NULL OR p.dataPublicacao >= :dataInicio) " +
            "AND (:dataFim IS NULL OR p.dataPublicacao <= :dataFim) " +
            "AND (:status IS NULL OR p.statusTratamento = :status) " +
            "AND (:processoId IS NULL OR p.processo.id = :processoId) " +
            "AND (:clienteId IS NULL OR p.cliente.id = :clienteId) " +
            "AND (:origem IS NULL OR p.origemImportacao = :origem) " +
            "AND (:texto IS NULL OR (" +
            "LOWER(COALESCE(p.numeroProcessoEncontrado, '')) LIKE LOWER(CONCAT('%', :texto, '%')) OR " +
            "LOWER(COALESCE(p.diario, '')) LIKE LOWER(CONCAT('%', :texto, '%')) OR " +
            "LOWER(COALESCE(p.titulo, '')) LIKE LOWER(CONCAT('%', :texto, '%')) OR " +
            "LOWER(COALESCE(p.resumo, '')) LIKE LOWER(CONCAT('%', :texto, '%')) OR " +
            "LOWER(COALESCE(p.teor, '')) LIKE LOWER(CONCAT('%', :texto, '%'))" +
            ")) " +
            "ORDER BY p.dataPublicacao DESC, p.id DESC")
    List<Publicacao> findAllFiltered(
            @Param("dataInicio") LocalDate dataInicio,
            @Param("dataFim") LocalDate dataFim,
            @Param("status") PublicacaoStatusTratamento status,
            @Param("processoId") Long processoId,
            @Param("clienteId") Long clienteId,
            @Param("texto") String texto,
            @Param("origem") PublicacaoOrigemImportacao origem
    );
}
