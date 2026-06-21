package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Proteção na mesclagem de extrato: não reprocessa meses já fechados quando o banco
 * reenvia OFX completo com FITID/descrição alterados.
 */
@Service
public class ExtratoImportProtecaoService {

    private final LancamentoFinanceiroRepository lancamentoRepository;

    public ExtratoImportProtecaoService(LancamentoFinanceiroRepository lancamentoRepository) {
        this.lancamentoRepository = lancamentoRepository;
    }

    /**
     * Penúltima data distinta já importada (ou a única, se for a primeira).
     * Mesclagem aceita apenas {@code dataLancamento >= dataCorte}.
     */
    @Transactional(readOnly = true)
    public LocalDate calcularDataCorteMesclagem(Integer numeroBanco) {
        if (numeroBanco == null) {
            return null;
        }
        List<LocalDate> datas = lancamentoRepository.findDuasUltimasDatasDistintasPorNumeroBanco(numeroBanco);
        if (datas == null || datas.isEmpty()) {
            return null;
        }
        if (datas.size() == 1) {
            return datas.get(0);
        }
        return datas.get(1);
    }

    public boolean aceitarLinhaImportacaoMesclagem(LocalDate dataLancamento, LocalDate dataCorte) {
        if (dataCorte == null) {
            return true;
        }
        if (dataLancamento == null) {
            return false;
        }
        return !dataLancamento.isBefore(dataCorte);
    }
}
