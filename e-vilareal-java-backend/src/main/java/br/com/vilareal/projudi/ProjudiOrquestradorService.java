package br.com.vilareal.projudi;

import br.com.vilareal.processo.application.ProcessoDiagnosticoNumeroBuscaUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.projudi.pipeline.ProjudiModoCompletoPipeline;
import br.com.vilareal.projudi.pipeline.ProjudiModoCompletoPipeline.ResultadoParcial;
import br.com.vilareal.projudi.pipeline.ProjudiSomenteDrivePassadaService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigInteger;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Orquestrador PROJUDI — motor de consulta + arquivamento no Drive (PASSO B2a).
 *
 * <p><b>READ-ONLY no PROJUDI:</b> usa apenas {@link ProjudiTeorService#listarMovimentacoes} e
 * {@link ProjudiTeorService#baixarDocumentos}. Não abre pendências; não faz POST além
 * do já existente (busca de processo).</p>
 */
@Service
public class ProjudiOrquestradorService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiOrquestradorService.class);

    private static final int LIMITE_DEFAULT = 1;
    private final ProcessoRepository processoRepository;
    private final ProjudiOrquestradorGate orquestradorGate;
    private final ProjudiSomenteDrivePassadaService somenteDrivePassadaService;
    private final ProjudiModoCompletoPipeline modoCompletoPipeline;

    public ProjudiOrquestradorService(ProcessoRepository processoRepository,
                                       ProjudiOrquestradorGate orquestradorGate,
                                       ProjudiSomenteDrivePassadaService somenteDrivePassadaService,
                                       ProjudiModoCompletoPipeline modoCompletoPipeline) {
        this.processoRepository = processoRepository;
        this.orquestradorGate = orquestradorGate;
        this.somenteDrivePassadaService = somenteDrivePassadaService;
        this.modoCompletoPipeline = modoCompletoPipeline;
    }

    public ResultadoOrquestracao executar(Long credencialId, boolean dryRun,
                                          String numeroEspecifico, Integer limite,
                                          Integer maxMovimentacoesComDoc) {
        Optional<ResultadoOrquestracao> resultado = orquestradorGate.tryExecutarComRetorno(
                "orquestrador/run",
                () -> executarInterno(credencialId, dryRun, numeroEspecifico, limite, maxMovimentacoesComDoc));
        if (resultado.isEmpty()) {
            return new ResultadoOrquestracao(
                    0, 0, 0, 0, 0, 0, 1,
                    List.of("robô PROJUDI ocupado; tente novamente em alguns minutos."));
        }
        return resultado.get();
    }

    private ResultadoOrquestracao executarInterno(Long credencialId, boolean dryRun,
                                                  String numeroEspecifico, Integer limite,
                                                  Integer maxMovimentacoesComDoc) {
        int processos = 0;
        int movimentacoesLidas = 0;
        int movimentacoesComDoc = 0;
        int teoresNovos = 0;
        int teoresJaExistentes = 0;
        int arquivosBaixados = 0;
        int erros = 0;
        List<String> detalhes = new ArrayList<>();

        List<ItemProcesso> itens;
        if (StringUtils.hasText(numeroEspecifico)) {
            itens = resolverItemPorNumeroEspecifico(numeroEspecifico.trim(), dryRun, detalhes);
        } else {
            int limiteEfetivo = (limite != null) ? limite : LIMITE_DEFAULT;
            itens = resolverItensConsultaAutomatica(limiteEfetivo);
        }

        for (ItemProcesso item : itens) {
            try {
                processos++;
                ResultadoParcial parcial = modoCompletoPipeline.processarProcesso(
                        credencialId, dryRun, item.processo(), item.numeroCnj(),
                        maxMovimentacoesComDoc, detalhes);
                movimentacoesLidas += parcial.movimentacoesLidas();
                movimentacoesComDoc += parcial.movimentacoesComDoc();
                teoresNovos += parcial.teoresNovos();
                teoresJaExistentes += parcial.teoresJaExistentes();
                arquivosBaixados += parcial.arquivosBaixados();
                erros += parcial.erros();
            } catch (Exception e) {
                erros++;
                detalhes.add(item.rotulo() + " | ERRO: " + e.getMessage());
                log.warn("Falha ao processar processo PROJUDI ({}): {}", item.rotulo(), e.getMessage());
            }
        }

        return new ResultadoOrquestracao(
                processos, movimentacoesLidas, movimentacoesComDoc,
                teoresNovos, teoresJaExistentes, arquivosBaixados, erros, detalhes);
    }

    private List<ItemProcesso> resolverItemPorNumeroEspecifico(String cnj, boolean dryRun,
                                                               List<String> detalhes) {
        Optional<ProcessoEntity> processo = buscarProcessoPorCnj(cnj);
        if (processo.isPresent()) {
            return List.of(ItemProcesso.comEntidade(processo.get()));
        }
        if (dryRun) {
            return List.of(ItemProcesso.semEntidade(cnj));
        }
        detalhes.add(cnj + " | AVISO: ProcessoEntity não encontrado por CNJ; "
                + "Drive exige cadastro local — pulado (dryRun=false).");
        return List.of();
    }

    private List<ItemProcesso> resolverItensConsultaAutomatica(int limiteEfetivo) {
        List<ProcessoEntity> processos = processoRepository.findParaConsultaAutomaticaProjudi(
                PageRequest.of(0, limiteEfetivo));
        return processos.stream().map(ItemProcesso::comEntidade).toList();
    }

    private Optional<ProcessoEntity> buscarProcessoPorCnj(String cnj) {
        String norm = ProcessoDiagnosticoNumeroBuscaUtil.normalizarSomenteDigitos(cnj);
        if (norm.isEmpty()) {
            return Optional.empty();
        }
        List<BigInteger> ids = processoRepository.findIdsByNumeroCnjNormalizadoDiagnostico(norm);
        if (ids.isEmpty()) {
            return Optional.empty();
        }
        return processoRepository.findByIdWithClienteAndPessoa(ids.getFirst().longValue());
    }

    /**
     * Modo somente Drive por CNJ (processo já cadastrado). Usado pelo disparo automático por e-mail.
     */
    public ResultadoSomenteDriveProcesso executarSomenteDrivePorCnj(
            Long credencialId, String cnj, List<String> detalhes) {
        Optional<ProcessoEntity> processo = buscarProcessoPorCnj(cnj);
        if (processo.isEmpty()) {
            List<String> logDetalhes = detalhes != null ? detalhes : new ArrayList<>();
            logDetalhes.add(cnj + " | AVISO: ProcessoEntity não encontrado por CNJ.");
            return ResultadoSomenteDriveProcesso.erro(cnj, 0L, "Processo não encontrado por CNJ.", logDetalhes);
        }
        return executarSomenteDriveProgressivo(credencialId, processo.get(), detalhes);
    }

    /**
     * Modo somente Drive: regra progressiva (NOVAS_TOPO + BACKFILL) sem gravar {@code publicacoes}.
     */
    public ResultadoSomenteDriveProcesso executarSomenteDriveProgressivo(
            Long credencialId, ProcessoEntity processo, List<String> detalhes) {
        return somenteDrivePassadaService.executarPassada(credencialId, processo, detalhes);
    }

    /** Processo cadastrado ou busca direta (dry-run sem entidade local). */
    private record ItemProcesso(ProcessoEntity processo, String numeroCnj) {
        static ItemProcesso comEntidade(ProcessoEntity processo) {
            return new ItemProcesso(processo, processo.getNumeroCnj());
        }

        static ItemProcesso semEntidade(String numeroBusca) {
            return new ItemProcesso(null, numeroBusca);
        }

        String rotulo() {
            return StringUtils.hasText(numeroCnj) ? numeroCnj : "?";
        }
    }

    public record ResultadoSomenteDriveProcesso(
            String cnj,
            int arquivosBaixados,
            int jaArquivados,
            int totalComDocumento,
            int totalArquivadasDrive,
            boolean temMais,
            long duracaoMs,
            String erro,
            List<String> detalhes,
            ProjudiDriveProgressivoUtil.SelecaoProgressiva selecao,
            LocalDate dataDistribuicaoProjudi) {

        /** F8: candidato a mover o record para o pacote pipeline. */
        public static ResultadoSomenteDriveProcesso erro(
                String cnj, long duracaoMs, String erro, List<String> detalhes) {
            return erro(cnj, duracaoMs, erro, detalhes, null);
        }

        public static ResultadoSomenteDriveProcesso erro(
                String cnj,
                long duracaoMs,
                String erro,
                List<String> detalhes,
                LocalDate dataDistribuicaoProjudi) {
            return new ResultadoSomenteDriveProcesso(
                    cnj, 0, 0, 0, 0, false, duracaoMs, erro, detalhes, null, dataDistribuicaoProjudi);
        }

        public static ResultadoSomenteDriveProcesso erroComEstado(
                String cnj,
                int jaArquivados,
                int totalComDocumento,
                int totalArquivadasDrive,
                boolean temMais,
                long duracaoMs,
                String erro,
                List<String> detalhes,
                ProjudiDriveProgressivoUtil.SelecaoProgressiva selecao) {
            return erroComEstado(
                    cnj,
                    jaArquivados,
                    totalComDocumento,
                    totalArquivadasDrive,
                    temMais,
                    duracaoMs,
                    erro,
                    detalhes,
                    selecao,
                    null);
        }

        public static ResultadoSomenteDriveProcesso erroComEstado(
                String cnj,
                int jaArquivados,
                int totalComDocumento,
                int totalArquivadasDrive,
                boolean temMais,
                long duracaoMs,
                String erro,
                List<String> detalhes,
                ProjudiDriveProgressivoUtil.SelecaoProgressiva selecao,
                LocalDate dataDistribuicaoProjudi) {
            return new ResultadoSomenteDriveProcesso(
                    cnj,
                    0,
                    jaArquivados,
                    totalComDocumento,
                    totalArquivadasDrive,
                    temMais,
                    duracaoMs,
                    erro,
                    detalhes,
                    selecao,
                    dataDistribuicaoProjudi);
        }

        public Map<String, Object> toRelatorioMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("cnj", cnj);
            m.put("arquivosBaixados", arquivosBaixados);
            m.put("jaArquivados", jaArquivados);
            m.put("totalComDocumento", totalComDocumento);
            m.put("totalArquivadasDrive", totalArquivadasDrive);
            m.put("temMais", temMais);
            m.put("duracaoMs", duracaoMs);
            if (erro != null) {
                m.put("erro", erro);
            }
            if (selecao != null) {
                m.put("selecao", selecao.resumo());
            }
            return m;
        }
    }

    public record ResultadoOrquestracao(
            int processos,
            int movimentacoesLidas,
            int movimentacoesComDoc,
            int teoresNovos,
            int teoresJaExistentes,
            int arquivosBaixados,
            int erros,
            List<String> detalhes) {
    }
}
