package br.com.vilareal.assinador.application;

import br.com.vilareal.assinador.domain.AssinaturaLoteStatus;
import br.com.vilareal.assinador.infrastructure.persistence.entity.AssinaturaLoteEntity;
import br.com.vilareal.assinador.infrastructure.persistence.repository.AssinaturaLoteRepository;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Marca lotes {@link AssinaturaLoteStatus#PREPARANDO} há muito tempo como {@link AssinaturaLoteStatus#ERRO}
 * (ex.: race antes do commit, crash da JVM durante preparo).
 */
@Component
public class AssinaturaLotePreparoOrfaoScheduler {

    private static final Logger log = LoggerFactory.getLogger(AssinaturaLotePreparoOrfaoScheduler.class);

    private final AssinaturaLoteRepository repository;
    private final AssinaturaLoteService assinaturaLoteService;
    private final Clock clock;
    private final boolean ativo;
    private final Duration idadeMinima;

    public AssinaturaLotePreparoOrfaoScheduler(
            AssinaturaLoteRepository repository,
            AssinaturaLoteService assinaturaLoteService,
            Clock clock,
            @Value("${vilareal.assinatura.lote.preparo-orfao.ativo:true}") boolean ativo,
            @Value("${vilareal.assinatura.lote.preparo-orfao.idade-minutos:10}") int idadeMinutos) {
        this.repository = repository;
        this.assinaturaLoteService = assinaturaLoteService;
        this.clock = clock;
        this.ativo = ativo;
        this.idadeMinima = Duration.ofMinutes(Math.max(1, idadeMinutos));
    }

    @Scheduled(fixedDelayString = "${vilareal.assinatura.lote.preparo-orfao.intervalo-ms:120000}")
    @SchedulerLock(
            name = "assinatura-lote-preparo-orfao",
            lockAtMostFor = "PT5M",
            lockAtLeastFor = "PT30S")
    public void marcarPreparandoOrfaos() {
        if (!ativo) {
            return;
        }
        Instant limite = clock.instant().minus(idadeMinima);
        List<AssinaturaLoteEntity> orfaos =
                repository.findByStatusAndCriadoEmBefore(AssinaturaLoteStatus.PREPARANDO, limite);
        if (orfaos.isEmpty()) {
            return;
        }
        log.warn(
                "Assinatura lote: {} lote(s) PREPARANDO há mais de {} min — marcando ERRO",
                orfaos.size(),
                idadeMinima.toMinutes());
        for (AssinaturaLoteEntity lote : orfaos) {
            try {
                assinaturaLoteService.falharPreparacao(
                        lote.getId(),
                        "PREPARO_ORFAO",
                        "Preparo não concluiu em "
                                + idadeMinima.toMinutes()
                                + " min (lote preso em PREPARANDO). Tente «Assinar automaticamente» de novo.");
            } catch (Exception e) {
                log.warn("Assinatura lote: falha ao marcar órfão #{}: {}", lote.getId(), e.getMessage());
            }
        }
    }
}
