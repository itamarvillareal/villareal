package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExtratoImportProtecaoServiceTest {

    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;

    @InjectMocks
    private ExtratoImportProtecaoService service;

    @Test
    void calcularDataCorte_retornaPenultimaDataDistinta() {
        when(lancamentoRepository.findDuasUltimasDatasDistintasPorNumeroBanco(29))
                .thenReturn(List.of(LocalDate.of(2026, 6, 18), LocalDate.of(2026, 6, 17)));

        assertThat(service.calcularDataCorteMesclagem(29)).isEqualTo(LocalDate.of(2026, 6, 17));
    }

    @Test
    void calcularDataCorte_unicaDataImportada() {
        when(lancamentoRepository.findDuasUltimasDatasDistintasPorNumeroBanco(29))
                .thenReturn(List.of(LocalDate.of(2026, 6, 18)));

        assertThat(service.calcularDataCorteMesclagem(29)).isEqualTo(LocalDate.of(2026, 6, 18));
    }

    @Test
    void aceitarLinha_respeitaCorteInclusive() {
        LocalDate corte = LocalDate.of(2026, 6, 17);
        assertThat(service.aceitarLinhaImportacaoMesclagem(LocalDate.of(2026, 6, 16), corte)).isFalse();
        assertThat(service.aceitarLinhaImportacaoMesclagem(LocalDate.of(2026, 6, 17), corte)).isTrue();
        assertThat(service.aceitarLinhaImportacaoMesclagem(LocalDate.of(2026, 6, 19), corte)).isTrue();
        assertThat(service.aceitarLinhaImportacaoMesclagem(LocalDate.of(2026, 6, 19), null)).isTrue();
    }
}
