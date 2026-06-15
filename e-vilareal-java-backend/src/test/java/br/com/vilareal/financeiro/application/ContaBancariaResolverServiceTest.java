package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaBancariaEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaBancariaRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * B1: o resolver é o ponto único que garante conta_bancaria_id sempre populado na criação de lançamento.
 */
class ContaBancariaResolverServiceTest {

    private final ContaBancariaRepository repo = mock(ContaBancariaRepository.class);

    private ContaBancariaResolverService comSelf(ContaBancariaResolverService self) {
        return new ContaBancariaResolverService(repo, self);
    }

    private static ContaBancariaEntity conta(Long id, Integer numero, String tipo, boolean extrato) {
        ContaBancariaEntity c = new ContaBancariaEntity();
        c.setId(id);
        c.setNumeroBanco(numero);
        c.setTipo(tipo);
        c.setTemExtrato(extrato);
        c.setAtivo(true);
        return c;
    }

    @Test
    void numeroBancoNull_retornaNullSemTocarRepo() {
        ContaBancariaResolverService self = mock(ContaBancariaResolverService.class);
        ContaBancariaResolverService svc = comSelf(self);

        assertThat(svc.resolver(null, "Qualquer")).isNull();

        verifyNoInteractions(repo);
        verifyNoInteractions(self);
    }

    @Test
    void numeroBancoExistente_retornaContaCertaSemProvisionar() {
        ContaBancariaResolverService self = mock(ContaBancariaResolverService.class);
        ContaBancariaResolverService svc = comSelf(self);
        ContaBancariaEntity existente = conta(10L, 1, "REAL", true);
        when(repo.findByNumeroBanco(1)).thenReturn(Optional.of(existente));

        assertThat(svc.resolver(1, "Itau")).isSameAs(existente);

        verify(self, never()).provisionar(any(), any());
    }

    @Test
    void numeroBancoAusente_delegaProvisionamento() {
        ContaBancariaResolverService self = mock(ContaBancariaResolverService.class);
        ContaBancariaResolverService svc = comSelf(self);
        ContaBancariaEntity nova = conta(20L, 99, "REAL", true);
        when(repo.findByNumeroBanco(99)).thenReturn(Optional.empty());
        when(self.provisionar(99, "Banco Novo")).thenReturn(nova);

        assertThat(svc.resolver(99, "Banco Novo")).isSameAs(nova);

        verify(self).provisionar(99, "Banco Novo");
    }

    @Test
    void provisionar_numeroNovo_criaContaRealComExtratoENomeTrimado() {
        ContaBancariaResolverService svc = comSelf(null);
        when(repo.findByNumeroBanco(7)).thenReturn(Optional.empty());
        when(repo.saveAndFlush(any(ContaBancariaEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ContaBancariaEntity resultado = svc.provisionar(7, "  Novo Banco  ");

        ArgumentCaptor<ContaBancariaEntity> captor = ArgumentCaptor.forClass(ContaBancariaEntity.class);
        verify(repo).saveAndFlush(captor.capture());
        ContaBancariaEntity salvo = captor.getValue();
        assertThat(salvo.getNumeroBanco()).isEqualTo(7);
        assertThat(salvo.getTipo()).isEqualTo("REAL");
        assertThat(salvo.getTemExtrato()).isTrue();
        assertThat(salvo.getAtivo()).isTrue();
        assertThat(salvo.getBancoNome()).isEqualTo("Novo Banco");
        assertThat(resultado).isSameAs(salvo);
    }

    @Test
    void provisionar_corrida_naoDuplicaERebuscaExistente() {
        ContaBancariaResolverService svc = comSelf(null);
        ContaBancariaEntity criadaPorConcorrente = conta(30L, 7, "REAL", true);
        // 1ª busca: ausente; após colidir no UK, 2ª busca acha a criada concorrentemente.
        when(repo.findByNumeroBanco(7))
                .thenReturn(Optional.empty(), Optional.of(criadaPorConcorrente));
        when(repo.saveAndFlush(any(ContaBancariaEntity.class)))
                .thenThrow(new DataIntegrityViolationException("UK numero_banco"));

        ContaBancariaEntity resultado = svc.provisionar(7, "Banco");

        assertThat(resultado).isSameAs(criadaPorConcorrente);
        verify(repo, times(1)).saveAndFlush(any(ContaBancariaEntity.class));
        verify(repo, times(2)).findByNumeroBanco(7);
    }
}
