package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.ConversaClienteManualAcao;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppConversaClienteEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppConversaClienteManualEntity;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppConversaGrupoResolucaoServiceTest {

    private final WhatsAppConversaGrupoResolucaoService service =
            new WhatsAppConversaGrupoResolucaoService(null, null);

    @Test
    void incluirManualApareceMesmoSemAuto() {
        var efetivos = service.resolverEfetivosInterno(
                List.of(),
                List.of(manual("55119999", "00000010", "Terra Mundi", ConversaClienteManualAcao.INCLUIR)));

        assertThat(efetivos).hasSize(1);
        assertThat(efetivos.getFirst().codigo()).isEqualTo("00000010");
        assertThat(efetivos.getFirst().incluidoManual()).isTrue();
        assertThat(efetivos.getFirst().automatico()).isFalse();
    }

    @Test
    void excluirManualVenceAuto() {
        var efetivos = service.resolverEfetivosInterno(
                List.of(auto("55119999", "00000010", "Terra Mundi")),
                List.of(manual("55119999", "00000010", "Terra Mundi", ConversaClienteManualAcao.EXCLUIR)));

        assertThat(efetivos).isEmpty();
    }

    @Test
    void autoPermaneceSemManual() {
        var efetivos = service.resolverEfetivosInterno(
                List.of(auto("55119999", "00000010", "Terra Mundi")), List.of());

        assertThat(efetivos).hasSize(1);
        assertThat(efetivos.getFirst().automatico()).isTrue();
        assertThat(efetivos.getFirst().incluidoManual()).isFalse();
    }

    @Test
    void incluirManualAdicionaAlemDoAuto() {
        var efetivos = service.resolverEfetivosInterno(
                List.of(auto("55119999", "00000010", "Farol")),
                List.of(manual("55119999", "00000020", "Terra Mundi", ConversaClienteManualAcao.INCLUIR)));

        assertThat(efetivos).hasSize(2);
        assertThat(efetivos.stream().map(WhatsAppConversaGrupoResolucaoService.GrupoEfetivo::codigo))
                .containsExactlyInAnyOrder("00000010", "00000020");
    }

    private static WhatsAppConversaClienteEntity auto(String phone, String codigo, String nome) {
        WhatsAppConversaClienteEntity e = new WhatsAppConversaClienteEntity();
        e.setPhoneNumber(phone);
        e.setClienteCodigo(codigo);
        e.setClienteNome(nome);
        e.setAtualizadoEm(Instant.parse("2026-07-04T12:00:00Z"));
        return e;
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
