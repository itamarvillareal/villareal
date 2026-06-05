package br.com.vilareal.notificacao.application;

import br.com.vilareal.agendamento.infrastructure.persistence.entity.MovimentacaoMonitoradaEntity;
import br.com.vilareal.notificacao.api.dto.DestinatariosCanaisDto;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.whatsapp.service.WhatsAppSchedulerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
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

    private NotificacaoMovimentacaoService service;

    @BeforeEach
    void setUp() {
        service = new NotificacaoMovimentacaoService(
                notificacaoDestinatarioService,
                whatsAppSchedulerService,
                emailRenderer,
                notificacaoEmailService);
    }

    @Test
    void dispararNotificacoes_comEmailEWhatsapp_enviaEmailEEnfileira() {
        MovimentacaoMonitoradaEntity nova = movimentacao("481112538", "Decisão");
        when(notificacaoDestinatarioService.resolver(10L))
                .thenReturn(new DestinatariosCanaisDto(
                        List.of("+5562911110001"), List.of("eu@test.com")));
        when(emailRenderer.montarAssunto(anyString(), anyString()))
                .thenReturn("[Monitor] Nova movimentação — CNJ (Maria)");
        when(emailRenderer.renderCorpoHtml(anyString(), anyString(), anyList()))
                .thenReturn("<p>Decisão</p>");

        service.dispararNotificacoes(
                10L, 5L, "5059346-36.2026.8.09.0007", "Maria", "Decisão", "desc", List.of(nova));

        verify(notificacaoEmailService)
                .enviar(eq(List.of("eu@test.com")), eq("[Monitor] Nova movimentação — CNJ (Maria)"), eq("<p>Decisão</p>"));
        verify(whatsAppSchedulerService).enfileirarAtualizacaoProcesso(anyString(), any(), eq(5L), eq(10L), eq("desc"));
    }

    @Test
    void dispararNotificacoes_apenasEmail_semWhatsapp() {
        when(notificacaoDestinatarioService.resolver(10L))
                .thenReturn(new DestinatariosCanaisDto(List.of(), List.of("a@b.com")));
        when(emailRenderer.montarAssunto(anyString(), anyString())).thenReturn("assunto");
        when(emailRenderer.renderCorpoHtml(anyString(), anyString(), anyList())).thenReturn("<p>ok</p>");

        service.dispararNotificacoes(10L, null, "CNJ", "Cliente", "mov", "desc", List.of(movimentacao("1", "x")));

        verify(notificacaoEmailService).enviar(any(), eq("assunto"), eq("<p>ok</p>"));
        verify(whatsAppSchedulerService, never()).enfileirarAtualizacaoProcesso(any(), any(), any(), any(), any());
    }

    @Test
    void dispararNotificacoes_falhaEmail_naoImpedeWhatsapp() {
        when(notificacaoDestinatarioService.resolver(10L))
                .thenReturn(new DestinatariosCanaisDto(List.of("+5562911110001"), List.of("a@b.com")));
        when(emailRenderer.montarAssunto(anyString(), anyString())).thenReturn("assunto");
        when(emailRenderer.renderCorpoHtml(anyString(), anyString(), anyList())).thenReturn("<p>x</p>");
        doThrow(new RuntimeException("gmail down")).when(notificacaoEmailService).enviar(any(), any(), any());

        assertThatCode(() -> service.dispararNotificacoes(
                        10L, 1L, "CNJ", "X", "mov", "desc", List.of(movimentacao("1", "leg"))))
                .doesNotThrowAnyException();

        verify(whatsAppSchedulerService).enfileirarAtualizacaoProcesso(anyString(), any(), any(), any(), any());
    }

    @Test
    void dispararNotificacoes_comDestinatarios_enfileiraUmWhatsAppPorNumero() {
        when(notificacaoDestinatarioService.resolver(10L))
                .thenReturn(new DestinatariosCanaisDto(
                        List.of("+5562911110001", "+5562911110002"), List.of()));

        service.dispararNotificacoes(
                10L, 5L, "5059346-36.2026.8.09.0007", "Maria", "Juntada", "desc", List.of(movimentacao("2", "Juntada")));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> paramsCaptor = ArgumentCaptor.forClass(List.class);
        verify(whatsAppSchedulerService, times(2))
                .enfileirarAtualizacaoProcesso(
                        anyString(), paramsCaptor.capture(), eq(5L), eq(10L), eq("desc"));
        assertThat(paramsCaptor.getAllValues().getFirst())
                .containsExactly("Maria", "5059346-36.2026.8.09.0007", "Juntada");
        verify(notificacaoEmailService, never()).enviar(any(), any(), any());
    }

    @Test
    void notificarNovidade_listaVazia_naoDispara() throws Exception {
        ProcessoEntity processo = processoComCliente();

        service.notificarNovidade(processo, List.of());

        verify(notificacaoDestinatarioService, never()).resolver(any());
        Thread.sleep(100);
        verify(whatsAppSchedulerService, never()).enfileirarAtualizacaoProcesso(any(), any(), any(), any(), any());
        verify(notificacaoEmailService, never()).enviar(any(), any(), any());
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
