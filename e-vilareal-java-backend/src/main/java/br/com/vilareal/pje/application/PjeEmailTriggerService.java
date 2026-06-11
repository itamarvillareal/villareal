package br.com.vilareal.pje.application;

import br.com.vilareal.pje.config.PjeEmailTriggerProperties;
import br.com.vilareal.pje.config.PjeTrt18EmailTriggerProperties;
import br.com.vilareal.pje.infrastructure.browser.PjeTrt18CnjUtil;
import br.com.vilareal.processo.application.ProcessoDiagnosticoNumeroBuscaUtil;
import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Dispara o robô PJe TRT18 após importação de e-mail TRT com vínculo automático por CNJ.
 */
@Service
public class PjeEmailTriggerService {

    private static final Logger log = LoggerFactory.getLogger(PjeEmailTriggerService.class);

    private final PjeEmailTriggerProperties triggerProperties;
    private final PjeTrt18EmailTriggerProperties trt18TriggerProperties;
    private final PjeCopiaIntegralPorProcessoService copiaIntegralPorProcessoService;
    private final PublicacaoRepository publicacaoRepository;

    public PjeEmailTriggerService(
            PjeEmailTriggerProperties triggerProperties,
            PjeTrt18EmailTriggerProperties trt18TriggerProperties,
            PjeCopiaIntegralPorProcessoService copiaIntegralPorProcessoService,
            PublicacaoRepository publicacaoRepository) {
        this.triggerProperties = triggerProperties;
        this.trt18TriggerProperties = trt18TriggerProperties;
        this.copiaIntegralPorProcessoService = copiaIntegralPorProcessoService;
        this.publicacaoRepository = publicacaoRepository;
    }

    public void registrarCnjParaDisparo(Set<String> cnjs, String cnj) {
        if (!triggerProperties.isEnabled() || cnj == null || cnj.isBlank()) {
            return;
        }
        if (!PjeTrt18CnjUtil.cnjEhTrt18(cnj)) {
            return;
        }
        cnjs.add(cnj.trim().toUpperCase());
    }

    public void agendarDisparoAssincrono(Set<String> cnjs) {
        if (!triggerProperties.isEnabled() || cnjs == null || cnjs.isEmpty()) {
            return;
        }
        Set<String> batch = Set.copyOf(cnjs);
        log.info("Disparo PJe TRT18 por e-mail: {} CNJ(s) distintos", batch.size());
        for (String cnj : batch) {
            if (devePularPorThrottle(cnj)) {
                log.info("Disparo PJe por e-mail CNJ {}: throttle ativo (min-intervalo-min={})", cnj,
                        trt18TriggerProperties.getCopiaIntegralMinIntervaloMin());
                continue;
            }
            copiaIntegralPorProcessoService.dispararAssincrono(cnj);
        }
    }

    private boolean devePularPorThrottle(String cnj) {
        int minutos = trt18TriggerProperties.getCopiaIntegralMinIntervaloMin();
        if (minutos <= 0) {
            return false;
        }
        String norm = ProcessoDiagnosticoNumeroBuscaUtil.normalizarSomenteDigitos(cnj);
        if (norm.length() < 20) {
            return false;
        }
        Optional<LocalDateTime> ultima = publicacaoRepository.findImportadasPorEmailPorCnjNormalizado(norm).stream()
                .filter(PublicacaoEntity::isAndamentosNoDrive)
                .map(PublicacaoEntity::getAndamentosNoDriveEm)
                .filter(Objects::nonNull)
                .max(LocalDateTime::compareTo);
        return ultima.filter(t -> t.plusMinutes(minutos).isAfter(LocalDateTime.now())).isPresent();
    }
}
