package br.com.vilareal.pessoa.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClienteResolverServiceTest {

    @Mock
    private ClienteRepository clienteRepository;

    @Mock
    private PessoaRepository pessoaRepository;

    @InjectMocks
    private ClienteResolverService service;

    @Test
    void resolverClienteParaTitular_matchDiretoPorPessoaId() {
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setId(1809L);
        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(42L);
        cliente.setCodigoCliente("00001809");
        cliente.setPessoa(pessoa);

        when(clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(1809L)).thenReturn(List.of(cliente));

        ClienteEntity res = service.resolverClienteParaTitular(1809L);

        assertThat(res.getId()).isEqualTo(42L);
        assertThat(res.getCodigoCliente()).isEqualTo("00001809");
    }

    @Test
    void resolverClienteParaTitular_fallbackLpadQuandoSemMatchDireto() {
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setId(728L);
        ClienteEntity clienteLpad = new ClienteEntity();
        clienteLpad.setId(99L);
        clienteLpad.setCodigoCliente("00000728");
        clienteLpad.setPessoa(pessoa);

        when(clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(728L)).thenReturn(List.of());
        when(clienteRepository.findByCodigoClienteFetchPessoa("00000728")).thenReturn(Optional.of(clienteLpad));

        ClienteEntity res = service.resolverClienteParaTitular(728L);

        assertThat(res.getId()).isEqualTo(99L);
    }

    @Test
    void resolverClienteParaTitular_lancaQuandoNaoEncontra() {
        when(clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(9999L)).thenReturn(List.of());
        when(clienteRepository.findByCodigoClienteFetchPessoa(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resolverClienteParaTitular(9999L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void resolverClientePorCodigo_encontraPorTrim() {
        ClienteEntity c = new ClienteEntity();
        c.setId(7L);
        c.setCodigoCliente("00000123");
        when(clienteRepository.findByCodigoClienteFetchPessoaTrim("00000123")).thenReturn(Optional.of(c));

        assertThat(service.resolverClientePorCodigo("00000123").getId()).isEqualTo(7L);
    }

    @Test
    void buscarPorId_retornaCliente() {
        ClienteEntity c = new ClienteEntity();
        c.setId(5L);
        when(clienteRepository.findById(5L)).thenReturn(Optional.of(c));

        assertThat(service.buscarPorId(5L).getId()).isEqualTo(5L);
    }
}
