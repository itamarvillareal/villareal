package br.com.vilareal.notificacao.application;

import br.com.vilareal.notificacao.api.dto.DestinatariosCanaisDto;
import br.com.vilareal.notificacao.domain.CanalNotificacao;
import br.com.vilareal.notificacao.infrastructure.persistence.entity.NotificacaoDestinatarioEntity;
import br.com.vilareal.notificacao.infrastructure.persistence.repository.NotificacaoDestinatarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificacaoDestinatarioServiceTest {

    @Mock
    private NotificacaoDestinatarioRepository repository;

    private NotificacaoDestinatarioService service;

    @BeforeEach
    void setUp() {
        service = new NotificacaoDestinatarioService(repository);
    }

    @Test
    void resolver_apenasPadrao_efetivoIgualPadrao() {
        when(repository.findByProcessoIdIsNullAndAtivoTrue())
                .thenReturn(List.of(
                        linha(null, CanalNotificacao.WHATSAPP, "+5562911110001", 1L),
                        linha(null, CanalNotificacao.EMAIL, "escritorio@vilareal.com", 2L)));
        when(repository.findByProcessoIdAndAtivoTrue(10L)).thenReturn(List.of());

        DestinatariosCanaisDto efetivo = service.resolver(10L);

        assertThat(efetivo.whatsapp()).containsExactly("+5562911110001");
        assertThat(efetivo.email()).containsExactly("escritorio@vilareal.com");
    }

    @Test
    void resolver_uniaoPadraoEAdicionais_deduplicaEMantemOrdem() {
        when(repository.findByProcessoIdIsNullAndAtivoTrue())
                .thenReturn(List.of(
                        linha(null, CanalNotificacao.EMAIL, "padrao@vilareal.com", 1L),
                        linha(null, CanalNotificacao.EMAIL, "jr.villareal@gmail.com", 2L),
                        linha(null, CanalNotificacao.WHATSAPP, "+5562911110001", 3L)));
        when(repository.findByProcessoIdAndAtivoTrue(10L))
                .thenReturn(List.of(
                        linha(10L, CanalNotificacao.EMAIL, "jr.villareal@gmail.com", 4L),
                        linha(10L, CanalNotificacao.EMAIL, "extra@processo.com", 5L)));

        DestinatariosCanaisDto efetivo = service.resolver(10L);

        assertThat(efetivo.email())
                .containsExactly("padrao@vilareal.com", "jr.villareal@gmail.com", "extra@processo.com");
        assertThat(efetivo.whatsapp()).containsExactly("+5562911110001");
    }

    @Test
    void resolver_adicionaisSomenteEmail_whatsappSoPadrao() {
        when(repository.findByProcessoIdIsNullAndAtivoTrue())
                .thenReturn(List.of(linha(null, CanalNotificacao.WHATSAPP, "+5562911110001", 1L)));
        when(repository.findByProcessoIdAndAtivoTrue(10L))
                .thenReturn(List.of(linha(10L, CanalNotificacao.EMAIL, "adicional@test.com", 2L)));

        DestinatariosCanaisDto efetivo = service.resolver(10L);

        assertThat(efetivo.whatsapp()).containsExactly("+5562911110001");
        assertThat(efetivo.email()).containsExactly("adicional@test.com");
    }

    @Test
    void resolver_processoIdNull_retornaApenasPadrao() {
        when(repository.findByProcessoIdIsNullAndAtivoTrue())
                .thenReturn(List.of(linha(null, CanalNotificacao.EMAIL, "a@b.com", 1L)));

        DestinatariosCanaisDto efetivo = service.resolver(null);

        assertThat(efetivo.whatsapp()).isEmpty();
        assertThat(efetivo.email()).containsExactly("a@b.com");
    }

    private static NotificacaoDestinatarioEntity linha(
            Long processoId, CanalNotificacao canal, String valor, Long id) {
        NotificacaoDestinatarioEntity e = new NotificacaoDestinatarioEntity();
        e.setId(id);
        e.setCanal(canal);
        e.setValor(valor);
        e.setAtivo(true);
        if (processoId != null) {
            br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity p =
                    new br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity();
            p.setId(processoId);
            e.setProcesso(p);
        }
        return e;
    }
}
