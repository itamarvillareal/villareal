package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.ContaBancariaResponse;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaBancariaEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaBancariaRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * B3: a classificação manual/real/virtual lê tipo/tem_extrato da conta_bancaria (FK), com fallback de
 * transição por numero_banco. Comportamento idêntico ao hardcode antigo (9/17/18 manuais, 900 virtual).
 */
class ContaBancariaApplicationServiceTest {

    private final ContaBancariaRepository repo = mock(ContaBancariaRepository.class);
    private final ContaBancariaApplicationService service = new ContaBancariaApplicationService(repo);

    private static ContaBancariaEntity conta(Integer numero, String nome, String tipo, boolean extrato) {
        ContaBancariaEntity c = new ContaBancariaEntity();
        c.setNumeroBanco(numero);
        c.setBancoNome(nome);
        c.setTipo(tipo);
        c.setTemExtrato(extrato);
        c.setAtivo(true);
        return c;
    }

    private static LancamentoFinanceiroEntity lanc(ContaBancariaEntity fk, Integer numeroBanco) {
        LancamentoFinanceiroEntity l = new LancamentoFinanceiroEntity();
        l.setContaBancaria(fk);
        l.setNumeroBanco(numeroBanco);
        return l;
    }

    @Test
    void leTipoETemExtratoDaFkQuandoPresente() {
        LancamentoFinanceiroEntity manual = lanc(conta(9, "LANÇ MANUAIS", "MANUAL", false), 9);
        LancamentoFinanceiroEntity real = lanc(conta(1, "Itau", "REAL", true), 1);
        LancamentoFinanceiroEntity virtual = lanc(conta(900, "REPASSE INTERNO", "VIRTUAL", false), 900);

        assertThat(service.isManual(manual)).isTrue();
        assertThat(service.temExtrato(manual)).isFalse();
        assertThat(service.tipo(manual)).isEqualTo("MANUAL");

        assertThat(service.isManual(real)).isFalse();
        assertThat(service.temExtrato(real)).isTrue();
        assertThat(service.tipo(real)).isEqualTo("REAL");

        assertThat(service.tipo(virtual)).isEqualTo("VIRTUAL");
        assertThat(service.temExtrato(virtual)).isFalse();

        // FK presente: NÃO consulta o repositório (sem fallback).
        verify(repo, never()).findByNumeroBanco(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void fkNulaResolvePorNumeroBancoEDaMesmoResultado() {
        // contas conhecidas: 9/17/18 = MANUAL/sem extrato; 900 = VIRTUAL/sem extrato; real = REAL/extrato.
        when(repo.findByNumeroBanco(9)).thenReturn(Optional.of(conta(9, "LANÇ MANUAIS", "MANUAL", false)));
        when(repo.findByNumeroBanco(17)).thenReturn(Optional.of(conta(17, "LANÇ EM DINHEIRO", "MANUAL", false)));
        when(repo.findByNumeroBanco(18)).thenReturn(Optional.of(conta(18, "LANÇ MANUAIS (2)", "MANUAL", false)));
        when(repo.findByNumeroBanco(900)).thenReturn(Optional.of(conta(900, "REPASSE INTERNO", "VIRTUAL", false)));
        when(repo.findByNumeroBanco(1)).thenReturn(Optional.of(conta(1, "Itau", "REAL", true)));

        for (int nb : new int[] {9, 17, 18}) {
            LancamentoFinanceiroEntity semFk = lanc(null, nb);
            assertThat(service.isManual(semFk)).as("nb=" + nb).isTrue();
            assertThat(service.temExtrato(semFk)).as("nb=" + nb).isFalse();
            assertThat(service.tipo(semFk)).as("nb=" + nb).isEqualTo("MANUAL");
        }

        LancamentoFinanceiroEntity virtualSemFk = lanc(null, 900);
        assertThat(service.tipo(virtualSemFk)).isEqualTo("VIRTUAL");
        assertThat(service.temExtrato(virtualSemFk)).isFalse();

        LancamentoFinanceiroEntity realSemFk = lanc(null, 1);
        assertThat(service.temExtrato(realSemFk)).isTrue();
        assertThat(service.isManual(realSemFk)).isFalse();
    }

    @Test
    void fkVersusFallbackProduzemResultadoIdentico() {
        ContaBancariaEntity manual = conta(9, "LANÇ MANUAIS", "MANUAL", false);
        when(repo.findByNumeroBanco(9)).thenReturn(Optional.of(manual));

        LancamentoFinanceiroEntity comFk = lanc(manual, 9);
        LancamentoFinanceiroEntity semFk = lanc(null, 9);

        assertThat(service.isManual(semFk)).isEqualTo(service.isManual(comFk));
        assertThat(service.temExtrato(semFk)).isEqualTo(service.temExtrato(comFk));
        assertThat(service.tipo(semFk)).isEqualTo(service.tipo(comFk));
    }

    @Test
    void semContaResolvivelUsaDefaultRealComExtrato() {
        LancamentoFinanceiroEntity semBanco = lanc(null, null);
        assertThat(service.temExtrato(semBanco)).isTrue();
        assertThat(service.isManual(semBanco)).isFalse();
        assertThat(service.tipo(semBanco)).isEqualTo("REAL");

        // numero_banco sem conta cadastrada (não deve ocorrer pós-V117): default REAL/extrato.
        when(repo.findByNumeroBanco(404)).thenReturn(Optional.empty());
        LancamentoFinanceiroEntity desconhecido = lanc(null, 404);
        assertThat(service.temExtrato(desconhecido)).isTrue();
        assertThat(service.tipo(desconhecido)).isEqualTo("REAL");
    }

    @Test
    void listarMapeiaClassificacao() {
        when(repo.findAllByOrderByNumeroBancoAsc()).thenReturn(List.of(
                conta(1, "Itau", "REAL", true),
                conta(9, "LANÇ MANUAIS", "MANUAL", false),
                conta(900, "REPASSE INTERNO", "VIRTUAL", false)));

        List<ContaBancariaResponse> out = service.listar();

        assertThat(out).hasSize(3);
        assertThat(out).anySatisfy(c -> {
            assertThat(c.numeroBanco()).isEqualTo(1);
            assertThat(c.tipo()).isEqualTo("REAL");
            assertThat(c.temExtrato()).isTrue();
        });
        assertThat(out).anySatisfy(c -> {
            assertThat(c.numeroBanco()).isEqualTo(9);
            assertThat(c.tipo()).isEqualTo("MANUAL");
            assertThat(c.temExtrato()).isFalse();
        });
        assertThat(out).anySatisfy(c -> {
            assertThat(c.numeroBanco()).isEqualTo(900);
            assertThat(c.tipo()).isEqualTo("VIRTUAL");
            assertThat(c.temExtrato()).isFalse();
        });
    }
}
