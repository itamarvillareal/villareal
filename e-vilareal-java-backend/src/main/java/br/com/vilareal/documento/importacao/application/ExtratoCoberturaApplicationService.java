package br.com.vilareal.documento.importacao.application;

import br.com.vilareal.documento.importacao.api.dto.ExtratoCoberturaResponse;
import br.com.vilareal.financeiro.application.ExtratoPosImportApplicationService;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class ExtratoCoberturaApplicationService {

    private final LancamentoFinanceiroRepository lancamentoRepository;

    public ExtratoCoberturaApplicationService(LancamentoFinanceiroRepository lancamentoRepository) {
        this.lancamentoRepository = lancamentoRepository;
    }

    @Transactional(readOnly = true)
    public ExtratoCoberturaResponse verificar(LocalDate periodoDe, LocalDate periodoAte) {
        List<String> avisos = new ArrayList<>();
        LocalDate de = periodoDe != null ? periodoDe : LocalDate.now().minusYears(2);
        LocalDate ate = periodoAte != null ? periodoAte : LocalDate.now();
        long total = lancamentoRepository.countCreditosAtivosPorBancosEPeriodo(
                ExtratoPosImportApplicationService.BANCOS_POS_IMPORT_HONORARIO, de, ate);
        boolean suficiente = total > 0;
        if (!suficiente) {
            avisos.add(
                    "Nenhum crédito bancário encontrado no período "
                            + de
                            + " a "
                            + ate
                            + ". Importe extratos no Financeiro antes da conciliação retroativa.");
        }
        return new ExtratoCoberturaResponse(de, ate, suficiente, (int) total, avisos);
    }
}
