package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.ConversaClienteManualAcao;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppConversaClienteManualEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversaClienteManualRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppConversaGrupoResolucaoServiceTest {

    @Mock
    private WhatsAppConversaClienteManualRepository manualRepository;

    @InjectMocks
    private WhatsAppConversaGrupoResolucaoService service;

    @Test
    void incluirManualApareceNaLista() {
        when(manualRepository.findByPhoneNumber("5511999999999"))
                .thenReturn(List.of(manual("5511999999999", "00000010", "Terra Mundi", ConversaClienteManualAcao.INCLUIR)));

        var grupos = service.listarGruposEfetivosDaConversa("5511999999999");

        assertThat(grupos).hasSize(1);
        assertThat(grupos.getFirst().codigo()).isEqualTo("00000010");
        assertThat(grupos.getFirst().incluidoManual()).isTrue();
        assertThat(grupos.getFirst().automatico()).isFalse();
    }

    @Test
    void excluirManualNaoAparece() {
        when(manualRepository.findByPhoneNumber("5511999999999"))
                .thenReturn(List.of(manual("5511999999999", "00000010", "Terra Mundi", ConversaClienteManualAcao.EXCLUIR)));

        var grupos = service.listarGruposEfetivosDaConversa("5511999999999");

        assertThat(grupos).isEmpty();
    }

    private static WhatsAppConversaClienteManualEntity manual(
            String phone, String codigo, String nome, ConversaClienteManualAcao acao) {
        WhatsAppConversaClienteManualEntity e = new WhatsAppConversaClienteManualEntity();
        e.setPhoneNumber(phone);
        e.setClienteCodigo(codigo);
        e.setClienteNome(nome);
        e.setAcao(acao);
        e.setCriadoPor("test");
        e.setCriadoEm(Instant.parse("2026-07-04T12:00:00Z"));
        return e;
    }
}
