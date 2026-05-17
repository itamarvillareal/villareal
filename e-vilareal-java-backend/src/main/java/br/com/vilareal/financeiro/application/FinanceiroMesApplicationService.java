package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.FecharMesRequest;
import br.com.vilareal.financeiro.api.dto.FecharMesResponse;
import br.com.vilareal.financeiro.api.dto.ReabrirMesResponse;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class FinanceiroMesApplicationService {

    private final LancamentoFinanceiroRepository lancamentoRepository;

    public FinanceiroMesApplicationService(LancamentoFinanceiroRepository lancamentoRepository) {
        this.lancamentoRepository = lancamentoRepository;
    }

    @Transactional
    public FecharMesResponse fecharMes(FecharMesRequest request) {
        LocalDate inicio = LocalDate.of(request.getAno(), request.getMes(), 1);
        LocalDate fim = inicio.plusMonths(1).minusDays(1);

        List<LancamentoFinanceiroEntity> lancamentos =
                lancamentoRepository.findByNumeroBancoAndMes(request.getNumeroBanco(), inicio, fim);

        List<LancamentoFinanceiroEntity> pendentes = lancamentos.stream()
                .filter(l -> l.getEtapa() == EtapaLancamento.IMPORTADO)
                .toList();

        FecharMesResponse response = new FecharMesResponse();
        if (!pendentes.isEmpty()) {
            response.setPendentes(pendentes.size());
            response.setFechados(0);
            for (LancamentoFinanceiroEntity p : pendentes) {
                response.getErros()
                        .add("Lançamento "
                                + p.getId()
                                + " ("
                                + p.getDataLancamento()
                                + "): etapa IMPORTADO — "
                                + p.getDescricao());
            }
            return response;
        }

        for (LancamentoFinanceiroEntity l : lancamentos) {
            l.setEtapa(EtapaLancamento.FECHADO);
        }
        lancamentoRepository.saveAll(lancamentos);
        response.setFechados(lancamentos.size());
        response.setPendentes(0);
        return response;
    }

    @Transactional
    public ReabrirMesResponse reabrirMes(FecharMesRequest request) {
        LocalDate inicio = LocalDate.of(request.getAno(), request.getMes(), 1);
        LocalDate fim = inicio.plusMonths(1).minusDays(1);

        List<LancamentoFinanceiroEntity> lancamentos =
                lancamentoRepository.findByNumeroBancoAndMes(request.getNumeroBanco(), inicio, fim);

        List<LancamentoFinanceiroEntity> fechados = lancamentos.stream()
                .filter(l -> l.getEtapa() == EtapaLancamento.FECHADO)
                .toList();

        for (LancamentoFinanceiroEntity l : fechados) {
            String codigo = l.getContaContabil().getCodigo();
            Long clienteId = l.getCliente() != null ? l.getCliente().getId() : null;
            l.setEtapa(EtapaLancamento.calcular(codigo, l.getGrupoCompensacao(), clienteId));
        }
        lancamentoRepository.saveAll(new ArrayList<>(fechados));

        ReabrirMesResponse response = new ReabrirMesResponse();
        response.setReabertos(fechados.size());
        return response;
    }
}
