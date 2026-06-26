package br.com.vilareal.projudi.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiPeticaoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjudiPeticaoAgendamentoServiceTest {

    private static final Instant AGORA = Instant.parse("2026-06-22T15:00:00Z");

    @Mock private ProjudiPeticaoRepository peticaoRepository;

    @InjectMocks private ProjudiPeticaoAgendamentoService service;

    @Test
    void agendarProtocolo_gravaHorarioQuandoAssinada() {
        service = new ProjudiPeticaoAgendamentoService(peticaoRepository, Clock.fixed(AGORA, ZoneOffset.UTC));
        ProjudiPeticaoEntity peticao = new ProjudiPeticaoEntity();
        peticao.setId(10L);
        peticao.setStatus(ProjudiPeticaoAssinaturaService.STATUS_PETICAO_ASSINADA);
        when(peticaoRepository.findById(10L)).thenReturn(Optional.of(peticao));

        Instant quando = AGORA.plusSeconds(3600);
        service.agendarProtocolo(10L, quando);

        verify(peticaoRepository).save(peticao);
        org.assertj.core.api.Assertions.assertThat(peticao.getProtocoloAgendadoPara()).isEqualTo(quando);
    }

    @Test
    void agendarProtocolo_rejeitaHorarioPassado() {
        service = new ProjudiPeticaoAgendamentoService(peticaoRepository, Clock.fixed(AGORA, ZoneOffset.UTC));
        assertThatThrownBy(() -> service.agendarProtocolo(1L, AGORA.minusSeconds(60)))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void cancelarAgendamento_limpaHorarioQuandoPermitido() {
        service = new ProjudiPeticaoAgendamentoService(peticaoRepository, Clock.fixed(AGORA, ZoneOffset.UTC));
        ProjudiPeticaoEntity peticao = new ProjudiPeticaoEntity();
        peticao.setId(10L);
        peticao.setStatus(ProjudiPeticaoAssinaturaService.STATUS_PETICAO_ASSINADA);
        peticao.setProtocoloAgendadoPara(AGORA.plusSeconds(3600));
        when(peticaoRepository.findById(10L)).thenReturn(Optional.of(peticao));
        when(peticaoRepository.cancelarAgendamentoSePermitido(10L)).thenReturn(1);

        service.cancelarAgendamento(10L);

        verify(peticaoRepository).cancelarAgendamentoSePermitido(10L);
    }

    @Test
    void cancelarAgendamento_rejeitaQuandoProtocoloJaConcluido() {
        service = new ProjudiPeticaoAgendamentoService(peticaoRepository, Clock.fixed(AGORA, ZoneOffset.UTC));
        ProjudiPeticaoEntity peticao = new ProjudiPeticaoEntity();
        peticao.setId(11L);
        peticao.setStatus(ProjudiPeticaoRegistroService.STATUS_PETICAO_PROTOCOLADA);
        peticao.setProtocoloAgendadoPara(AGORA.plusSeconds(60));
        when(peticaoRepository.findById(11L)).thenReturn(Optional.of(peticao));

        assertThatThrownBy(() -> service.cancelarAgendamento(11L))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("concluído");
    }

    @Test
    void cancelarAgendamento_rejeitaQuandoProtocoloEmAndamento() {
        service = new ProjudiPeticaoAgendamentoService(peticaoRepository, Clock.fixed(AGORA, ZoneOffset.UTC));
        ProjudiPeticaoEntity peticao = new ProjudiPeticaoEntity();
        peticao.setId(12L);
        peticao.setStatus(ProjudiPeticaoRegistroService.STATUS_PETICAO_PROTOCOLANDO);
        peticao.setProtocoloAgendadoPara(AGORA.minusSeconds(60));
        when(peticaoRepository.findById(12L)).thenReturn(Optional.of(peticao));

        assertThatThrownBy(() -> service.cancelarAgendamento(12L))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("em andamento");
    }
}
