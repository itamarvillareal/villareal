package br.com.vilareal.pessoa.application;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteWhatsAppEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaContatoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteWhatsAppRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TelefoneCadastroNormalizacaoServiceTest {

    @Mock
    private ClienteWhatsAppRepository clienteWhatsAppRepository;

    @Mock
    private ClienteRepository clienteRepository;

    @Mock
    private PessoaContatoRepository pessoaContatoRepository;

    @Mock
    private PessoaRepository pessoaRepository;

    private TelefoneCadastroNormalizacaoService service;

    @BeforeEach
    void setUp() {
        service = new TelefoneCadastroNormalizacaoService(
                clienteWhatsAppRepository,
                clienteRepository,
                pessoaContatoRepository,
                pessoaRepository);
    }

    @Test
    void normalizarParaWhatsAppEPersistir_atualizaClienteWhatsApp() {
        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(10L);
        ClienteWhatsAppEntity whatsapp = new ClienteWhatsAppEntity();
        whatsapp.setCliente(cliente);
        whatsapp.setNumero("61983123456");

        when(clienteWhatsAppRepository.findByCliente_IdAndAtivoTrueOrderByPrincipalDescIdAsc(10L))
                .thenReturn(List.of(whatsapp));
        when(clienteWhatsAppRepository.existsByCliente_IdAndNumero(10L, "5561983123456"))
                .thenReturn(false);
        when(clienteWhatsAppRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Optional<String> out = service.normalizarParaWhatsAppEPersistir(null, 10L, "61 98312-3456 / outro");

        assertThat(out).contains("5561983123456");
        assertThat(whatsapp.getNumero()).isEqualTo("5561983123456");
    }

    @Test
    void normalizarParaWhatsAppEPersistir_atualizaContatoPessoa() {
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setId(5L);
        PessoaContatoEntity contato = new PessoaContatoEntity();
        contato.setPessoa(pessoa);
        contato.setTipo("telefone");
        contato.setValor("(62) 99268-2445");
        contato.setDataLancamento(Instant.parse("2024-01-01T00:00:00Z"));
        contato.setDataAlteracao(Instant.parse("2024-01-01T00:00:00Z"));
        contato.setUsuarioLancamento("import");

        when(clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(5L)).thenReturn(List.of());
        when(pessoaContatoRepository.findByPessoa_IdOrderByIdAsc(5L)).thenReturn(List.of(contato));
        when(pessoaContatoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Optional<String> out = service.normalizarParaWhatsAppEPersistir(5L, null, "(62) 99268-2445");

        assertThat(out).contains("5562992682445");
        ArgumentCaptor<PessoaContatoEntity> captor = ArgumentCaptor.forClass(PessoaContatoEntity.class);
        verify(pessoaContatoRepository).save(captor.capture());
        assertThat(captor.getValue().getValor()).isEqualTo("5562992682445");
        assertThat(captor.getValue().getValorDigitos()).isEqualTo("5562992682445");
    }

    @Test
    void normalizarParaWhatsAppEPersistir_jaCanonico_naoSalva() {
        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(10L);
        ClienteWhatsAppEntity whatsapp = new ClienteWhatsAppEntity();
        whatsapp.setCliente(cliente);
        whatsapp.setNumero("5561983123456");

        when(clienteWhatsAppRepository.findByCliente_IdAndAtivoTrueOrderByPrincipalDescIdAsc(10L))
                .thenReturn(List.of(whatsapp));

        Optional<String> out = service.normalizarParaWhatsAppEPersistir(null, 10L, "5561983123456");

        assertThat(out).contains("5561983123456");
        verify(clienteWhatsAppRepository, never()).save(any());
    }

    @Test
    void normalizarParaWhatsAppEPersistir_invalido() {
        assertThat(service.normalizarParaWhatsAppEPersistir(1L, null, "abc")).isEmpty();
    }
}
