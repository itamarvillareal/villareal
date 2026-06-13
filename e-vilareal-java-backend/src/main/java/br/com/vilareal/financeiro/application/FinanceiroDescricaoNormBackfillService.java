package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.BackfillDescricaoNormResponse;
import br.com.vilareal.financeiro.domain.DescricaoNormalizer;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class FinanceiroDescricaoNormBackfillService {

    private static final int LOTE_PADRAO = 2000;
    private static final int LOTE_MAX = 5000;

    private final LancamentoFinanceiroRepository lancamentoRepository;

    public FinanceiroDescricaoNormBackfillService(LancamentoFinanceiroRepository lancamentoRepository) {
        this.lancamentoRepository = lancamentoRepository;
    }

    @Transactional
    public BackfillDescricaoNormResponse backfill(Integer loteSize) {
        int tamanho = loteSize != null && loteSize > 0 ? Math.min(loteSize, LOTE_MAX) : LOTE_PADRAO;
        List<LancamentoFinanceiroEntity> lote =
                lancamentoRepository.findByDescricaoNormIsNull(PageRequest.of(0, tamanho));
        int atualizados = 0;
        for (LancamentoFinanceiroEntity e : lote) {
            e.setDescricaoNorm(DescricaoNormalizer.normalizar(e.getDescricao()));
            atualizados++;
        }
        if (!lote.isEmpty()) {
            lancamentoRepository.saveAll(lote);
        }
        BackfillDescricaoNormResponse resp = new BackfillDescricaoNormResponse();
        resp.setAtualizados(atualizados);
        resp.setRestantes(lancamentoRepository.countByDescricaoNormIsNull());
        return resp;
    }
}
