package br.com.vilareal.financeiro.application;

import br.com.vilareal.documento.ContratoHonorariosRecebiveisConciliacaoService;
import br.com.vilareal.documento.HonorariosPosImportResult;
import br.com.vilareal.financeiro.api.dto.ExtratoPosImportRequest;
import br.com.vilareal.financeiro.api.dto.ExtratoPosImportResponse;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExtratoPosImportApplicationServiceTest {

    @Mock
    private ContratoHonorariosRecebiveisConciliacaoService honorariosConciliacaoService;

    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;

    @InjectMocks
    private ExtratoPosImportApplicationService service;

    @Test
    void rodar_ignoraCora() {
        ExtratoPosImportResponse resp =
                service.rodar(new ExtratoPosImportRequest(26, List.of(1L), "OFX"));
        assertThat(resp.isExecutado()).isFalse();
        assertThat(resp.getMotivoIgnorado()).contains("Cora");
        verify(honorariosConciliacaoService, never()).conciliarHonorariosPosImport(anyList());
    }

    @Test
    void rodar_ignoraBancoCongelado() {
        ExtratoPosImportResponse resp = service.rodar(new ExtratoPosImportRequest(3, List.of(1L), "OFX"));
        assertThat(resp.isExecutado()).isFalse();
        assertThat(resp.getMotivoIgnorado()).contains("congelado");
    }

    @Test
    void rodar_chamaHonorariosParaItau() {
        when(honorariosConciliacaoService.conciliarHonorariosPosImport(List.of(10L, 11L)))
                .thenReturn(HonorariosPosImportResult.of(1, 0, List.of()));

        ExtratoPosImportResponse resp =
                service.rodar(new ExtratoPosImportRequest(1, List.of(10L, 11L), "OFX"));

        assertThat(resp.isExecutado()).isTrue();
        assertThat(resp.getHonorariosAutoConciliados()).isEqualTo(1);
        verify(honorariosConciliacaoService).conciliarHonorariosPosImport(List.of(10L, 11L));
    }
}
