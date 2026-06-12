package br.com.vilareal.pje.application;

import br.com.vilareal.pje.config.PjeTrt18EmailTriggerProperties;
import br.com.vilareal.pje.domain.PjeGrau;
import br.com.vilareal.processo.application.ProcessoDiagnosticoNumeroBuscaUtil;
import br.com.vilareal.publicacao.application.PublicacaoDriveAndamentosService;
import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import br.com.vilareal.totp.domain.TribunalIntegracao;
import br.com.vilareal.totp.infrastructure.persistence.entity.CredencialTotpEntity;
import br.com.vilareal.totp.infrastructure.persistence.repository.CredencialTotpRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutorService;

/**
 * Cópia integral PJe TRT18 por CNJ — uso síncrono (interno) e assíncrono (e-mail / botão UI).
 */
@Service
public class PjeCopiaIntegralPorProcessoService {

    private static final Logger log = LoggerFactory.getLogger(PjeCopiaIntegralPorProcessoService.class);

    private static final TribunalIntegracao TRIBUNAL = TribunalIntegracao.PJE_TRT18;

    private final PjeTrt18EmailTriggerProperties trt18TriggerProperties;
    private final PjeCopiaIntegralOrchestrator copiaIntegralOrchestrator;
    private final PublicacaoDriveAndamentosService publicacaoDriveAndamentosService;
    private final PublicacaoRepository publicacaoRepository;
    private final CredencialTotpRepository credencialTotpRepository;
    private final ExecutorService executor;

    public PjeCopiaIntegralPorProcessoService(
            PjeTrt18EmailTriggerProperties trt18TriggerProperties,
            PjeCopiaIntegralOrchestrator copiaIntegralOrchestrator,
            PublicacaoDriveAndamentosService publicacaoDriveAndamentosService,
            PublicacaoRepository publicacaoRepository,
            CredencialTotpRepository credencialTotpRepository,
            @Qualifier("pjeEmailTriggerExecutor") ExecutorService executor) {
        this.trt18TriggerProperties = trt18TriggerProperties;
        this.copiaIntegralOrchestrator = copiaIntegralOrchestrator;
        this.publicacaoDriveAndamentosService = publicacaoDriveAndamentosService;
        this.publicacaoRepository = publicacaoRepository;
        this.credencialTotpRepository = credencialTotpRepository;
        this.executor = executor;
    }

    /** Síncrono: login do cofre, cópia integral, selo No Drive. */
    public Optional<PjeCopiaIntegralResult> executarPorCnj(String cnj) {
        return executarPorCnj(cnj, null);
    }

    /** Síncrono com grau explícito do processo (prioridade sobre inferência automática). */
    public Optional<PjeCopiaIntegralResult> executarPorCnj(String cnj, PjeGrau grauSalvo) {
        if (!StringUtils.hasText(cnj)) {
            log.warn("PJe cópia integral: CNJ vazio");
            return Optional.empty();
        }
        String cnjNorm = cnj.trim();
        Optional<String> login = resolverLogin();
        if (login.isEmpty()) {
            log.warn("PJe cópia integral CNJ {}: login não resolvido", cnjNorm);
            return Optional.empty();
        }
        Optional<PjeCopiaIntegralResult> resultado = executarComFallbackGrau(cnjNorm, login.get(), grauSalvo);
        if (resultado.isEmpty()) {
            log.warn("PJe cópia integral CNJ {}: robô global ocupado", cnjNorm);
            return Optional.empty();
        }
        PjeCopiaIntegralResult r = resultado.get();
        if (r.sucesso() && StringUtils.hasText(r.pastaMovimentacoesId())) {
            publicacaoDriveAndamentosService.tentarMarcarAndamentosNoDrivePorCnj(
                    cnjNorm, r.pastaMovimentacoesId(), 1);
        }
        if (!r.sucesso()) {
            log.warn("PJe cópia integral CNJ {}: {}", cnjNorm, r.mensagem());
        } else {
            log.info(
                    "PJe cópia integral CNJ {}: arquivada (fileId={}, pasta={})",
                    cnjNorm,
                    r.driveFileId(),
                    r.pastaMovimentacoesId());
        }
        return resultado;
    }

    /** Enfileira na thread única PJe; não-fatal. */
    public void dispararAssincrono(String cnj) {
        dispararAssincrono(cnj, null);
    }

    /** Enfileira com grau salvo no processo (sem fallback 1º→2º quando explícito). */
    public void dispararAssincrono(String cnj, PjeGrau grauSalvo) {
        if (!StringUtils.hasText(cnj)) {
            return;
        }
        String cnjNorm = cnj.trim();
        PjeGrau grau = grauSalvo;
        executor.execute(() -> {
            try {
                executarPorCnj(cnjNorm, grau);
            } catch (Exception e) {
                log.warn("PJe cópia integral assíncrona falhou (cnj={}): {}", cnjNorm, e.getMessage());
            }
        });
    }

    Optional<String> resolverLogin() {
        if (StringUtils.hasText(trt18TriggerProperties.getLoginPadrao())) {
            return Optional.of(trt18TriggerProperties.getLoginPadrao().trim());
        }
        List<CredencialTotpEntity> ativas = credencialTotpRepository.findAllByTribunalAndAtivoTrue(TRIBUNAL);
        if (ativas.size() != 1) {
            log.warn("PJe: esperada 1 credencial ativa PJE_TRT18, encontradas {}", ativas.size());
            return Optional.empty();
        }
        return Optional.of(ativas.getFirst().getLogin());
    }

    private Optional<PjeCopiaIntegralResult> executarComFallbackGrau(
            String cnjNorm, String login, PjeGrau grauSalvo) {
        PjeGrau grau = grauSalvo != null ? grauSalvo : resolverGrau(cnjNorm);
        Optional<PjeCopiaIntegralResult> resultado =
                copiaIntegralOrchestrator.executar(grau, login, null, cnjNorm);
        if (resultado.isEmpty()) {
            return Optional.empty();
        }
        PjeCopiaIntegralResult r = resultado.get();
        if (grauSalvo == null && !r.sucesso() && grau == PjeGrau.PRIMEIRO_GRAU) {
            log.info("PJe cópia integral CNJ {}: falha em 1º grau ({}), tentando 2º grau", cnjNorm, r.mensagem());
            Optional<PjeCopiaIntegralResult> segundo =
                    copiaIntegralOrchestrator.executar(PjeGrau.SEGUNDO_GRAU, login, null, cnjNorm);
            if (segundo.isPresent()) {
                return segundo;
            }
        }
        return resultado;
    }

    PjeGrau resolverGrau(String cnj) {
        PjeGrau padrao = trt18TriggerProperties.getGrauPadrao();
        String norm = ProcessoDiagnosticoNumeroBuscaUtil.normalizarSomenteDigitos(cnj);
        if (norm.length() < 20) {
            return padrao;
        }
        List<PublicacaoEntity> recentes = publicacaoRepository.findPublicacoesTrtPorCnjNormalizado(
                norm, PageRequest.of(0, 1));
        if (recentes.isEmpty()) {
            return padrao;
        }
        return PjeEmailTriggerGrauResolver.resolver(recentes.getFirst().getJsonReferencia(), padrao);
    }
}
