package br.com.vilareal.whatsapp.service;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteWhatsAppEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteWhatsAppRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClienteEnvioTelefoneResolverDetalheTest {

    @Mock
    private ClienteWhatsAppRepository clienteWhatsAppRepository;

    @Mock
    private PessoaContatoRepository pessoaContatoRepository;

    @InjectMocks
    private ClienteEnvioTelefoneResolver resolver;

    @Test
    void resolverTelefonesDetalhados_whatsappPrincipal_canonicalizaCelular() {
        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(7L);
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setId(3L);
        cliente.setPessoa(pessoa);

        ClienteWhatsAppEntity w = new ClienteWhatsAppEntity();
        w.setNumero("556292975894");
        w.setPrincipal(true);

        when(clienteWhatsAppRepository.findByCliente_IdAndAtivoTrueOrderByPrincipalDescIdAsc(7L))
                .thenReturn(List.of(w));

        List<ClienteEnvioTelefoneResolver.TelefoneEnvioDetalhe> out = resolver.resolverTelefonesDetalhados(cliente);

        assertThat(out).hasSize(1);
        assertThat(out.get(0).numeroCanonico()).isEqualTo("5562992975894");
        assertThat(out.get(0).principal()).isTrue();
        assertThat(out.get(0).label()).isEqualTo("WhatsApp principal");
    }
}
