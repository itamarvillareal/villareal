package br.com.vilareal.patrimonio.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.patrimonio.api.dto.TaxaReferenciaRequest;
import br.com.vilareal.patrimonio.infrastructure.persistence.entity.ParametroEntity;
import br.com.vilareal.patrimonio.infrastructure.persistence.repository.ParametroRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;

@Service
public class ParametroPatrimonioApplicationService {

    private final ParametroRepository parametroRepository;

    public ParametroPatrimonioApplicationService(ParametroRepository parametroRepository) {
        this.parametroRepository = parametroRepository;
    }

    @Transactional(readOnly = true)
    public ParametroEntity vigente() {
        return parametroRepository.findTopByVigenteAteIsNullOrderByVersaoDesc()
                .orElseThrow(() -> new BusinessRuleException("Parâmetros patrimoniais não configurados"));
    }

    /** Atualiza taxa de referência no parâmetro vigente e carimba a data. */
    @Transactional
    public ParametroEntity atualizarTaxaReferencia(TaxaReferenciaRequest req) {
        ParametroEntity p = vigente();
        p.setTaxaReferenciaLiquidaAa(req.taxaReferenciaLiquidaAa());
        p.setTaxaReferenciaAtualizadaEm(Instant.now());
        return parametroRepository.save(p);
    }

    @Transactional
    public ParametroEntity atualizarTetoAnual(BigDecimal teto) {
        ParametroEntity p = vigente();
        p.setTetoAmortizacaoAnual(teto);
        return parametroRepository.save(p);
    }

    @Transactional
    public ParametroEntity atualizarRendaMensal(BigDecimal renda) {
        ParametroEntity p = vigente();
        p.setRendaMensalRecorrente(renda);
        return parametroRepository.save(p);
    }
}
