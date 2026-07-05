package br.com.vilareal.assinador.application;

import br.com.vilareal.assinador.domain.AssinaturaLoteStatus;
import br.com.vilareal.assinador.infrastructure.persistence.entity.AssinaturaLoteEntity;
import br.com.vilareal.assinador.infrastructure.persistence.repository.AssinaturaLoteRepository;
import br.com.vilareal.common.exception.BusinessRuleException;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssinaturaLoteServiceTest {

    private static final Instant AGORA = Instant.parse("2026-07-05T12:00:00Z");

    @Mock
    private AssinaturaLoteRepository repository;

    private AssinaturaLoteService service;

    @BeforeEach
    void setUp() {
        service = new AssinaturaLoteService(repository, Clock.fixed(AGORA, ZoneOffset.UTC));
    }

    @Test
    void criarLote_gravaStatusLiberado() {
        when(repository.save(any(AssinaturaLoteEntity.class))).thenAnswer(inv -> {
            AssinaturaLoteEntity e = inv.getArgument(0);
            e.setId(7L);
            return e;
        });

        AssinaturaLoteEntity lote = service.criarLote(List.of(10L, 11L), 99L);

        assertThat(lote.getId()).isEqualTo(7L);
        assertThat(lote.getStatus()).isEqualTo(AssinaturaLoteStatus.LIBERADO);
        assertThat(lote.getPeticaoIds()).containsExactly(10L, 11L);
        assertThat(lote.getCredencialId()).isEqualTo(99L);
    }

    @Test
    void criarLote_rejeitaListaVazia() {
        assertThatThrownBy(() -> service.criarLote(List.of(), 1L))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("peticaoIds");
    }

    @Test
    void pegarProximoLotePendente_claimComLock() {
        AssinaturaLoteEntity liberado = lote(1L, AssinaturaLoteStatus.LIBERADO);
        when(repository.findProximoLiberadoIdParaClaim()).thenReturn(Optional.of(1L));
        when(repository.findById(1L)).thenReturn(Optional.of(liberado));
        when(repository.save(any(AssinaturaLoteEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        Optional<AssinaturaLoteEntity> claim = service.pegarProximoLotePendente("win-assinador");

        assertThat(claim).isPresent();
        assertThat(claim.get().getStatus()).isEqualTo(AssinaturaLoteStatus.EM_ASSINATURA);
        assertThat(claim.get().getLockedBy()).isEqualTo("win-assinador");
        assertThat(claim.get().getLockedAt()).isEqualTo(AGORA);
    }

    @Test
    void pegarProximoLotePendente_vazioQuandoNaoHaLote() {
        when(repository.findProximoLiberadoIdParaClaim()).thenReturn(Optional.empty());

        assertThat(service.pegarProximoLotePendente("win-assinador")).isEmpty();
        verify(repository, never()).save(any());
    }

    @Test
    void concluirLote_gravaResultadoELimpaLock() {
        AssinaturaLoteEntity emAssinatura = lote(2L, AssinaturaLoteStatus.EM_ASSINATURA);
        emAssinatura.setLockedBy("worker");
        emAssinatura.setLockedAt(AGORA.minusSeconds(30));
        when(repository.findById(2L)).thenReturn(Optional.of(emAssinatura));
        when(repository.save(any(AssinaturaLoteEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        var resultado = JsonNodeFactory.instance.objectNode().put("pareadas", 3);
        AssinaturaLoteEntity concluido = service.concluirLote(2L, resultado);

        assertThat(concluido.getStatus()).isEqualTo(AssinaturaLoteStatus.CONCLUIDO);
        assertThat(concluido.getResultadoJson().get("pareadas").asInt()).isEqualTo(3);
        assertThat(concluido.getLockedBy()).isNull();
        assertThat(concluido.getLockedAt()).isNull();
    }

    @Test
    void falharLote_gravaErro() {
        AssinaturaLoteEntity emAssinatura = lote(3L, AssinaturaLoteStatus.EM_ASSINATURA);
        when(repository.findById(3L)).thenReturn(Optional.of(emAssinatura));
        when(repository.save(any(AssinaturaLoteEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        AssinaturaLoteEntity comErro = service.falharLote(
                3L, "TOKEN_OCUPADO", "Token em uso por outro programa. Feche o sai.jar e tente novamente.");

        assertThat(comErro.getStatus()).isEqualTo(AssinaturaLoteStatus.ERRO);
        assertThat(comErro.getErroCodigo()).isEqualTo("TOKEN_OCUPADO");
        assertThat(comErro.getErroMensagem()).contains("sai.jar");
    }

    @Test
    void reliberarLote_voltaParaLiberado() {
        AssinaturaLoteEntity comErro = lote(4L, AssinaturaLoteStatus.ERRO);
        comErro.setErroCodigo("TOKEN_OCUPADO");
        comErro.setErroMensagem("ocupado");
        when(repository.findById(4L)).thenReturn(Optional.of(comErro));
        when(repository.save(any(AssinaturaLoteEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        AssinaturaLoteEntity reliberado = service.reliberarLote(4L);

        assertThat(reliberado.getStatus()).isEqualTo(AssinaturaLoteStatus.LIBERADO);
        assertThat(reliberado.getErroCodigo()).isNull();
        assertThat(reliberado.getErroMensagem()).isNull();
    }

    @Test
    void reliberarLote_rejeitaStatusInvalido() {
        when(repository.findById(5L)).thenReturn(Optional.of(lote(5L, AssinaturaLoteStatus.LIBERADO)));

        assertThatThrownBy(() -> service.reliberarLote(5L))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("reliberar");
    }

    @Test
    void criarLote_deduplicaPeticaoIds() {
        ArgumentCaptor<AssinaturaLoteEntity> captor = ArgumentCaptor.forClass(AssinaturaLoteEntity.class);
        when(repository.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

        service.criarLote(List.of(1L, 1L, 2L), 3L);

        assertThat(captor.getValue().getPeticaoIds()).containsExactly(1L, 2L);
    }

    private static AssinaturaLoteEntity lote(long id, AssinaturaLoteStatus status) {
        AssinaturaLoteEntity entity = new AssinaturaLoteEntity();
        entity.setId(id);
        entity.setStatus(status);
        entity.setCredencialId(1L);
        entity.setPeticaoIds(List.of(100L));
        return entity;
    }
}
