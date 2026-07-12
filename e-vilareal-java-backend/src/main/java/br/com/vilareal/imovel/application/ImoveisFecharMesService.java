package br.com.vilareal.imovel.application;

import br.com.vilareal.imovel.api.dto.AluguelFollowupResponse;
import br.com.vilareal.imovel.api.dto.AluguelTriagemResponse;
import br.com.vilareal.imovel.api.dto.ImovelFecharMesResponse;
import br.com.vilareal.imovel.api.dto.ImovelVisaoGeralItemResponse;
import br.com.vilareal.imovel.api.dto.ImovelVisaoGeralResponse;
import br.com.vilareal.imovel.api.dto.RepassePendenteCarteiraResponse;
import br.com.vilareal.imovel.api.dto.RepassePendenteItemResponse;
import br.com.vilareal.imovel.domain.StatusRepasse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Agregação server-side do checklist «Fechar o Mês» (Etapa 6): evita somar mil linhas no browser.
 */
@Service
public class ImoveisFecharMesService {

    private final ImoveisVisaoGeralService visaoGeralService;
    private final AluguelCobrancaService aluguelCobrancaService;
    private final AluguelFollowupService aluguelFollowupService;
    private final LocacaoReconciliacaoService reconciliacaoService;

    public ImoveisFecharMesService(
            ImoveisVisaoGeralService visaoGeralService,
            AluguelCobrancaService aluguelCobrancaService,
            AluguelFollowupService aluguelFollowupService,
            LocacaoReconciliacaoService reconciliacaoService) {
        this.visaoGeralService = visaoGeralService;
        this.aluguelCobrancaService = aluguelCobrancaService;
        this.aluguelFollowupService = aluguelFollowupService;
        this.reconciliacaoService = reconciliacaoService;
    }

    @Transactional(readOnly = true)
    public ImovelFecharMesResponse gerar(String competencia) {
        ImovelVisaoGeralResponse visao = visaoGeralService.gerar(competencia, false);
        AluguelTriagemResponse triagem = aluguelCobrancaService.triagem(competencia);
        AluguelFollowupResponse followup = aluguelFollowupService.followup(competencia, null);
        RepassePendenteCarteiraResponse repasses =
                reconciliacaoService.repassesPendentes(competencia);

        List<ImovelVisaoGeralItemResponse> itens = visao.itens() != null ? visao.itens() : List.of();
        List<ImovelVisaoGeralItemResponse> ocupados =
                itens.stream().filter(i -> i.ocupado() && i.contratoId() != null).toList();

        int alugueisRecebidos = (int) ocupados.stream()
                .filter(i -> i.aluguelRecebido() != null && i.aluguelRecebido().signum() > 0)
                .count();
        int alugueisTotal = ocupados.size();

        int cobrancasAFazer = followup.totalAcaoHoje() + triagem.totalEmAtraso();

        int diaHoje = LocalDate.now().getDayOfMonth();
        List<RepassePendenteItemResponse> repassesTerceiros = (repasses.itens() != null ? repasses.itens() : List.<RepassePendenteItemResponse>of())
                .stream()
                .filter(r -> {
                    Integer np = r.imovelNumeroPlanilha();
                    return itens.stream()
                            .anyMatch(v -> np != null && np.equals(v.numeroPlanilha()) && !v.repasseInterno());
                })
                .toList();

        List<RepassePendenteItemResponse> repassesHoje = repassesTerceiros.stream()
                .filter(r -> {
                    Integer np = r.imovelNumeroPlanilha();
                    return itens.stream()
                            .anyMatch(v -> np != null && np.equals(v.numeroPlanilha())
                                    && v.diaRepasse() != null && v.diaRepasse().equals(diaHoje));
                })
                .toList();

        BigDecimal repassesHojeValor = repassesHoje.stream()
                .map(r -> {
                    BigDecimal esperado = r.repasseEsperado() != null ? r.repasseEsperado() : BigDecimal.ZERO;
                    BigDecimal despesas = r.despesas() != null ? r.despesas() : BigDecimal.ZERO;
                    return esperado.subtract(despesas);
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int despesasAClassificar = (int) itens.stream()
                .filter(i -> i.ocupado()
                        && i.aluguelRecebido() != null
                        && i.aluguelRecebido().signum() > 0
                        && i.statusRepasse() != StatusRepasse.FEITO)
                .count();

        ImovelFecharMesResponse.Checklist cl = new ImovelFecharMesResponse.Checklist();
        cl.setAlugueisRecebidos(alugueisRecebidos);
        cl.setAlugueisTotal(alugueisTotal);
        cl.setCobrancasAFazer(cobrancasAFazer);
        cl.setRepassesHoje(repassesHoje.size());
        cl.setRepassesHojeValor(repassesHojeValor);
        cl.setDespesasAClassificar(despesasAClassificar);
        int sugestoesVinculo = triagem.totalPagamentoProvavel();
        cl.setSugestoesVinculo(sugestoesVinculo);
        cl.setMesFechado(
                alugueisRecebidos >= alugueisTotal
                        && cobrancasAFazer == 0
                        && repassesHoje.isEmpty()
                        && despesasAClassificar == 0
                        && sugestoesVinculo == 0);

        ImovelFecharMesResponse out = new ImovelFecharMesResponse();
        out.setCompetencia(visao.competencia());
        out.setChecklist(cl);
        out.setRepassesPendentes(repasses);
        return out;
    }

}
