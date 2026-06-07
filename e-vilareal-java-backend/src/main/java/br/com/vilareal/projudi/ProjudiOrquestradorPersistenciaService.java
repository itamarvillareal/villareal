package br.com.vilareal.projudi;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.publicacao.api.dto.PublicacaoWriteRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;

@Service
public class ProjudiOrquestradorPersistenciaService {

    private final ProjudiPublicacaoTransacaoService publicacaoTransacaoService;
    private final ProcessoRepository processoRepository;
    private final Clock clock;

    public ProjudiOrquestradorPersistenciaService(
            ProjudiPublicacaoTransacaoService publicacaoTransacaoService,
            ProcessoRepository processoRepository,
            Clock clock) {
        this.publicacaoTransacaoService = publicacaoTransacaoService;
        this.processoRepository = processoRepository;
        this.clock = clock;
    }

    /**
     * Grava a publicação e tenta vínculo ao processo. A inserção commita em transação
     * própria antes do vínculo, para o dedup por {@code hash_conteudo} não perder o registro
     * se o vínculo falhar.
     *
     * @return id da publicação gravada, ou {@code null} se duplicada (hash_conteudo)
     */
    public Long salvarPublicacaoMovimentacao(PublicacaoWriteRequest req, ProcessoEntity processo) {
        Long publicacaoId = publicacaoTransacaoService.criarPublicacaoProjudi(req);
        if (publicacaoId == null) {
            return null;
        }
        if (processo != null && processo.getId() != null) {
            publicacaoTransacaoService.vincularPublicacaoAoProcesso(publicacaoId, processo.getId());
        }
        return publicacaoId;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void atualizarProximaConsulta(Long processoId, int intervaloHoras) {
        if (processoId == null || intervaloHoras <= 0) {
            return;
        }
        ProcessoEntity processo = processoRepository.findById(processoId).orElse(null);
        if (processo == null) {
            return;
        }
        LocalDate proxima =
                clock.instant().atZone(clock.getZone()).toLocalDateTime().plusHours(intervaloHoras).toLocalDate();
        processo.setProximaConsulta(proxima);
        processoRepository.save(processo);
    }
}
