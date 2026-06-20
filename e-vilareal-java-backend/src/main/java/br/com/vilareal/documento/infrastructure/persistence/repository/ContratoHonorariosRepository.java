package br.com.vilareal.documento.infrastructure.persistence.repository;

import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ContratoHonorariosRepository extends JpaRepository<ContratoHonorariosEntity, Long> {

    @Query("""
            SELECT DISTINCT c FROM ContratoHonorariosEntity c
            LEFT JOIN FETCH c.pessoa
            LEFT JOIN FETCH c.processo p
            LEFT JOIN FETCH p.cliente
            LEFT JOIN FETCH c.parcelas
            WHERE (:processoId IS NULL OR c.processo.id = :processoId)
              AND (:pessoaId IS NULL OR c.pessoa.id = :pessoaId)
              AND (:de IS NULL OR c.dataContrato >= :de)
              AND (:ate IS NULL OR c.dataContrato <= :ate)
            ORDER BY c.dataContrato DESC, c.id DESC
            """)
    List<ContratoHonorariosEntity> listarComFiltros(
            @Param("processoId") Long processoId,
            @Param("pessoaId") Long pessoaId,
            @Param("de") LocalDate de,
            @Param("ate") LocalDate ate);
}
