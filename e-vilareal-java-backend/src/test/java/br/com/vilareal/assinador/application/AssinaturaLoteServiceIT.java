package br.com.vilareal.assinador.application;

import br.com.vilareal.AbstractIntegrationTest;
import br.com.vilareal.assinador.domain.AssinaturaLoteStatus;
import br.com.vilareal.assinador.infrastructure.persistence.entity.AssinaturaLoteEntity;
import br.com.vilareal.assinador.infrastructure.persistence.repository.AssinaturaLoteRepository;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiCredencialEntity;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiCredencialRepository;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** MySQL via Testcontainers ({@link AbstractIntegrationTest}) — inclui teste de concorrência SKIP LOCKED. */
class AssinaturaLoteServiceIT extends AbstractIntegrationTest {

    @Autowired
    private AssinaturaLoteService service;

    @Autowired
    private AssinaturaLoteRepository repository;

    @Autowired
    private ProjudiCredencialRepository credencialRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private Long credencialId;

    @BeforeEach
    void credencialTeste() {
        ProjudiCredencialEntity credencial = new ProjudiCredencialEntity();
        credencial.setCpfUsuario("999" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
        credencial.setSenhaCifrada(new byte[] {1, 2, 3});
        credencial.setIv(new byte[] {9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2});
        credencialId = credencialRepository.save(credencial).getId();
    }

    @Test
    void criarLote_iniciaComStatusLiberado() {
        AssinaturaLoteEntity lote = service.criarLote(List.of(101L, 102L), credencialId);

        assertThat(lote.getId()).isNotNull();
        assertThat(lote.getStatus()).isEqualTo(AssinaturaLoteStatus.LIBERADO);
        assertThat(lote.getPeticaoIds()).containsExactly(101L, 102L);
        assertThat(lote.getCredencialId()).isEqualTo(credencialId);
    }

    @Test
    void pegarConcluirFalharEReliberar_fluxoCompleto() {
        AssinaturaLoteEntity criado = service.criarLote(List.of(201L), credencialId);

        Optional<AssinaturaLoteEntity> claim =
                service.pegarProximoLotePendente("assinador-teste-1");
        assertThat(claim).isPresent();
        assertThat(claim.get().getId()).isEqualTo(criado.getId());
        assertThat(claim.get().getStatus()).isEqualTo(AssinaturaLoteStatus.EM_ASSINATURA);
        assertThat(claim.get().getLockedBy()).isEqualTo("assinador-teste-1");
        assertThat(claim.get().getLockedAt()).isNotNull();

        assertThat(service.pegarProximoLotePendente("assinador-teste-2")).isEmpty();

        var resultado = JsonNodeFactory.instance.objectNode().put("pareadas", 1);
        AssinaturaLoteEntity concluido = service.concluirLote(criado.getId(), resultado);

        assertThat(concluido.getStatus()).isEqualTo(AssinaturaLoteStatus.CONCLUIDO);
        assertThat(concluido.getResultadoJson().get("pareadas").asInt()).isEqualTo(1);
        assertThat(concluido.getLockedBy()).isNull();

        AssinaturaLoteEntity loteFalha = service.criarLote(List.of(301L), credencialId);
        AssinaturaLoteEntity emAssinatura =
                service.pegarProximoLotePendente("assinador-teste-3").orElseThrow();
        AssinaturaLoteEntity comErro =
                service.falharLote(emAssinatura.getId(), "TOKEN_OCUPADO", "Token em uso pelo sai.jar");

        assertThat(comErro.getStatus()).isEqualTo(AssinaturaLoteStatus.ERRO);
        assertThat(comErro.getErroCodigo()).isEqualTo("TOKEN_OCUPADO");

        AssinaturaLoteEntity reliberado = service.reliberarLote(loteFalha.getId());

        assertThat(reliberado.getStatus()).isEqualTo(AssinaturaLoteStatus.LIBERADO);
        assertThat(reliberado.getErroCodigo()).isNull();

        Optional<AssinaturaLoteEntity> novoClaim =
                service.pegarProximoLotePendente("assinador-retry");
        assertThat(novoClaim).isPresent();
        assertThat(novoClaim.get().getId()).isEqualTo(loteFalha.getId());
    }

    @Test
    void reliberar_rejeitaSeNaoEstiverEmErro() {
        AssinaturaLoteEntity lote = service.criarLote(List.of(401L), credencialId);

        assertThatThrownBy(() -> service.reliberarLote(lote.getId()))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("reliberar");
    }

    @Test
    void pegarProximoLote_concorrencia_naoRetornaMesmoLoteDuasVezes() throws Exception {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        Long loteId = tx.execute(status -> service.criarLote(List.of(501L, 502L), credencialId).getId());

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Callable<Optional<Long>> claim = () -> {
                TransactionTemplate workerTx = new TransactionTemplate(transactionManager);
                return workerTx.execute(
                        s -> service.pegarProximoLotePendente("worker-" + Thread.currentThread().getId())
                                .map(AssinaturaLoteEntity::getId));
            };

            Future<Optional<Long>> f1 = executor.submit(claim);
            Future<Optional<Long>> f2 = executor.submit(claim);

            List<Optional<Long>> resultados = List.of(f1.get(), f2.get());
            List<Long> idsObtidos = new ArrayList<>();
            for (Optional<Long> r : resultados) {
                r.ifPresent(idsObtidos::add);
            }

            assertThat(idsObtidos).hasSize(1);
            assertThat(idsObtidos.get(0)).isEqualTo(loteId);

            AssinaturaLoteEntity persistido = repository.findById(loteId).orElseThrow();
            assertThat(persistido.getStatus()).isEqualTo(AssinaturaLoteStatus.EM_ASSINATURA);
        } finally {
            executor.shutdownNow();
        }
    }
}
