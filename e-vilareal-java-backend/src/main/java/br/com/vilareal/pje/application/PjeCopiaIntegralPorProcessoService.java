package br.com.vilareal.pje.application;

import br.com.vilareal.pje.config.PjeTrt18EmailTriggerProperties;
import br.com.vilareal.pje.config.PjeTrt18Properties;
import br.com.vilareal.pje.domain.PjeGrau;
import br.com.vilareal.processo.application.ProcessoDiagnosticoNumeroBuscaUtil;
import br.com.vilareal.publicacao.application.PublicacaoDriveAndamentosService;
import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import br.com.vilareal.robot.RobotAutoFreio;
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
    private final PjeCopiaIntegralStatusStore statusStore;
    private final RobotAutoFreio autoFreio;
    private final PjeTrt18Properties pjeTrt18Properties;
    private final PjeCopiaIntegralFalhaEmailService falhaEmailService;
    private final ExecutorService executor;

    public PjeCopiaIntegralPorProcessoService(
            PjeTrt18EmailTriggerProperties trt18TriggerProperties,
            PjeCopiaIntegralOrchestrator copiaIntegralOrchestrator,
            PublicacaoDriveAndamentosService publicacaoDriveAndamentosService,
            PublicacaoRepository publicacaoRepository,
            CredencialTotpRepository credencialTotpRepository,
            PjeCopiaIntegralStatusStore statusStore,
            RobotAutoFreio autoFreio,
            PjeTrt18Properties pjeTrt18Properties,
            PjeCopiaIntegralFalhaEmailService falhaEmailService,
            @Qualifier("pjeEmailTriggerExecutor") ExecutorService executor) {
        this.trt18TriggerProperties = trt18TriggerProperties;
        this.copiaIntegralOrchestrator = copiaIntegralOrchestrator;
        this.publicacaoDriveAndamentosService = publicacaoDriveAndamentosService;
        this.publicacaoRepository = publicacaoRepository;
        this.credencialTotpRepository = credencialTotpRepository;
        this.statusStore = statusStore;
        this.autoFreio = autoFreio;
        this.pjeTrt18Properties = pjeTrt18Properties;
        this.falhaEmailService = falhaEmailService;
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
        statusStore.marcarEmAndamento(cnjNorm);
        Optional<String> login = resolverLogin();
        if (login.isEmpty()) {
            log.warn("PJe cópia integral CNJ {}: login não resolvido", cnjNorm);
            statusStore.registrarFalha(cnjNorm, "Login PJe TRT18 não configurado (cofre TOTP ou PJE_TRT18_LOGIN_PADRAO).");
            return Optional.empty();
        }
        Optional<PjeCopiaIntegralResult> resultado = executarComFallbackGrau(cnjNorm, login.get(), grauSalvo);
        if (resultado.isEmpty()) {
            log.warn("PJe cópia integral CNJ {}: robô global ocupado", cnjNorm);
            statusStore.registrarFalha(cnjNorm, "Robô PJe ocupado; tente novamente em alguns minutos.");
            return Optional.empty();
        }
        PjeCopiaIntegralResult r = resultado.get();
        statusStore.registrar(r);
        if (r.sucesso() && StringUtils.hasText(r.pastaMovimentacoesId())) {
            publicacaoDriveAndamentosService.tentarMarcarAndamentosNoDrivePorCnj(
                    cnjNorm, r.pastaMovimentacoesId(), 1);
        }
        if (!r.sucesso()) {
            log.warn("PJe cópia integral CNJ {}: {}", cnjNorm, r.mensagem());
            notificarFalhaDefinitivaSeAplicavel(r);
        } else {
            log.info(
                    "PJe cópia integral CNJ {}: arquivada (fileId={}, pasta={})",
                    cnjNorm,
                    r.driveFileId(),
                    r.pastaMovimentacoesId());
        }
        return resultado;
    }

    /** Valida login e auto-freio antes de enfileirar (evita toast «em execução» quando já vai falhar). */
    public Optional<String> validarDisparoAssincrono() {
        if (resolverLogin().isEmpty()) {
            return Optional.of(
                    "Login PJe TRT18 não configurado (cofre TOTP ou PJE_TRT18_LOGIN_PADRAO). "
                            + "Cadastre a credencial em Admin → TOTP.");
        }
        autoFreio.configurarLimite(pjeTrt18Properties.getAutoFreioLimiteErros());
        autoFreio.configurarCooldownMs(pjeTrt18Properties.getAutoFreioCooldownMs());
        if (autoFreio.estaFreiado()) {
            return Optional.of(
                    "Robô PJe TRT18 pausado após "
                            + autoFreio.errosConsecutivos()
                            + " falhas consecutivas. Ele volta sozinho em "
                            + autoFreio.esperaRestanteTexto()
                            + "; tente de novo depois disso.");
        }
        return Optional.empty();
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
        statusStore.marcarEmAndamento(cnjNorm);
        executor.execute(() -> {
            try {
                executarPorCnj(cnjNorm, grau);
            } catch (Exception e) {
                log.warn("PJe cópia integral assíncrona falhou (cnj={}): {}", cnjNorm, e.getMessage());
                statusStore.registrarFalha(cnjNorm, e.getMessage());
            }
        });
    }

    public Optional<PjeCopiaIntegralStatusStore.Entrada> consultarStatus(String cnj) {
        if (!StringUtils.hasText(cnj)) {
            return Optional.empty();
        }
        return statusStore.consultar(cnj.trim());
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
            String causaPrimeiroGrau = r.mensagem();
            log.info(
                    "PJe cópia integral CNJ {}: falha em 1º grau ({}), tentando 2º grau",
                    cnjNorm,
                    causaPrimeiroGrau);
            Optional<PjeCopiaIntegralResult> segundo =
                    copiaIntegralOrchestrator.executar(PjeGrau.SEGUNDO_GRAU, login, null, cnjNorm);
            if (segundo.isPresent() && segundo.get().sucesso()) {
                return segundo;
            }
            if (segundo.isPresent()) {
                return Optional.of(PjeCopiaIntegralResult.falha(
                        PjeGrau.SEGUNDO_GRAU,
                        cnjNorm,
                        causaPrimeiroGrau + " Tentativa em 2º grau: " + segundo.get().mensagem()));
            }
            return Optional.of(PjeCopiaIntegralResult.falha(PjeGrau.PRIMEIRO_GRAU, cnjNorm, causaPrimeiroGrau));
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

    private void notificarFalhaDefinitivaSeAplicavel(PjeCopiaIntegralResult resultado) {
        if (resultado == null || !StringUtils.hasText(resultado.mensagem())) {
            return;
        }
        if (!PjeCopiaIntegralRetrySupport.ehRetentavel(resultado.mensagem())) {
            return;
        }
        falhaEmailService.notificarFalhaDefinitiva(
                resultado.numeroCnj(),
                resultado.grau(),
                resultado.mensagem(),
                pjeTrt18Properties.getExecucaoMaxTentativas());
    }
}
