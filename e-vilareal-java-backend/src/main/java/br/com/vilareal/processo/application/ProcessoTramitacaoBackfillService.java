package br.com.vilareal.processo.application;

import br.com.vilareal.processo.api.dto.ProcessoTramitacaoBackfillResponse;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Backfill idempotente de {@code processo.tramitacao} a partir de publicações vinculadas.
 */
@Service
public class ProcessoTramitacaoBackfillService {

    private static final Logger log = LoggerFactory.getLogger(ProcessoTramitacaoBackfillService.class);

    private static final int LOTE = 500;

    private final ProcessoRepository processoRepository;
    private final PublicacaoRepository publicacaoRepository;
    private final ProcessoTramitacaoService processoTramitacaoService;

    public ProcessoTramitacaoBackfillService(
            ProcessoRepository processoRepository,
            PublicacaoRepository publicacaoRepository,
            ProcessoTramitacaoService processoTramitacaoService) {
        this.processoRepository = processoRepository;
        this.publicacaoRepository = publicacaoRepository;
        this.processoTramitacaoService = processoTramitacaoService;
    }

    @Transactional(readOnly = true)
    public ProcessoTramitacaoBackfillResponse executar(boolean dryRun) {
        List<Long> processoIds = processoRepository.findIdsComTramitacaoVazia();
        int total = processoIds.size();
        if (total == 0) {
            return new ProcessoTramitacaoBackfillResponse(0, 0, 0, 0, dryRun);
        }

        int atualizadosProjudi = 0;
        int atualizadosPje = 0;
        int inalterados = 0;

        for (int offset = 0; offset < total; offset += LOTE) {
            List<Long> lote = processoIds.subList(offset, Math.min(offset + LOTE, total));
            Set<Long> comProjudi = new HashSet<>(publicacaoRepository.findDistinctProcessoIdsComOrigemProjudi(lote));
            Set<Long> comTrt18 = new HashSet<>(publicacaoRepository.findDistinctProcessoIdsComOrigemTrt18(lote));
            Set<Long> comMonitoramento =
                    new HashSet<>(publicacaoRepository.findDistinctProcessoIdsComOrigemMonitoramento(lote));
            Map<Long, String> cnjMonitoramentoPorProcesso = montarCnjMonitoramentoPorProcesso(lote);
            Map<Long, String> cnjProcessoPorId = montarCnjProcessoPorId(lote);

            for (Long processoId : lote) {
                String alvo = resolverAlvoBackfill(
                        processoId,
                        cnjProcessoPorId.get(processoId),
                        comProjudi.contains(processoId),
                        comTrt18.contains(processoId),
                        comMonitoramento.contains(processoId),
                        cnjMonitoramentoPorProcesso.get(processoId));
                if (alvo == null) {
                    inalterados++;
                    continue;
                }
                boolean aplicou = processoTramitacaoService.preencherTramitacaoSeVazio(processoId, alvo, dryRun);
                if (!aplicou) {
                    inalterados++;
                    continue;
                }
                if (ProcessoTramitacaoService.TRAMITACAO_PROJUDI.equals(alvo)) {
                    atualizadosProjudi++;
                } else if (ProcessoTramitacaoService.TRAMITACAO_PJE.equals(alvo)) {
                    atualizadosPje++;
                } else {
                    inalterados++;
                }
            }
        }

        log.info(
                "Backfill tramitação concluído (dryRun={}): total={}, projudi={}, pje={}, inalterados={}",
                dryRun,
                total,
                atualizadosProjudi,
                atualizadosPje,
                inalterados);
        return new ProcessoTramitacaoBackfillResponse(
                atualizadosProjudi, atualizadosPje, inalterados, total, dryRun);
    }

    static String resolverAlvoBackfill(
            Long processoId,
            String numeroCnjProcesso,
            boolean temProjudi,
            boolean temTrt18,
            boolean temMonitoramento,
            String cnjMonitoramento) {
        Objects.requireNonNull(processoId);
        if (temProjudi) {
            return ProcessoTramitacaoService.TRAMITACAO_PROJUDI;
        }
        if (temTrt18) {
            return ProcessoTramitacaoService.TRAMITACAO_PJE;
        }
        if (temMonitoramento) {
            String cnj = StringUtils.hasText(numeroCnjProcesso) ? numeroCnjProcesso : cnjMonitoramento;
            return ProcessoTramitacaoService.inferirTramitacaoPorCnj(cnj);
        }
        return null;
    }

    private Map<Long, String> montarCnjProcessoPorId(List<Long> processoIds) {
        Map<Long, String> mapa = new HashMap<>();
        for (ProcessoEntity p : processoRepository.findAllById(processoIds)) {
            if (p.getId() != null && StringUtils.hasText(p.getNumeroCnj())) {
                mapa.put(p.getId(), p.getNumeroCnj().trim());
            }
        }
        return mapa;
    }

    private Map<Long, String> montarCnjMonitoramentoPorProcesso(List<Long> processoIds) {
        Map<Long, String> mapa = new HashMap<>();
        for (Object[] row : publicacaoRepository.findMonitoramentoCnjPorProcessoIds(processoIds)) {
            if (row == null || row.length < 2 || row[0] == null) {
                continue;
            }
            Long processoId = ((Number) row[0]).longValue();
            String cnj = row[1] != null ? String.valueOf(row[1]).trim() : "";
            if (StringUtils.hasText(cnj)) {
                mapa.putIfAbsent(processoId, cnj);
            }
        }
        return mapa;
    }
}
