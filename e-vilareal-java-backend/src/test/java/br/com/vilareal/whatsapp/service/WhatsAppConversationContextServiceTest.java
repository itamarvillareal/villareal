package br.com.vilareal.whatsapp.service;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.whatsapp.dto.WhatsAppProcessoContextItemDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.CobrancaWhatsAppEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.CobrancaWhatsAppRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppConversationContextServiceTest {

    private static final String PHONE = "5511999887766";

    @Mock
    private CobrancaWhatsAppRepository cobrancaRepository;

    @Mock
    private ProcessoRepository processoRepository;

    @Mock
    private ClienteRepository clienteRepository;

    private WhatsAppConversationContextService service;

    @BeforeEach
    void setUp() {
        service = new WhatsAppConversationContextService(cobrancaRepository, processoRepository, clienteRepository);
    }

    @Test
    void resolverContextos_retornaProcessoECliente() {
        CobrancaWhatsAppEntity cobranca = new CobrancaWhatsAppEntity();
        cobranca.setId(10L);
        cobranca.setPhoneNumber(PHONE);
        cobranca.setProcessoId(5L);
        cobranca.setClienteId(20L);
        cobranca.setUnidadeDescricao("Unidade A-101");
        cobranca.setCondominioNome("Residencial Teste");
        cobranca.setStatus("ENVIADO");
        cobranca.setEnviadoAt(Instant.parse("2026-06-01T12:00:00Z"));

        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(5L);
        processo.setNumeroInterno(3);
        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(20L);
        cliente.setCodigoCliente("00000299");
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setNome("Terra Mundi");
        cliente.setPessoa(pessoa);
        processo.setCliente(cliente);

        when(cobrancaRepository.findRecentesPorSufixoTelefone(any(), anyCollection())).thenReturn(List.of(cobranca));
        when(processoRepository.findByIdInWithClienteAndPessoa(anyCollection())).thenReturn(List.of(processo));
        when(clienteRepository.findById(20L)).thenReturn(Optional.of(cliente));

        List<WhatsAppProcessoContextItemDTO> itens = service.resolverContextos(PHONE);

        assertThat(itens).hasSize(1);
        WhatsAppProcessoContextItemDTO item = itens.getFirst();
        assertThat(item.processoId()).isEqualTo(5L);
        assertThat(item.processoNumeroInterno()).isEqualTo(3);
        assertThat(item.codigoCliente()).isEqualTo("00000299");
        assertThat(item.unidadeDescricao()).isEqualTo("Unidade A-101");
    }

    @Test
    void sufixo11_extraiUltimosOnzeDigitos() {
        assertThat(WhatsAppConversationContextService.sufixo11("5511999887766")).isEqualTo("11999887766");
        assertThat(WhatsAppConversationContextService.sufixo11("(11) 99988-7766")).isEqualTo("11999887766");
    }
}
