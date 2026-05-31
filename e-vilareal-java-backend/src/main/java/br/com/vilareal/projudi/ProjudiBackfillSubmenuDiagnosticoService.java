package br.com.vilareal.projudi;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** TEMP — backfill progressivo Drive: Movimentações Email (PROJUDI) e Publicações Email TJGO (MONITORAMENTO). */
@Service
public class ProjudiBackfillSubmenuDiagnosticoService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiBackfillSubmenuDiagnosticoService.class);
    private static final int ERROS_CONSECUTIVOS_LIMITE = 3;

    private final ProjudiOrquestradorService orquestradorService;
    private final ProjudiOrquestradorGate orquestradorGate;
    private final ProjudiSessionService sessionService;
    private final PublicacaoRepository publicacaoRepository;
    private final ProcessoRepository processoRepository;
    private final Long credencialIdPadrao;

    public ProjudiBackfillSubmenuDiagnosticoService(
            ProjudiOrquestradorService orquestradorService,
            ProjudiOrquestradorGate orquestradorGate,
            ProjudiSessionService sessionService,
            PublicacaoRepository publicacaoRepository,
            ProcessoRepository processoRepository,
            @Value("${projudi.orquestrador.credencial-id-padrao:1}") Long credencialIdPadrao) {
        this.orquestradorService = orquestradorService;
        this.orquestradorGate = orquestradorGate;
        this.sessionService = sessionService;
        this.publicacaoRepository = publicacaoRepository;
        this.processoRepository = processoRepository;
        this.credencialIdPadrao = credencialIdPadrao;
    }

    public Map<String, Object> executarBackfillSubmenu(
            int limiteProcessos, int delaySegundos, boolean incluirMonitoramentoTjgo) {
        return orquestradorGate
                .tryExecutarComRetorno(
                        "backfill-submenu",
                        () -> executarBackfillSubmenuInterno(limiteProcessos, delaySegundos, incluirMonitoramentoTjgo))
                .orElseGet(() -> {
                    Map<String, Object> out = new LinkedHashMap<>();
                    out.put("erro", "robô PROJUDI ocupado; tente novamente.");
                    return out;
                });
    }

    private Map<String, Object> executarBackfillSubmenuInterno(
            int limiteProcessos, int delaySegundos, boolean incluirMonitoramentoTjgo) {
        Instant inicio = Instant.now();
        long inicioMs = System.currentTimeMillis();

        int limite = limiteProcessos > 0 ? limiteProcessos : 3;
        int delay = delaySegundos >= 0 ? delaySegundos : 30;

        List<Long> idsProjudi = publicacaoRepository.findDistinctProcessoIdsComPublicacaoProjudiCnjCompleto();
        List<Long> idsMonitoramentoTjgo = incluirMonitoramentoTjgo
                ? publicacaoRepository.findDistinctProcessoIdsComPublicacaoMonitoramentoTjgoCnjCompleto()
                : List.of();
        List<Long> todosIds = incluirMonitoramentoTjgo
                ? publicacaoRepository.findDistinctProcessoIdsElegiveisRoboProjudi()
                : idsProjudi;
        List<Long> processoIds = todosIds.stream().limit(limite).toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("inicio", inicio.toString());
        out.put("credencialId", credencialIdPadrao);
        out.put("limiteProcessos", limite);
        out.put("delaySegundos", delay);
        out.put("incluirMonitoramentoTjgo", incluirMonitoramentoTjgo);
        out.put("processosElegiveisTotal", todosIds.size());
        out.put("processosNestRodada", processoIds.size());
        Map<String, Object> elegiveisPorOrigem = new LinkedHashMap<>();
        elegiveisPorOrigem.put("projudi", idsProjudi.size());
        elegiveisPorOrigem.put("monitoramentoTjgo", idsMonitoramentoTjgo.size());
        elegiveisPorOrigem.put("totalDistinto", todosIds.size());
        out.put("elegiveisPorOrigem", elegiveisPorOrigem);

        List<Map<String, Object>> porProcesso = new ArrayList<>();
        List<String> detalhesGlobais = new ArrayList<>();
        int errosConsecutivos = 0;
        String motivoParada = null;
        boolean parar = false;

        try {
            sessionService.getSessao(credencialIdPadrao);
            detalhesGlobais.add("Sessão PROJUDI aquecida (credencialId=" + credencialIdPadrao + ").");
        } catch (Exception e) {
            log.warn("Falha ao aquecer sessão PROJUDI: {}", e.getMessage());
            detalhesGlobais.add("AVISO aquecimento sessão: " + ProjudiOrquestradorErroUtil.mensagemResumida(e));
        }

        for (int i = 0; i < processoIds.size() && !parar; i++) {
            Long processoId = processoIds.get(i);
            ProcessoEntity processo = processoRepository
                    .findByIdWithClienteAndPessoa(processoId)
                    .orElse(null);
            if (processo == null) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("processoId", processoId);
                item.put("cnj", null);
                item.put("arquivosBaixados", 0);
                item.put("jaArquivados", 0);
                item.put("duracaoMs", 0L);
                item.put("erro", "Processo não encontrado: " + processoId);
                porProcesso.add(item);
                errosConsecutivos++;
                if (errosConsecutivos >= ERROS_CONSECUTIVOS_LIMITE) {
                    motivoParada = "3 erros consecutivos (processo ausente).";
                    parar = true;
                }
                continue;
            }

            List<String> detalhesProcesso = new ArrayList<>();
            ProjudiOrquestradorService.ResultadoSomenteDriveProcesso resultado =
                    orquestradorService.executarSomenteDriveProgressivo(
                            credencialIdPadrao, processo, detalhesProcesso);
            porProcesso.add(resultado.toRelatorioMap());
            detalhesGlobais.addAll(detalhesProcesso);

            if (resultado.erro() != null) {
                errosConsecutivos++;
                if (ProjudiOrquestradorErroUtil.indicaBloqueioOuErroGrave(
                        new RuntimeException(resultado.erro()))) {
                    motivoParada = "Bloqueio/erro grave: " + resultado.erro();
                    parar = true;
                } else if (errosConsecutivos >= ERROS_CONSECUTIVOS_LIMITE) {
                    motivoParada = "3 erros consecutivos.";
                    parar = true;
                }
            } else {
                errosConsecutivos = 0;
            }

            if (!parar && i < processoIds.size() - 1 && delay > 0) {
                try {
                    Thread.sleep(delay * 1000L);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    motivoParada = "Interrompido entre processos.";
                    parar = true;
                }
            }
        }

        Instant fim = Instant.now();
        long duracaoTotalMs = System.currentTimeMillis() - inicioMs;
        out.put("fim", fim.toString());
        out.put("duracaoTotalMs", duracaoTotalMs);
        out.put("processos", porProcesso);
        out.put("detalhes", detalhesGlobais);
        if (motivoParada != null) {
            out.put("paradaAntecipada", motivoParada);
        }
        out.put(
                "resumo",
                String.format(
                        "processos=%d arquivosBaixados=%d duracaoTotalMs=%d%s",
                        porProcesso.size(),
                        porProcesso.stream()
                                .mapToInt(p -> ((Number) p.getOrDefault("arquivosBaixados", 0)).intValue())
                                .sum(),
                        duracaoTotalMs,
                        motivoParada != null ? " PARADA=" + motivoParada : ""));
        return out;
    }
}
