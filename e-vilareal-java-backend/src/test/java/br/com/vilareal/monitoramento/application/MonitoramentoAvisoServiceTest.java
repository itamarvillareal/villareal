package br.com.vilareal.monitoramento.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.monitoramento.domain.PoloDaPessoa;
import br.com.vilareal.monitoramento.domain.SituacaoProcessoDescoberto;
import br.com.vilareal.monitoramento.infrastructure.persistence.entity.ProcessoDescobertoEntity;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.ProcessoDescobertoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.whatsapp.dto.WhatsAppTemplateDTO;
import br.com.vilareal.whatsapp.service.ClienteEnvioTelefoneResolver;
import br.com.vilareal.whatsapp.service.WhatsAppService;
import br.com.vilareal.whatsapp.service.WhatsAppTemplateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * A trava central do Bloco E: consentimento verificado NO BACKEND, antes de qualquer envio.
 * Sem consentimento → 403 e ZERO interações com o WhatsApp — mesmo que a UI chame o endpoint.
 */
class MonitoramentoAvisoServiceTest {

    private static final Long DESCOBERTO_ID = 42L;
    private static final String TELEFONE_BRUTO = "(62) 99999-0000";
    private static final String TELEFONE_CANONICO = WhatsAppService.formatPhoneNumber(TELEFONE_BRUTO);

    private ProcessoDescobertoRepository descobertoRepository;
    private ClienteRepository clienteRepository;
    private PessoaContatoRepository pessoaContatoRepository;
    private ClienteEnvioTelefoneResolver telefoneResolver;
    private WhatsAppTemplateService templateService;
    private WhatsAppService whatsAppService;
    private MonitoramentoAvisoService service;

    private PessoaEntity pessoa;
    private ProcessoDescobertoEntity descoberto;

    @BeforeEach
    void setUp() {
        descobertoRepository = mock(ProcessoDescobertoRepository.class);
        clienteRepository = mock(ClienteRepository.class);
        pessoaContatoRepository = mock(PessoaContatoRepository.class);
        telefoneResolver = mock(ClienteEnvioTelefoneResolver.class);
        templateService = mock(WhatsAppTemplateService.class);
        whatsAppService = mock(WhatsAppService.class);
        service = new MonitoramentoAvisoService(
                descobertoRepository,
                clienteRepository,
                pessoaContatoRepository,
                telefoneResolver,
                templateService,
                whatsAppService,
                "Villareal Advocacia");

        pessoa = new PessoaEntity();
        pessoa.setId(7273L);
        pessoa.setNome("BRUNO DE SOUZA PENA");
        pessoa.setAceitaAvisoProcessoNovo(false);
        pessoa.setTelefone(TELEFONE_BRUTO);

        descoberto = new ProcessoDescobertoEntity();
        descoberto.setId(DESCOBERTO_ID);
        descoberto.setPessoa(pessoa);
        descoberto.setNumeroReduzido("5157272-17");
        descoberto.setAnoDistribuicao(2026);
        descoberto.setNumeroCnj("5157272-17.2026.8.09.0007");
        descoberto.setServentia("Anápolis - UPJ Varas Cíveis: 1ª, 2ª, 3ª, 4ª, 5ª e 6ª");
        descoberto.setPoloDaPessoa(PoloDaPessoa.PASSIVO);
        descoberto.setSituacao(SituacaoProcessoDescoberto.NOVO);

        when(descobertoRepository.findByIdComPessoa(DESCOBERTO_ID)).thenReturn(Optional.of(descoberto));
        when(clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(pessoa.getId())).thenReturn(List.of());
        when(pessoaContatoRepository.findByPessoa_IdOrderByIdAsc(pessoa.getId())).thenReturn(List.of());
    }

    private void aprovarTemplate() {
        when(templateService.listarTemplates()).thenReturn(List.of(new WhatsAppTemplateDTO(
                "1", MonitoramentoAvisoService.TEMPLATE_AVISO, "APPROVED", "UTILITY", "pt_BR",
                "corpo", List.of(), 4)));
    }

