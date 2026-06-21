package br.com.vilareal.documento.infrastructure.persistence.repository;

import br.com.vilareal.documento.domain.PapelHonorarioRepasse;
import br.com.vilareal.documento.infrastructure.persistence.entity.HonorarioRepasseLancamentoEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface HonorarioRepasseLancamentoRepository extends JpaRepository<HonorarioRepasseLancamentoEntity, Long> {

    Optional<HonorarioRepasseLancamentoEntity> findByContratoHonorarios_IdAndLancamentoFinanceiro_IdAndPapel(
            Long contratoHonorariosId, Long lancamentoFinanceiroId, PapelHonorarioRepasse papel);

    List<HonorarioRepasseLancamentoEntity> findByAlvaraVinculo_IdOrderByIdAsc(Long alvaraVinculoId);

    @EntityGraph(
            attributePaths = {
                "contratoHonorarios",
                "contratoHonorarios.pessoa",
                "contratoHonorarios.processo",
                "contratoHonorarios.processo.cliente",
                "lancamentoFinanceiro"
            })
    @Query(
            """
            SELECT v FROM HonorarioRepasseLancamentoEntity v
            WHERE v.papel = br.com.vilareal.documento.domain.PapelHonorarioRepasse.ALVARA
            ORDER BY v.dataReferencia DESC, v.id DESC
            """)
    List<HonorarioRepasseLancamentoEntity> findAllAlvarasParaCarteira();

    boolean existsByLancamentoFinanceiro_IdAndPapel(Long lancamentoFinanceiroId, PapelHonorarioRepasse papel);
}
