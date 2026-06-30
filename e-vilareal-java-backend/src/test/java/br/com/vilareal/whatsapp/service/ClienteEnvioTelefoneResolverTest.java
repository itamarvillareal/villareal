package br.com.vilareal.whatsapp.service;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteWhatsAppEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaContatoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteWhatsAppRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClienteEnvioTelefoneResolverTest {

    @Mock
    private ClienteWhatsAppRepository clienteWhatsAppRepository;

    @Mock
    private PessoaContatoRepository pessoaContatoRepository;

    private ClienteEnvioTelefoneResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new ClienteEnvioTelefoneResolver(clienteWhatsAppRepository, pessoaContatoRepository);
    }

    @Test
    void retornaTodosWhatsappAtivosSemDuplicata() {
        ClienteEntity cliente = clienteComId(10L);
        ClienteWhatsAppEntity principal = whatsApp(cliente, "62982234500", true);
        ClienteWhatsAppEntity secundario = whatsApp(cliente, "(62) 99229-0790", false);
        ClienteWhatsAppEntity duplicado = whatsApp(cliente, "62992290790", false);

        when(clienteWhatsAppRepository.findByCliente_IdAndAtivoTrueOrderByPrincipalDescIdAsc(10L))
                .thenReturn(List.of(principal, secundario, duplicado));

        List<String> telefones = resolver.resolverTelefonesCliente(cliente);

        assertThat(telefones).containsExactly("5562982234500", "5562992290790");
    }

    @Test
    void fallbackParaContatosTelefoneDaPessoaQuandoSemWhatsappCadastro() {
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setId(5L);
        pessoa.setTelefone("62981112233");

        ClienteEntity cliente = clienteComId(20L);
        cliente.setPessoa(pessoa);

        PessoaContatoEntity c1 = new PessoaContatoEntity();
        c1.setTipo("telefone");
        c1.setValor("62981112233");
        PessoaContatoEntity c2 = new PessoaContatoEntity();
        c2.setTipo("telefone");
        c2.setValor("62983334455");
        PessoaContatoEntity email = new PessoaContatoEntity();
        email.setTipo("email");
        email.setValor("a@b.com");

        when(clienteWhatsAppRepository.findByCliente_IdAndAtivoTrueOrderByPrincipalDescIdAsc(20L))
                .thenReturn(List.of());
        when(pessoaContatoRepository.findByPessoa_IdOrderByIdAsc(5L)).thenReturn(List.of(c1, c2, email));

        List<String> telefones = resolver.resolverTelefonesCliente(cliente);

        assertThat(telefones).containsExactly("5562981112233", "5562983334455");
    }

    private static ClienteEntity clienteComId(long id) {
        ClienteEntity c = new ClienteEntity();
        c.setId(id);
        return c;
    }

    private static ClienteWhatsAppEntity whatsApp(ClienteEntity cliente, String numero, boolean principal) {
        ClienteWhatsAppEntity w = new ClienteWhatsAppEntity();
        w.setCliente(cliente);
        w.setNumero(numero);
        w.setPrincipal(principal);
        w.setAtivo(true);
        return w;
    }
}
