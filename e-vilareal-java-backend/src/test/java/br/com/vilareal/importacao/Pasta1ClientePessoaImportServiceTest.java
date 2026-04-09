package br.com.vilareal.importacao;

import br.com.vilareal.importacao.dto.Pasta1ClientePessoaItemResponse;
import br.com.vilareal.importacao.dto.Pasta1ClientePessoaListaResponse;
import br.com.vilareal.importacao.dto.Pasta1ClientePessoaPersistStatus;
import br.com.vilareal.importacao.infrastructure.persistence.entity.PlanilhaPasta1ClienteEntity;
import br.com.vilareal.importacao.infrastructure.persistence.repository.PlanilhaPasta1ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class Pasta1ClientePessoaImportServiceTest {

    @Mock
    private Pasta1ClientePessoaReader reader;

    @Mock
    private PlanilhaPasta1ClienteRepository mapeamentoRepository;

    @Mock
    private PessoaRepository pessoaRepository;

    @Mock
    private ClienteRepository clienteRepository;

    @InjectMocks
    private Pasta1ClientePessoaImportService service;

    @Test
    void insereQuandoChaveNovaEPessoaExiste() {
        Pasta1ClientePessoaListaResponse lido = listaComLinha("1", 64L, 1);
        when(pessoaRepository.existsById(64L)).thenReturn(true);
        when(mapeamentoRepository.findById("00000001")).thenReturn(Optional.empty());
        PessoaEntity pessoaRef = mock(PessoaEntity.class);
        when(pessoaRepository.getReferenceById(64L)).thenReturn(pessoaRef);
        when(clienteRepository.findByCodigoCliente("00000001")).thenReturn(Optional.empty());

        var out = service.aplicarLista(lido);

        assertThat(out.getLinhasInseridas()).isEqualTo(1);
        assertThat(out.getLinhasAtualizadas()).isZero();
        assertThat(out.getLinhasIgnoradas()).isZero();
        assertThat(out.getDetalhes().get(0).getStatus()).isEqualTo(Pasta1ClientePessoaPersistStatus.INSERIDO);
        ArgumentCaptor<PlanilhaPasta1ClienteEntity> cap = ArgumentCaptor.forClass(PlanilhaPasta1ClienteEntity.class);
        verify(mapeamentoRepository).save(cap.capture());
        assertThat(cap.getValue().getChaveCliente()).isEqualTo("00000001");
        assertThat(cap.getValue().getPessoaId()).isEqualTo(64L);
        verify(clienteRepository).save(any(ClienteEntity.class));
    }

    @Test
    void ignoraQuandoMesmaPessoaJaAssociada() {
        Pasta1ClientePessoaListaResponse lido = listaComLinha("5", 10L, 2);
        when(pessoaRepository.existsById(10L)).thenReturn(true);
        PlanilhaPasta1ClienteEntity existente = new PlanilhaPasta1ClienteEntity();
        existente.setChaveCliente("00000005");
        existente.setPessoaId(10L);
        when(mapeamentoRepository.findById("00000005")).thenReturn(Optional.of(existente));

        var out = service.aplicarLista(lido);

        assertThat(out.getLinhasIgnoradas()).isEqualTo(1);
        verify(mapeamentoRepository, never()).save(any());
        verify(clienteRepository, never()).save(any());
    }

    @Test
    void atualizaQuandoPessoaDiferente() {
        Pasta1ClientePessoaListaResponse lido = listaComLinha("5", 99L, 2);
        when(pessoaRepository.existsById(99L)).thenReturn(true);
        PlanilhaPasta1ClienteEntity existente = new PlanilhaPasta1ClienteEntity();
        existente.setChaveCliente("00000005");
        existente.setPessoaId(10L);
        when(mapeamentoRepository.findById("00000005")).thenReturn(Optional.of(existente));
        PessoaEntity pessoaRef = mock(PessoaEntity.class);
        when(pessoaRepository.getReferenceById(99L)).thenReturn(pessoaRef);
        ClienteEntity clienteLinha = new ClienteEntity();
        clienteLinha.setCodigoCliente("00000005");
        when(clienteRepository.findByCodigoCliente("00000005")).thenReturn(Optional.of(clienteLinha));

        var out = service.aplicarLista(lido);

        assertThat(out.getLinhasAtualizadas()).isEqualTo(1);
        assertThat(out.getDetalhes().get(0).getStatus()).isEqualTo(Pasta1ClientePessoaPersistStatus.ATUALIZADO);
        assertThat(out.getDetalhes().get(0).getMensagem()).contains("10");
        verify(mapeamentoRepository).save(existente);
        assertThat(existente.getPessoaId()).isEqualTo(99L);
        verify(clienteRepository).save(clienteLinha);
        assertThat(clienteLinha.getPessoa()).isSameAs(pessoaRef);
    }

    @Test
    void ignoraQuandoPessoaNaoExiste() {
        Pasta1ClientePessoaListaResponse lido = listaComLinha("1", 64L, 1);
        when(pessoaRepository.existsById(64L)).thenReturn(false);

        var out = service.aplicarLista(lido);

        assertThat(out.getLinhasIgnoradas()).isEqualTo(1);
        verify(mapeamentoRepository, never()).save(any());
        verify(clienteRepository, never()).save(any());
    }

    private static Pasta1ClientePessoaListaResponse listaComLinha(String chaveA, Long pessoaId, int linhaExcel) {
        Pasta1ClientePessoaListaResponse lido = new Pasta1ClientePessoaListaResponse();
        lido.setArquivo("mem");
        lido.setTotalLinhasLidas(1);
        Pasta1ClientePessoaItemResponse item = new Pasta1ClientePessoaItemResponse();
        item.setLinhaExcel(linhaExcel);
        item.setClienteColunaA(chaveA);
        item.setPessoaId(pessoaId);
        lido.getItens().add(item);
        return lido;
    }
}
