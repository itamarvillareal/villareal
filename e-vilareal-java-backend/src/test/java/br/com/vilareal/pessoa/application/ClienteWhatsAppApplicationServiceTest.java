package br.com.vilareal.pessoa.application;

import br.com.vilareal.pessoa.api.dto.ClienteWhatsAppItemRequest;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteWhatsAppEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaContatoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteWhatsAppRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClienteWhatsAppApplicationServiceTest {

    @Mock
    private ClienteRepository clienteRepository;

    @Mock
    private ClienteWhatsAppRepository clienteWhatsAppRepository;

    @Mock
    private PessoaRepository pessoaRepository;

    @Mock
    private PessoaContatoRepository pessoaContatoRepository;

    @InjectMocks
    private ClienteWhatsAppApplicationService service;

    @Test
    void importarTelefonesDaPessoa_copiaContatoSemAlterarPessoaContato() {
        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(10L);
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setId(5L);
        pessoa.setNome("Maria");

        PessoaContatoEntity contato = new PessoaContatoEntity();
        contato.setId(99L);
        contato.setPessoa(pessoa);
        contato.setTipo("telefone");
        contato.setValor("(62) 98888-7777");

        ClienteWhatsAppEntity salvo = new ClienteWhatsAppEntity();
        salvo.setId(1L);
        salvo.setCliente(cliente);
        salvo.setNumero("5562988887777");
        salvo.setPreenchidoAutomaticamente(true);
        salvo.setPrincipal(true);
        salvo.setAtivo(true);

        when(clienteRepository.findById(10L)).thenReturn(Optional.of(cliente));
        when(clienteRepository.existsById(10L)).thenReturn(true);
        when(pessoaRepository.existsById(5L)).thenReturn(true);
        when(clienteWhatsAppRepository.findByCliente_IdOrderByPrincipalDescIdAsc(10L))
                .thenReturn(List.of())
                .thenReturn(List.of(salvo))
                .thenReturn(List.of(salvo));
        when(pessoaContatoRepository.findByPessoa_IdOrderByIdAsc(5L)).thenReturn(List.of(contato));
        when(pessoaRepository.findById(5L)).thenReturn(Optional.of(pessoa));
        when(clienteWhatsAppRepository.save(any())).thenAnswer(inv -> {
            ClienteWhatsAppEntity e = inv.getArgument(0);
            e.setId(1L);
            return salvo;
        });

        var result = service.importarTelefonesDaPessoa(10L, 5L);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().getNumero()).isEqualTo("5562988887777");
        assertThat(result.getFirst().isPreenchidoAutomaticamente()).isTrue();
        verify(pessoaContatoRepository).findByPessoa_IdOrderByIdAsc(5L);
    }

    @Test
    void substituir_persisteNumerosNormalizados() {
        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(1L);
        ClienteWhatsAppEntity salvo = new ClienteWhatsAppEntity();
        salvo.setId(1L);
        salvo.setCliente(cliente);
        salvo.setNumero("5562999991234");
        salvo.setNomeLabel("Principal");
        salvo.setPrincipal(true);
        salvo.setAtivo(true);

        when(clienteRepository.findById(1L)).thenReturn(Optional.of(cliente));
        when(clienteRepository.existsById(1L)).thenReturn(true);
        when(clienteWhatsAppRepository.findByCliente_IdOrderByPrincipalDescIdAsc(1L))
                .thenReturn(List.of(salvo));
        when(clienteWhatsAppRepository.save(any())).thenReturn(salvo);

        ClienteWhatsAppItemRequest req = new ClienteWhatsAppItemRequest();
        req.setNumero("62999991234");
        req.setNomeLabel("Principal");
        req.setPrincipal(true);

        var result = service.substituir(1L, List.of(req));

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().getNumero()).startsWith("55");
    }
}
