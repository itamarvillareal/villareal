package br.com.vilareal.whatsapp.service;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteWhatsAppRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppContactResolverServiceTest {

    private static final String PHONE = "5562994395882";
    private static final String PHONE_JULIANO = "5562983452868";

    @Mock
    private ClienteRepository clienteRepository;

    @Mock
    private ClienteWhatsAppRepository clienteWhatsAppRepository;

    @Mock
    private WhatsAppNomeExibicaoService nomeExibicaoService;

    private WhatsAppContactResolverService service;

    @BeforeEach
    void setUp() {
        service = new WhatsAppContactResolverService(
                clienteRepository, clienteWhatsAppRepository, nomeExibicaoService);
    }

    @Test
    void priorizaNomeDoCadastroSobrePerfilWhatsApp() {
        ClienteEntity cliente = clienteComNome("Karla Pedroza");
        when(clienteWhatsAppRepository.findClienteIdByTelefoneNormalizado(PHONE)).thenReturn(Optional.of(10L));
        when(clienteRepository.findById(10L)).thenReturn(Optional.of(cliente));

        assertEquals("Karla Pedroza", service.resolveContactName(PHONE, "Karla WhatsApp"));
    }

    @Test
    void usaPerfilWhatsAppQuandoNaoHaCadastro() {
        when(clienteWhatsAppRepository.findClienteIdByTelefoneNormalizado(PHONE)).thenReturn(Optional.empty());
        when(nomeExibicaoService.resolverNomeExibido(PHONE, null)).thenReturn(null);

        assertEquals("Karla WhatsApp", service.resolveContactName(PHONE, "Karla WhatsApp"));
    }

    @Test
    void resolvePorClienteIdDaMensagem() {
        ClienteEntity cliente = clienteComNome("Cliente Vinculado");
        when(clienteRepository.findById(7L)).thenReturn(Optional.of(cliente));

        assertEquals("Cliente Vinculado", service.resolveContactName(PHONE, null, 7L));
    }

    @Test
    void usaNomeLabelQuandoClienteNaoTemPessoa() {
        ClienteEntity cliente = new ClienteEntity();
        when(clienteWhatsAppRepository.findClienteIdByTelefoneNormalizado(PHONE)).thenReturn(Optional.of(3L));
        when(clienteRepository.findById(3L)).thenReturn(Optional.of(cliente));
        when(clienteWhatsAppRepository.findNomeLabelByTelefoneNormalizado(PHONE))
                .thenReturn(Optional.of("WhatsApp — Karla Pedroza"));

        assertEquals("Karla Pedroza", service.resolveContactName(PHONE, null));
    }

    @Test
    void resolvePessoaSemClienteViaNomeExibicaoService() {
        when(clienteWhatsAppRepository.findClienteIdByTelefoneNormalizado(PHONE_JULIANO))
                .thenReturn(Optional.empty());
        when(nomeExibicaoService.resolverNomeExibido(PHONE_JULIANO, null))
                .thenReturn("JULIANO CESAR MENDONÇA");

        assertEquals("JULIANO CESAR MENDONÇA", service.resolveContactName(PHONE_JULIANO, null));
    }

    @Test
    void retornaNullQuandoNaoHaNome() {
        when(clienteWhatsAppRepository.findClienteIdByTelefoneNormalizado(PHONE)).thenReturn(Optional.empty());
        when(nomeExibicaoService.resolverNomeExibido(PHONE, null)).thenReturn(null);

        assertEquals(null, service.resolveContactName(PHONE, null));
    }

    private static ClienteEntity clienteComNome(String nome) {
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setNome(nome);
        ClienteEntity cliente = new ClienteEntity();
        cliente.setPessoa(pessoa);
        return cliente;
    }
}
