package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LancamentoFinanceiroImportDedupServiceTest {

    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;

    @InjectMocks
    private LancamentoFinanceiroImportDedupService service;

    @Test
    void avaliarLinhaImportacao_jaExiste_retornaSkip() {
        when(lancamentoRepository.existsByNumeroBancoAndNumeroLancamento(26, "ABC123")).thenReturn(true);

        assertThat(service.avaliarLinhaImportacao(26, "ABC123"))
                .isEqualTo(LancamentoFinanceiroImportDedupService.AcaoImportacaoExtrato.SKIP_JA_EXISTE);
    }

    @Test
    void avaliarLinhaImportacao_naoExiste_retornaInserir() {
        when(lancamentoRepository.existsByNumeroBancoAndNumeroLancamento(26, "NOVO999")).thenReturn(false);

        assertThat(service.avaliarLinhaImportacao(26, "NOVO999"))
                .isEqualTo(LancamentoFinanceiroImportDedupService.AcaoImportacaoExtrato.INSERIR);
    }

    @Test
    void avaliarLinhaImportacao_mesmoNumeroEmBancosDiferentes_naoColide() {
        when(lancamentoRepository.existsByNumeroBancoAndNumeroLancamento(26, "X1")).thenReturn(true);
        when(lancamentoRepository.existsByNumeroBancoAndNumeroLancamento(4, "X1")).thenReturn(false);

        assertThat(service.avaliarLinhaImportacao(26, "X1"))
                .isEqualTo(LancamentoFinanceiroImportDedupService.AcaoImportacaoExtrato.SKIP_JA_EXISTE);
        assertThat(service.avaliarLinhaImportacao(4, "X1"))
                .isEqualTo(LancamentoFinanceiroImportDedupService.AcaoImportacaoExtrato.INSERIR);
    }

    @Test
    void numerosLancamentoJaExistentes_retornaApenasDoBancoInformado() {
        when(lancamentoRepository.findNumeroLancamentoExistentesPorBanco(eq(26), eq(Set.of("A", "B", "C"))))
                .thenReturn(List.of("A", "C"));

        Set<String> existentes = service.numerosLancamentoJaExistentes(26, List.of("A", "B", "C"));

        assertThat(existentes).containsExactlyInAnyOrder("A", "C");
        verify(lancamentoRepository).findNumeroLancamentoExistentesPorBanco(26, Set.of("A", "B", "C"));
    }
}
