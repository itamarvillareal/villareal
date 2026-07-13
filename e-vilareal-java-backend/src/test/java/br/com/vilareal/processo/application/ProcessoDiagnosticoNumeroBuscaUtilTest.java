package br.com.vilareal.processo.application;

import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigInteger;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProcessoDiagnosticoNumeroBuscaUtilTest {

    @Mock
    private ProcessoRepository processoRepository;

    @Test
    void normalizarSomenteDigitos_numeroProjudiInterno() {
        assertEquals("578042564", ProcessoDiagnosticoNumeroBuscaUtil.normalizarSomenteDigitos("5780425.64"));
    }

    @Test
    void ehNumeroProjudiInternoEmail_reconheceFormatoEmail() {
        assertTrue(ProcessoDiagnosticoNumeroBuscaUtil.ehNumeroProjudiInternoEmail("5780425.64"));
        assertTrue(ProcessoDiagnosticoNumeroBuscaUtil.ehNumeroProjudiInternoEmail("175134.85"));
        assertFalse(ProcessoDiagnosticoNumeroBuscaUtil.ehNumeroProjudiInternoEmail("5780425-64.2024.8.09.0007"));
    }

    @Test
    void buscarIdsProcessoPorNumero_projudiInternoUsaPrefixo() {
        when(processoRepository.findIdsByNumeroCnjDigitosIniciandoCom("578042564"))
                .thenReturn(List.of(BigInteger.valueOf(12499L)));

        List<BigInteger> ids =
                ProcessoDiagnosticoNumeroBuscaUtil.buscarIdsProcessoPorNumero("5780425.64", processoRepository);

        assertEquals(List.of(BigInteger.valueOf(12499L)), ids);
        verify(processoRepository).findIdsByNumeroCnjDigitosIniciandoCom("578042564");
        verifyNoMoreInteractions(processoRepository);
    }

    @Test
    void buscarIdsProcessoPorNumero_projudiInternoSemPrefixoNaoUsaContendo() {
        when(processoRepository.findIdsByNumeroCnjDigitosIniciandoCom("550062297")).thenReturn(List.of());

        List<BigInteger> ids =
                ProcessoDiagnosticoNumeroBuscaUtil.buscarIdsProcessoPorNumero("5500622.97", processoRepository);

        assertTrue(ids.isEmpty());
        verify(processoRepository).findIdsByNumeroCnjDigitosIniciandoCom("550062297");
        verifyNoMoreInteractions(processoRepository);
    }

    @Test
    void buscarIdsProcessoPorNumero_projudiInternoComZeroEsquerdaNoSequencial() {
        when(processoRepository.findIdsByNumeroCnjDigitosIniciandoCom("01330579")).thenReturn(List.of());
        when(processoRepository.findIdsByNumeroCnjDigitosIniciandoCom("0133057"))
                .thenReturn(List.of(BigInteger.valueOf(8801L)));

        List<BigInteger> ids =
                ProcessoDiagnosticoNumeroBuscaUtil.buscarIdsProcessoPorNumero("133057.9", processoRepository);

        assertEquals(List.of(BigInteger.valueOf(8801L)), ids);
        verify(processoRepository).findIdsByNumeroCnjDigitosIniciandoCom("01330579");
        verify(processoRepository).findIdsByNumeroCnjDigitosIniciandoCom("0133057");
    }

    @Test
    void formatarNumeroProjudiInternoEmail_preencheZeroEsquerda() {
        assertEquals("0133057.9", ProcessoDiagnosticoNumeroBuscaUtil.formatarNumeroProjudiInternoEmail("133057.9"));
        assertEquals("5780425.64", ProcessoDiagnosticoNumeroBuscaUtil.formatarNumeroProjudiInternoEmail("5780425.64"));
        assertEquals("0175134.85", ProcessoDiagnosticoNumeroBuscaUtil.formatarNumeroProjudiInternoEmail("175134.85"));
    }

    @Test
    void buscarIdsProcessoPorNumero_cnjCompletoUsaIgualdade() {
        String cnj20 = "57804256420248090007";
        when(processoRepository.findIdsByNumeroCnjNormalizadoDiagnostico(cnj20))
                .thenReturn(List.of(BigInteger.valueOf(1L)));

        List<BigInteger> ids = ProcessoDiagnosticoNumeroBuscaUtil.buscarIdsProcessoPorNumero(
                "5780425-64.2024.8.09.0007", processoRepository);

        assertEquals(List.of(BigInteger.valueOf(1L)), ids);
        verify(processoRepository).findIdsByNumeroCnjNormalizadoDiagnostico(cnj20);
    }

    @Test
    void buscarIdsProcessoPorNumero_cnjLegado19DigitosComZeroAFrenteNaBusca() {
        String cnj20 = "00256588920178090006";
        String cnj19 = "0256588920178090006";
        when(processoRepository.findIdsByNumeroCnjNormalizadoDiagnostico(cnj20)).thenReturn(List.of());
        when(processoRepository.findIdsByNumeroCnjNormalizadoDiagnostico(cnj19))
                .thenReturn(List.of(BigInteger.valueOf(9001L)));

        List<BigInteger> ids = ProcessoDiagnosticoNumeroBuscaUtil.buscarIdsProcessoPorNumero(
                "00256588920178090006", processoRepository);

        assertEquals(List.of(BigInteger.valueOf(9001L)), ids);
        verify(processoRepository).findIdsByNumeroCnjNormalizadoDiagnostico(cnj20);
        verify(processoRepository).findIdsByNumeroCnjNormalizadoDiagnostico(cnj19);
    }
}
