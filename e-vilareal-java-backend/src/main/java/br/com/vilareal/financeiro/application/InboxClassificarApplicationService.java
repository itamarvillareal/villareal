package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.LancamentoFinanceiroResponse;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Inbox Classificar: bancos, cartões ou visão unificada (sem filtro de conta).
 */
@Service
public class InboxClassificarApplicationService {

    private final FinanceiroApplicationService financeiroService;
    private final FinanceiroCartaoApplicationService financeiroCartaoService;

    public InboxClassificarApplicationService(
            FinanceiroApplicationService financeiroService,
            FinanceiroCartaoApplicationService financeiroCartaoService) {
        this.financeiroService = financeiroService;
        this.financeiroCartaoService = financeiroCartaoService;
    }

    @Transactional(readOnly = true)
    public Page<LancamentoFinanceiroResponse> listarPaginado(
            Integer numeroBanco, Integer numeroCartao, Integer ano, Integer mes, Pageable pageable) {
        if (numeroCartao != null) {
            return financeiroCartaoService.listarInboxClassificarPaginado(numeroCartao, ano, mes, pageable);
        }
        if (numeroBanco != null) {
            return listarBancosPaginado(numeroBanco, ano, mes, pageable);
        }
        return listarBancosECartoesPaginado(ano, mes, pageable);
    }

    private Page<LancamentoFinanceiroResponse> listarBancosPaginado(
            Integer numeroBanco, Integer ano, Integer mes, Pageable pageable) {
        return financeiroService.listarLancamentosPaginado(
                null,
                null,
                null,
                null,
                null,
                EtapaLancamento.IMPORTADO,
                numeroBanco,
                null,
                null,
                null,
                ano,
                mes,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                pageable);
    }

    private Page<LancamentoFinanceiroResponse> listarBancosECartoesPaginado(
            Integer ano, Integer mes, Pageable pageable) {
        int page = pageable.getPageNumber();
        int size = pageable.getPageSize();
        int fetchLimit = (page + 1) * size;

        Sort sort = sortEfetivo(pageable);
        Pageable fetchPageable = PageRequest.of(0, fetchLimit, sort);

        Page<LancamentoFinanceiroResponse> bancos = listarBancosPaginado(null, ano, mes, fetchPageable);
        Page<LancamentoFinanceiroResponse> cartoes =
                financeiroCartaoService.listarInboxClassificarPaginado(null, ano, mes, fetchPageable);

        long total = bancos.getTotalElements() + cartoes.getTotalElements();
        List<LancamentoFinanceiroResponse> merged =
                mesclarOrdenado(bancos.getContent(), cartoes.getContent(), sort);

        int from = page * size;
        List<LancamentoFinanceiroResponse> slice =
                from >= merged.size() ? List.of() : merged.subList(from, Math.min(from + size, merged.size()));

        return new PageImpl<>(slice, pageable, total);
    }

    static Sort sortEfetivo(Pageable pageable) {
        if (pageable.getSort().isSorted()) {
            return pageable.getSort();
        }
        return Sort.by(Sort.Direction.DESC, "dataLancamento").and(Sort.by(Sort.Direction.DESC, "id"));
    }

    static List<LancamentoFinanceiroResponse> mesclarOrdenado(
            List<LancamentoFinanceiroResponse> bancos,
            List<LancamentoFinanceiroResponse> cartoes,
            Sort sort) {
        List<LancamentoFinanceiroResponse> merged = new ArrayList<>(bancos.size() + cartoes.size());
        merged.addAll(bancos);
        merged.addAll(cartoes);
        merged.sort(comparatorPara(sort));
        return merged;
    }

    static Comparator<LancamentoFinanceiroResponse> comparatorPara(Sort sort) {
        Comparator<LancamentoFinanceiroResponse> comp = (a, b) -> 0;
        for (Sort.Order order : sort) {
            Comparator<LancamentoFinanceiroResponse> c =
                    switch (order.getProperty()) {
                        case "dataLancamento" ->
                                Comparator.comparing(
                                        LancamentoFinanceiroResponse::getDataLancamento,
                                        Comparator.nullsLast(Comparator.naturalOrder()));
                        case "id" ->
                                Comparator.comparing(
                                        LancamentoFinanceiroResponse::getId,
                                        Comparator.nullsLast(Comparator.naturalOrder()));
                        default -> null;
                    };
            if (c == null) {
                continue;
            }
            if (order.isDescending()) {
                c = c.reversed();
            }
            comp = comp.thenComparing(c);
        }
        return comp;
    }
}
