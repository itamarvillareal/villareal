package br.com.vilareal.documento.importacao.infrastructure.persistence.repository;

import br.com.vilareal.documento.importacao.infrastructure.persistence.entity.ContratoHonorariosImportacaoEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ContratoHonorariosImportacaoRepository extends JpaRepository<ContratoHonorariosImportacaoEntity, Long> {

    Optional<ContratoHonorariosImportacaoEntity> findByHashPdfAtivo(String hashPdfAtivo);

    List<ContratoHonorariosImportacaoEntity> findByImportacaoLoteIdOrderByScoreConfiancaDescIdAsc(String importacaoLoteId);

    @Query("""
            SELECT i FROM ContratoHonorariosImportacaoEntity i
            WHERE (:status IS NULL OR i.status = :status)
              AND (:codigoCliente IS NULL OR i.codigoCliente = :codigoCliente)
              AND (:importacaoLoteId IS NULL OR i.importacaoLoteId = :importacaoLoteId)
            ORDER BY i.scoreConfianca DESC, i.id ASC
            """)
    Page<ContratoHonorariosImportacaoEntity> listarFila(
            @Param("status") String status,
            @Param("codigoCliente") String codigoCliente,
            @Param("importacaoLoteId") String importacaoLoteId,
            Pageable pageable);

    @Query("""
            SELECT i FROM ContratoHonorariosImportacaoEntity i
            WHERE i.status = :status
            ORDER BY i.id ASC
            """)
    List<ContratoHonorariosImportacaoEntity> findPendentesExtracao(
            @Param("status") String status, Pageable pageable);

    long countByImportacaoLoteIdAndStatusIn(String importacaoLoteId, Collection<String> statuses);

    long countByStatus(String status);
}
