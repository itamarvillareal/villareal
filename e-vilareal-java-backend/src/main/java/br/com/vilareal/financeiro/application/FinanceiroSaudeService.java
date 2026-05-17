package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.FinanceiroSaudeResponse;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoCartaoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class FinanceiroSaudeService {

    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final LancamentoCartaoRepository lancamentoCartaoRepository;
    private final FinanceiroApplicationService financeiroApplicationService;

    public FinanceiroSaudeService(
            LancamentoFinanceiroRepository lancamentoRepository,
            LancamentoCartaoRepository lancamentoCartaoRepository,
            FinanceiroApplicationService financeiroApplicationService) {
        this.lancamentoRepository = lancamentoRepository;
        this.lancamentoCartaoRepository = lancamentoCartaoRepository;
        this.financeiroApplicationService = financeiroApplicationService;
    }

    @Transactional(readOnly = true)
    public FinanceiroSaudeResponse obterSaude() {
        long totalLancamentos = lancamentoRepository.count();
        long totalCartao = lancamentoCartaoRepository.count();

        Map<String, Long> porEtapa = new LinkedHashMap<>();
        for (EtapaLancamento etapa : EtapaLancamento.values()) {
            porEtapa.put(etapa.name(), 0L);
        }
        financeiroApplicationService.contarPorEtapa().forEach(porEtapa::put);

        long importados = porEtapa.getOrDefault(EtapaLancamento.IMPORTADO.name(), 0L);
        long aSemCliente = lancamentoRepository.countContaASemCliente();

        FinanceiroSaudeResponse response = new FinanceiroSaudeResponse();
        response.setTotalLancamentos(totalLancamentos);
        response.setTotalCartao(totalCartao);
        response.setPorEtapa(porEtapa);

        FinanceiroSaudeResponse.IndicadorSaude naoId = new FinanceiroSaudeResponse.IndicadorSaude();
        naoId.setTotal(importados);
        naoId.setPercentual(percentual(importados, totalLancamentos));
        response.setNaoIdentificados(naoId);

        FinanceiroSaudeResponse.IndicadorSaude semCli = new FinanceiroSaudeResponse.IndicadorSaude();
        semCli.setTotal(aSemCliente);
        semCli.setPercentual(percentual(aSemCliente, totalLancamentos));
        response.setASemCliente(semCli);

        response.setGruposInconsistentes(lancamentoRepository.countGruposCompensacaoInconsistentes());
        response.setParesOrfaosSugeridos(
                lancamentoRepository.countParesCompensacaoSugeridos(null, null, null, 3, false));

        for (Object[] row : lancamentoRepository.findMesesAbertosResumo()) {
            FinanceiroSaudeResponse.MesAbertoResponse m = new FinanceiroSaudeResponse.MesAbertoResponse();
            m.setAno(((Number) row[0]).intValue());
            m.setMes(((Number) row[1]).intValue());
            long total = ((Number) row[2]).longValue();
            long pendentes = ((Number) row[3]).longValue();
            m.setTotal(total);
            m.setPendentes(pendentes);
            m.setPercentualCompleto(total == 0 ? 100.0 : ((total - pendentes) * 100.0) / total);
            response.getMesesAbertos().add(m);
        }

        response.setAtualizadoEm(Instant.now().toString());
        return response;
    }

    private static double percentual(long parte, long total) {
        if (total == 0) {
            return 0.0;
        }
        return Math.round((parte * 10000.0) / total) / 100.0;
    }
}
