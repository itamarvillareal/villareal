package br.com.vilareal.citacao.infrastructure.persistence.repository;

import br.com.vilareal.citacao.infrastructure.persistence.entity.CitacaoTentativaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CitacaoTentativaRepository extends JpaRepository<CitacaoTentativaEntity, Long> {

    boolean existsByPessoaEndereco_Id(Long pessoaEnderecoId);

    Optional<CitacaoTentativaEntity> findByProcessoParte_IdAndPessoaEndereco_Id(
            Long processoParteId, Long pessoaEnderecoId);

    boolean existsByMovMonitoradaRetorno_Id(Long movMonitoradaRetornoId);

    Optional<CitacaoTentativaEntity> findByMovMonitoradaRetorno_Id(Long movMonitoradaRetornoId);

    @Query(
            """
            SELECT t FROM CitacaoTentativaEntity t
            JOIN FETCH t.pessoaEndereco pe
            LEFT JOIN FETCH pe.municipio m
            LEFT JOIN FETCH m.estado
            LEFT JOIN FETCH t.andamentoSolicitacao
            LEFT JOIN FETCH t.andamentoRetorno
            LEFT JOIN FETCH t.movMonitoradaSolicitacao
            LEFT JOIN FETCH t.movMonitoradaRetorno
            WHERE t.processoParte.id = :processoParteId
            ORDER BY t.id ASC
            """)
    List<CitacaoTentativaEntity> findByProcessoParteIdComEndereco(@Param("processoParteId") Long processoParteId);

    @Query(
            """
            SELECT t FROM CitacaoTentativaEntity t
            JOIN FETCH t.processoParte pp
            JOIN FETCH t.pessoaEndereco pe
            LEFT JOIN FETCH pe.municipio m
            LEFT JOIN FETCH m.estado
            LEFT JOIN FETCH t.andamentoSolicitacao
            WHERE t.id = :id
            """)
    Optional<CitacaoTentativaEntity> findByIdDetalhado(@Param("id") Long id);

    @Query(
            """
            SELECT t FROM CitacaoTentativaEntity t
            JOIN FETCH t.processoParte pp
            WHERE pp.processo.id = :processoId
              AND t.status = :status
              AND UPPER(TRIM(pp.polo)) = 'REU'
            """)
    List<CitacaoTentativaEntity> findByProcessoIdAndStatusAndPoloReu(
            @Param("processoId") Long processoId, @Param("status") String status);
}
