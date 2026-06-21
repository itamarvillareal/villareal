package br.com.vilareal.financeiro.application.cora;

import br.com.vilareal.financeiro.domain.StatusLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Descobre pares canônicos PLANILHA↔OFX no banco 26 (Cora): 1:1, descrição compatível,
 * exclui ambíguos (1 PL → N OFX) e PLANILHA+PLANILHA (mesma chave data+valor+natureza).
 */
@Service
public class CoraDuplicataParDiscoveryService {

    private static final int NUMERO_BANCO_CORA = 26;
    private static final Set<String> ORIGENS_OFX = Set.of("OFX", "OFX_EMAIL_CORA");

    private final LancamentoFinanceiroRepository lancamentoRepository;

    public CoraDuplicataParDiscoveryService(LancamentoFinanceiroRepository lancamentoRepository) {
        this.lancamentoRepository = lancamentoRepository;
    }

    @Transactional(readOnly = true)
    public List<CoraDuplicataPar> descobrirLoteA() {
        List<LancamentoFinanceiroEntity> todos =
                lancamentoRepository.findAtivosPorNumeroBancoEOrigens(NUMERO_BANCO_CORA, origensPlanilhaEOfx());

        Set<Long> planilhaEmGrupoPlPl = identificarPlanilhaEmGrupoPlanilhaPlanilha(todos);

        Map<Long, List<Long>> candidatosPorPl = new LinkedHashMap<>();
        for (LancamentoFinanceiroEntity pl : todos) {
            if (!isPlanilha(pl) || planilhaEmGrupoPlPl.contains(pl.getId())) {
                continue;
            }
            List<Long> ofxIds = new ArrayList<>();
            for (LancamentoFinanceiroEntity ox : todos) {
                if (!isOfx(ox)) {
                    continue;
                }
                if (!mesmaChave(pl, ox)) {
                    continue;
                }
                if (!CoraDuplicataDescricaoMatcher.descricoesCompativeis(pl.getDescricao(), ox.getDescricao())) {
                    continue;
                }
                ofxIds.add(ox.getId());
            }
            if (!ofxIds.isEmpty()) {
                candidatosPorPl.put(pl.getId(), ofxIds);
            }
        }

        List<CoraDuplicataPar> pares = new ArrayList<>();
        for (Map.Entry<Long, List<Long>> e : candidatosPorPl.entrySet()) {
            if (e.getValue().size() == 1) {
                pares.add(new CoraDuplicataPar(e.getKey(), e.getValue().get(0)));
            }
        }
        pares.sort(java.util.Comparator.comparingLong(CoraDuplicataPar::planilhaId));
        return pares;
    }

    private static Set<String> origensPlanilhaEOfx() {
        Set<String> s = new HashSet<>(ORIGENS_OFX);
        s.add("PLANILHA");
        return s;
    }

    private static Set<Long> identificarPlanilhaEmGrupoPlanilhaPlanilha(List<LancamentoFinanceiroEntity> todos) {
        Map<String, List<Long>> porChave = new HashMap<>();
        for (LancamentoFinanceiroEntity l : todos) {
            if (!isPlanilha(l)) {
                continue;
            }
            porChave.computeIfAbsent(chave(l), k -> new ArrayList<>()).add(l.getId());
        }
        return porChave.values().stream()
                .filter(ids -> ids.size() > 1)
                .flatMap(List::stream)
                .collect(Collectors.toSet());
    }

    private static boolean isPlanilha(LancamentoFinanceiroEntity l) {
        return l != null && "PLANILHA".equalsIgnoreCase(l.getOrigem());
    }

    private static boolean isOfx(LancamentoFinanceiroEntity l) {
        return l != null && l.getOrigem() != null && ORIGENS_OFX.contains(l.getOrigem().toUpperCase());
    }

    private static boolean mesmaChave(LancamentoFinanceiroEntity a, LancamentoFinanceiroEntity b) {
        return a.getDataLancamento().equals(b.getDataLancamento())
                && a.getValor().compareTo(b.getValor()) == 0
                && a.getNatureza() == b.getNatureza();
    }

    private static String chave(LancamentoFinanceiroEntity l) {
        return l.getDataLancamento() + "|" + l.getValor() + "|" + l.getNatureza();
    }
}
