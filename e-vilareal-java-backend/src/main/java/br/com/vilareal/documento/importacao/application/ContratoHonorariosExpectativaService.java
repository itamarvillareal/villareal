package br.com.vilareal.documento.importacao.application;

import br.com.vilareal.documento.importacao.api.dto.ExpectativaContingenteItemResponse;
import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosEntity;
import br.com.vilareal.documento.infrastructure.persistence.repository.ContratoHonorariosRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ContratoHonorariosExpectativaService {

    private final ContratoHonorariosRepository contratoRepository;

    public ContratoHonorariosExpectativaService(ContratoHonorariosRepository contratoRepository) {
        this.contratoRepository = contratoRepository;
    }

    @Transactional(readOnly = true)
    public List<ExpectativaContingenteItemResponse> listarContingentes() {
        return contratoRepository.listarComFiltros(null, null, null, null).stream()
                .filter(c -> c.getExpectativaValorEstimado() != null
                        && c.getExpectativaValorEstimado().signum() > 0)
                .map(this::toItem)
                .toList();
    }

    private ExpectativaContingenteItemResponse toItem(ContratoHonorariosEntity c) {
        var proc = c.getProcesso();
        return new ExpectativaContingenteItemResponse(
                c.getId(),
                proc != null ? proc.getId() : null,
                proc != null && proc.getCliente() != null ? proc.getCliente().getCodigoCliente() : null,
                proc != null ? proc.getNumeroInterno() : null,
                c.getTipoRemuneracao(),
                c.getPercentualProveito(),
                c.getExpectativaValorEstimado(),
                c.getExpectativaBaseTipo(),
                c.getExpectativaValorCausaRef(),
                c.getExpectativaObservacao(),
                c.getDataContrato());
    }
}
