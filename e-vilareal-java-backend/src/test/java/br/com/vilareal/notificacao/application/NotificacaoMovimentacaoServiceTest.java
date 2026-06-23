package br.com.vilareal.notificacao.application;

import br.com.vilareal.agendamento.infrastructure.persistence.entity.MovimentacaoMonitoradaEntity;
import br.com.vilareal.notificacao.api.dto.DestinatariosCanaisDto;
import br.com.vilareal.notificacao.api.dto.NotificacaoResultado;
import br.com.vilareal.notificacao.domain.NotificacaoEnvioStatus;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.whatsapp.service.WhatsAppSchedulerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificacaoMovimentacaoServiceTest {

    @Mock
    private NotificacaoDestinatarioService notificacaoDestinatarioService;

    @Mock
    private WhatsAppSchedulerService whatsAppSchedulerService;

    @Mock
    private NotificacaoMovimentacaoEmailRenderer emailRenderer;

    @Mock
    private NotificacaoEmailService notificacaoEmailService;

    @Mock
    private ProcessoParteRepository processoParteRepository;

    private NotificacaoMovimentacaoService service;

    @BeforeEach
    void setUp() {
        service = new NotificacaoMovimentacaoService(
                notificacaoDestinatarioService,
                whatsAppSchedulerService,
                emailRenderer,
                notificacaoEmailService,
                processoParteRepository);
    }

    @Test
    void notificarNovidade_comEmail_enviadoSincrono() throws Exception {
        MovimentacaoMonitoradaEntity nova = movimentacao("481112538", "Decisão");
        ProcessoEntity processo = processoComCliente();
        when(notificacaoDestinatarioService.resolver(10L))
                .thenReturn(new DestinatariosCanaisDto(List.of(), List.of("eu@test.com")));
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(10L)).thenReturn(List.of());
        when(emailRenderer.montarAssunto(anyString(), anyString(), anyString(), anyString()))
                .thenReturn("[Monitor] Nova movimentação — CNJ (Maria)");
        when(emailRenderer.renderCorpoHtml(anyString(), anyString(), anyString(), anyString(), anyList()))
                .thenReturn("<p>Decisão</p>");

        NotificacaoResultado resultado = service.notificarNovidade(processo, List.of(nova));

        assertThat(resultado.status()).isEqualTo(NotificacaoEnvioStatus.ENVIADO);
        assertThat(resultado.destinatarios()).isEqualTo("eu@test.com");
        assertThat(resultado.erro()).isNull();
        verify(notificacaoEmailService)
                .enviar(eq(List.of("eu@test.com")), eq("[Monitor] Nova movimentação — CNJ (Maria)"), eq("<p>Decisão</p>"));

        Thread.sleep(150);
        verify(whatsAppSchedulerService, never()).enfileirarAtualizacaoProcesso(any(), any(), any(), any(), any());
    }

    @Test
    void notificarNovidade_semDestinatarioEmail() throws Exception {
        ProcessoEntity processo = processoComCliente();
        when(notificacaoDestinatarioService.resolver(10L))
                .thenReturn(new DestinatariosCanaisDto(List.of("+5562911110001"), List.of()));
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(10L)).thenReturn(List.of());

        NotificacaoResultado resultado =
                service.notificarNovidade(processo, List.of(movimentacao("1", "x")));

        assertThat(resultado.status()).isEqualTo(NotificacaoEnvioStatus.SEM_DESTINATARIO);
        verify(notificacaoEmailService, never()).enviar(any(), any(), any());
    }

    @Test
    void notificarNovidade_falhaEmail_retornaFalhaSemLancar() throws Exception {
        ProcessoEntity processo = processoComCliente();
        when(notificacaoDestinatarioService.resolver(10L))
                .thenReturn(new DestinatariosCanaisDto(List.of(), List.of("a@b.com")));
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(10L)).thenReturn(List.of());
        when(emailRenderer.montarAssunto(anyString(), anyString(), anyString(), anyString())).thenReturn("assunto");
        when(emailRenderer.renderCorpoHtml(anyString(), anyString(), anyString(), anyString(), anyList()))
                .thenReturn("<p>x</p>");
        doThrow(new RuntimeException("gmail down")).when(notificacaoEmailService).enviar(any(), any(), any());

        NotificacaoResultado resultado =
                service.notificarNovidade(processo, List.of(movimentacao("1", "leg")));
        assertThat(resultado.status()).isEqualTo(NotificacaoEnvioStatus.FALHA);
        assertThat(resultado.destinatarios()).isEqualTo("a@b.com");
        assertThat(resultado.erro()).contains("gmail down");
    }

    @Test
    void notificarNovidade_listaVazia_naoAplicavel() throws Exception {
        ProcessoEntity processo = processoComCliente();

        NotificacaoResultado resultado = service.notificarNovidade(processo, List.of());

        assertThat(resultado.status()).isEqualTo(NotificacaoEnvioStatus.NAO_APLICAVEL);
        verify(notificacaoDestinatarioService, never()).resolver(any());
        verify(notificacaoEmailService, never()).enviar(any(), any(), any());
    }

    @Test
    void notificarNovidade_whatsappAssincrono() throws Exception {
        ProcessoEntity processo = processoComCliente();
        when(notificacaoDestinatarioService.resolver(10L))
                .thenReturn(new DestinatariosCanaisDto(
                        List.of("+5562911110001", "+5562911110002"), List.of("eu@test.com")));
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(10L)).thenReturn(List.of());
        when(emailRenderer.montarAssunto(anyString(), anyString(), anyString(), anyString())).thenReturn("assunto");
        when(emailRenderer.renderCorpoHtml(anyString(), anyString(), anyString(), anyString(), anyList()))
                .thenReturn("<p>ok</p>");

        service.notificarNovidade(processo, List.of(movimentacao("2", "Juntada")));

        Thread.sleep(200);
        verify(whatsAppSchedulerService, times(2))
                .enfileirarAtualizacaoProcesso(anyString(), any(), eq(5L), eq(10L), any());
    }

    @Test
    void enviarEmailNovidade_apenasEmail_semWhatsapp() throws Exception {
        when(notificacaoDestinatarioService.resolver(10L))
                .thenReturn(new DestinatariosCanaisDto(List.of(), List.of("a@b.com")));
        when(emailRenderer.montarAssunto(anyString(), anyString(), anyString(), anyString())).thenReturn("assunto");
        when(emailRenderer.renderCorpoHtml(anyString(), anyString(), anyString(), anyString(), anyList()))
                .thenReturn("<p>ok</p>");

        NotificacaoResultado resultado =
                service.enviarEmailNovidade(10L, "CNJ", "Cliente", "Autor X", "Ré Y", List.of(movimentacao("1", "x")));

        assertThat(resultado.status()).isEqualTo(NotificacaoEnvioStatus.ENVIADO);
        verify(notificacaoEmailService).enviar(any(), eq("assunto"), eq("<p>ok</p>"));
    }

    @Test
    void resolverNomeCliente_usaNomeReferenciaOuPessoa() {
        ProcessoEntity p = processoComCliente();
        p.getCliente().setNomeReferencia("Condomínio X");

        assertThat(NotificacaoMovimentacaoService.resolverNomeCliente(p)).isEqualTo("Condomínio X");

        p.getCliente().setNomeReferencia(null);
        assertThat(NotificacaoMovimentacaoService.resolverNomeCliente(p)).isEqualTo("Maria Silva");
    }

    private static MovimentacaoMonitoradaEntity movimentacao(String idMovi, String legenda) {
        MovimentacaoMonitoradaEntity e = new MovimentacaoMonitoradaEntity();
        e.setIdMovi(idMovi);
        e.setLegenda(legenda);
        e.setNumero(1);
        e.setDataMovimentacao(LocalDateTime.of(2026, 6, 4, 10, 0));
        return e;
    }

    private static ProcessoEntity processoComCliente() {
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setNome("Maria Silva");
        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(5L);
        cliente.setPessoa(pessoa);
        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(10L);
        processo.setNumeroCnj("5059346-36.2026.8.09.0007");
        processo.setCliente(cliente);
        return processo;
    }
}
