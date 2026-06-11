package br.com.vilareal.processo.application;

import br.com.vilareal.email.EmailImportacaoSyncTipo;
import br.com.vilareal.pje.infrastructure.browser.PjeTrt18CnjUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.Objects;

/**
 * Tramitação dos autos ({@code processo.tramitacao}) — valores canônicos da UI.
 */
@Service
public class ProcessoTramitacaoService {

    private static final Logger log = LoggerFactory.getLogger(ProcessoTramitacaoService.class);

    public static final String TRAMITACAO_PROJUDI = "Projudi";
    public static final String TRAMITACAO_PJE = "PJe";
    public static final String TRAMITACAO_AUTOS_FISICOS = "TJ Go - Autos Físicos";

    private final ProcessoRepository processoRepository;

    public ProcessoTramitacaoService(ProcessoRepository processoRepository) {
        this.processoRepository = processoRepository;
    }

    /** E-mail autoritativo — sobrepõe tramitação atual (inclusive Autos Físicos). Não-fatal. */
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void definirPorFonteEmail(Long processoId, EmailImportacaoSyncTipo fonte, String cnj) {
        try {
            String alvo = resolverAlvoPorFonte(fonte, cnj);
            if (alvo == null) {
                return;
            }
            gravarSeMudou(processoId, alvo);
        } catch (Exception e) {
            log.warn(
                    "Falha ao definir tramitação por e-mail (processoId={}, fonte={}): {}",
                    processoId,
                    fonte,
                    e.getMessage());
        }
    }

    /** Inferência por CNJ — só preenche se tramitação estiver vazia. Não-fatal. */
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void preencherSeVazioPorCnj(Long processoId, String cnj) {
        try {
            ProcessoEntity processo = processoRepository.findById(processoId).orElse(null);
            if (processo == null || StringUtils.hasText(processo.getTramitacao())) {
                return;
            }
            String alvo = resolverAlvoPorCnj(cnj);
            if (alvo == null) {
                return;
            }
            gravarSeMudou(processoId, alvo);
        } catch (Exception e) {
            log.warn(
                    "Falha ao inferir tramitação por CNJ (processoId={}, cnj={}): {}",
                    processoId,
                    cnj,
                    e.getMessage());
        }
    }

    public static String normalizarTramitacao(String valor) {
        if (!StringUtils.hasText(valor)) {
            return null;
        }
        String t = valor.trim();
        String lower = t.toLowerCase(Locale.ROOT);
        if (TRAMITACAO_PROJUDI.equalsIgnoreCase(t) || "projudi".equals(lower)) {
            return TRAMITACAO_PROJUDI;
        }
        if (TRAMITACAO_PJE.equalsIgnoreCase(t) || "pje".equals(lower)) {
            return TRAMITACAO_PJE;
        }
        if (TRAMITACAO_AUTOS_FISICOS.equalsIgnoreCase(t)
                || "tj go - autos fisicos".equals(lower)
                || "tj go - autos físicos".equals(lower)) {
            return TRAMITACAO_AUTOS_FISICOS;
        }
        return t;
    }

    public static boolean ehProjudi(String tramitacaoNormalizada) {
        return TRAMITACAO_PROJUDI.equals(tramitacaoNormalizada);
    }

    public static boolean ehPje(String tramitacaoNormalizada) {
        return TRAMITACAO_PJE.equals(tramitacaoNormalizada);
    }

    public static boolean semSistemaDigital(String tramitacaoNormalizada) {
        return tramitacaoNormalizada == null || TRAMITACAO_AUTOS_FISICOS.equals(tramitacaoNormalizada);
    }

    /** Inferência por CNJ (monitoramento Jusbrasil) — não grava. */
    public static String inferirTramitacaoPorCnj(String cnj) {
        return resolverAlvoPorCnj(cnj);
    }

    /**
     * Grava tramitação canônica somente se o processo estiver vazio.
     *
     * @return {@code true} se gravou (ou {@code dryRun} e teria gravado)
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public boolean preencherTramitacaoSeVazio(Long processoId, String alvo, boolean dryRun) {
        if (!StringUtils.hasText(alvo)) {
            return false;
        }
        ProcessoEntity processo = processoRepository.findById(processoId).orElse(null);
        if (processo == null || StringUtils.hasText(processo.getTramitacao())) {
            return false;
        }
        if (dryRun) {
            return true;
        }
        gravarSeMudou(processoId, alvo);
        return true;
    }

    private static String resolverAlvoPorFonte(EmailImportacaoSyncTipo fonte, String cnj) {
        if (fonte == EmailImportacaoSyncTipo.PROJUDI) {
            return TRAMITACAO_PROJUDI;
        }
        if (fonte == EmailImportacaoSyncTipo.TRT && cnjEhTrt18(cnj)) {
            return TRAMITACAO_PJE;
        }
        return null;
    }

    private static String resolverAlvoPorCnj(String cnj) {
        if (cnjEhTjgo(cnj)) {
            return TRAMITACAO_PROJUDI;
        }
        if (cnjEhTrt18(cnj)) {
            return TRAMITACAO_PJE;
        }
        return null;
    }

    static boolean cnjEhTrt18(String cnj) {
        return PjeTrt18CnjUtil.cnjEhTrt18(cnj);
    }

    static boolean cnjEhTjgo(String cnj) {
        if (cnj == null || cnj.isBlank()) {
            return false;
        }
        return cnj.trim().toUpperCase(Locale.ROOT).contains(".8.09.");
    }

    private void gravarSeMudou(Long processoId, String alvo) {
        ProcessoEntity processo =
                processoRepository.findById(processoId).orElseThrow();
        String atual = processo.getTramitacao();
        if (Objects.equals(normalizarTramitacao(atual), alvo) || Objects.equals(trim(atual), alvo)) {
            return;
        }
        processo.setTramitacao(alvo);
        processoRepository.save(processo);
        log.info("Tramitação atualizada: processoId={} -> {}", processoId, alvo);
    }

    private static String trim(String s) {
        return s == null ? null : s.trim();
    }
}
