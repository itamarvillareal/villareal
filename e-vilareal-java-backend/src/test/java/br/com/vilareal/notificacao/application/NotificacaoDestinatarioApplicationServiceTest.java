package br.com.vilareal.notificacao.application;

import br.com.vilareal.notificacao.api.dto.DestinatariosCanaisDto;
import br.com.vilareal.notificacao.api.dto.DestinatariosCanaisRequest;
import br.com.vilareal.notificacao.api.dto.ProcessoDestinatariosResponse;
import br.com.vilareal.notificacao.infrastructure.persistence.repository.NotificacaoDestinatarioRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificacaoDestinatarioApplicationServiceTest {

    @Mock
    private NotificacaoDestinatarioRepository notificacaoDestinatarioRepository;

    @Mock
    private NotificacaoDestinatarioService notificacaoDestinatarioService;

    @Mock
    private ProcessoRepository processoRepository;

    private NotificacaoDestinatarioApplicationService applicationService;

    @BeforeEach
    void setUp() {
        applicationService = new NotificacaoDestinatarioApplicationService(
                notificacaoDestinatarioRepository, notificacaoDestinatarioService, processoRepository);
    }

    @Test
    void removerOverrideProcesso_deletaLinhasDoProcesso() {
        when(processoRepository.existsById(10L)).thenReturn(true);
        when(notificacaoDestinatarioService.listarOverrideAtivo(10L))
                .thenReturn(DestinatariosCanaisDto.vazio());
        when(notificacaoDestinatarioService.processoTemOverride(10L)).thenReturn(false);
        when(notificacaoDestinatarioService.resolver(10L))
                .thenReturn(new DestinatariosCanaisDto(List.of("+5562911110001"), List.of("p@x.com")));

        ProcessoDestinatariosResponse resp = applicationService.removerOverrideProcesso(10L);

        verify(notificacaoDestinatarioRepository).deleteByProcessoId(10L);
        assertThat(resp.personalizado()).isFalse();
        assertThat(resp.efetivo().whatsapp()).containsExactly("+5562911110001");
    }
}
