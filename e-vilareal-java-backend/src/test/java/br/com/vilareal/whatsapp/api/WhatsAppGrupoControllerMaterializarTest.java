package br.com.vilareal.whatsapp.api;

import br.com.vilareal.whatsapp.dto.WhatsAppGrupoMaterializacaoEmAndamentoResponse;
import br.com.vilareal.whatsapp.dto.WhatsAppGrupoMaterializacaoResultDTO;
import br.com.vilareal.whatsapp.service.WhatsAppGrupoListService;
import br.com.vilareal.whatsapp.service.WhatsAppGrupoMaterializacaoLockService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppGrupoControllerMaterializarTest {

    @Mock
    private WhatsAppGrupoMaterializacaoLockService materializacaoLockService;

    @Mock
    private WhatsAppGrupoListService grupoListService;

    @InjectMocks
    private WhatsAppGrupoController controller;

    @Test
    void materializarAgora_lockTomado_retorna409EmAndamento() {
        when(materializacaoLockService.executarRodadaComLock()).thenReturn(Optional.empty());

        ResponseEntity<?> response = controller.materializarAgora();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).isInstanceOf(WhatsAppGrupoMaterializacaoEmAndamentoResponse.class);
        assertThat(((WhatsAppGrupoMaterializacaoEmAndamentoResponse) response.getBody()).mensagem())
                .contains("Materialização já em andamento");
        verify(materializacaoLockService).executarRodadaComLock();
    }

    @Test
    void materializarAgora_lockLivre_retorna200ComResultado() {
        WhatsAppGrupoMaterializacaoResultDTO dto = new WhatsAppGrupoMaterializacaoResultDTO(3, 2, 50L);
        when(materializacaoLockService.executarRodadaComLock()).thenReturn(Optional.of(dto));

        ResponseEntity<?> response = controller.materializarAgora();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(dto);
    }
}