    @Test
    void semConsentimentoRetorna403ENenhumaMensagemDisparada() {
        pessoa.setAceitaAvisoProcessoNovo(false);

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> service.avisar(DESCOBERTO_ID, TELEFONE_BRUTO, null));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertTrue(ex.getReason().contains("não registrou consentimento"));
        // Prova de que NADA foi disparado nem consultado: a trava vem antes de tudo.
        verifyNoInteractions(whatsAppService, templateService, telefoneResolver);
        assertNull(descoberto.getAvisoEnviadoEm());
        verify(descobertoRepository, never()).save(any());
    }

    @Test
    void comConsentimentoEnviaPeloTemplateEGravaRegistro() {
        pessoa.setAceitaAvisoProcessoNovo(true);
        aprovarTemplate();

        MonitoramentoAvisoService.ResultadoAviso r =
                service.avisar(DESCOBERTO_ID, TELEFONE_BRUTO, null);

        // Reuso da MESMA infra dos lembretes: sendTemplateMessage com aviso_novo_processo.
        verify(whatsAppService).sendTemplateMessage(
                eq(TELEFONE_CANONICO),
                eq("aviso_novo_processo"),
                eq("pt_BR"),
                eq(List.of(
                        "BRUNO DE SOUZA PENA",
                        "5157272-17.2026.8.09.0007",
                        "Anápolis - UPJ Varas Cíveis: 1ª, 2ª, 3ª, 4ª, 5ª e 6ª",
                        "Villareal Advocacia")),
                isNull(),
                isNull());
        assertEquals(TELEFONE_CANONICO, r.telefone());
        assertNotNull(descoberto.getAvisoEnviadoEm(), "registro do envio deve ser gravado");
        assertEquals(TELEFONE_CANONICO, descoberto.getAvisoEnviadoPara());
        verify(descobertoRepository).save(descoberto);
    }

    @Test
    void avisoJaEnviadoNuncaReenvia() {
        pessoa.setAceitaAvisoProcessoNovo(true);
        descoberto.setAvisoEnviadoEm(LocalDateTime.of(2026, 7, 1, 10, 0));
        descoberto.setAvisoEnviadoPara(TELEFONE_CANONICO);

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> service.avisar(DESCOBERTO_ID, TELEFONE_BRUTO, null));

        assertTrue(ex.getMessage().contains("reenvio bloqueado"));
        verifyNoInteractions(whatsAppService);
    }

    @Test
    void semTelefoneCadastradoFalhaClaroSemEnviar() {
        pessoa.setAceitaAvisoProcessoNovo(true);
        pessoa.setTelefone(null); // sem cliente, sem contato, sem telefone legado

        BusinessRuleException ex = assertThrows(
                BusinessRuleException.class,
                () -> service.avisar(DESCOBERTO_ID, TELEFONE_BRUTO, null));

        assertTrue(ex.getMessage().contains("Sem WhatsApp cadastrado"));
        verifyNoInteractions(whatsAppService);
    }

    @Test
    void templatePendenteNaMetaBloqueiaAntesDoEnvio() {
        pessoa.setAceitaAvisoProcessoNovo(true);
        when(templateService.listarTemplates()).thenReturn(List.of(new WhatsAppTemplateDTO(
                "1", MonitoramentoAvisoService.TEMPLATE_AVISO, "PENDING", "UTILITY", "pt_BR",
                "corpo", List.of(), 4)));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> service.avisar(DESCOBERTO_ID, TELEFONE_BRUTO, null));

        assertTrue(ex.getMessage().contains("pendente de aprovação"));
        verifyNoInteractions(whatsAppService);
        assertNull(descoberto.getAvisoEnviadoEm());
    }

    @Test
    void metaInconsultavelBloqueiaComMensagemClara() {
        pessoa.setAceitaAvisoProcessoNovo(true);
        when(templateService.listarTemplates()).thenThrow(new RuntimeException("timeout"));

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> service.avisar(DESCOBERTO_ID, TELEFONE_BRUTO, null));

        assertTrue(ex.getMessage().contains("Não foi possível verificar o status do template"));
        verifyNoInteractions(whatsAppService);
    }

    @Test
    void telefoneForaDoCadastroRejeitado() {
        pessoa.setAceitaAvisoProcessoNovo(true);

        BusinessRuleException ex = assertThrows(
                BusinessRuleException.class,
                () -> service.avisar(DESCOBERTO_ID, "(11) 98888-7777", null));

        assertTrue(ex.getMessage().contains("não está entre os cadastrados"));
        verifyNoInteractions(whatsAppService);
    }
}
