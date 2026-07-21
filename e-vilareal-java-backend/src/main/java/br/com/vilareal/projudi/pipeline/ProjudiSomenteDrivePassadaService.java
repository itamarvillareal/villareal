package br.com.vilareal.projudi.pipeline;

import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.processo.application.rag.RagArquivoDriveEnviado;
import br.com.vilareal.processo.application.rag.RagIndexacaoService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.application.ProcessoMovimentacoesConsolidadoDriveAutoService;
import br.com.vilareal.projudi.ProjudiDriveProgressivoUtil;
import br.com.vilareal.projudi.ProjudiOrquestradorErroUtil;
import br.com.vilareal.projudi.ProjudiOrquestradorGate;
import br.com.vilareal.projudi.ProjudiOrquestradorService;
import br.com.vilareal.projudi.ProjudiTeorService;
import br.com.vilareal.publicacao.application.PublicacaoDriveAndamentosService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import java.time.LocalDate;

/**
 * Passada somente-Drive (NOVAS_TOPO + BACKFILL) — caminho de produção (UI + pipeline e-mail).
 */
@Component
public class ProjudiSomenteDrivePassadaService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiSomenteDrivePassadaService.class);

    private final ProjudiMovimentacoesListagemService movimentacoesListagemService;
    private final ProjudiDriveArquivamentoService driveArquivamentoService;
    private final ProjudiTeorService teorService;
    private final GoogleDriveService googleDriveService;
    private final PublicacaoDriveAndamentosService publicacaoDriveAndamentosService;
    private final ProcessoMovimentacoesConsolidadoDriveAutoService consolidadoDriveAutoService;
    private final ProjudiOrquestradorGate orquestradorGate;
    private final RagIndexacaoService ragIndexacaoService;
    private final int passoBackfill;
    private final long delayMsDownload;

    public ProjudiSomenteDrivePassadaService(
            ProjudiMovimentacoesListagemService movimentacoesListagemService,
            ProjudiDriveArquivamentoService driveArquivamentoService,
            ProjudiTeorService teorService,
            GoogleDriveService googleDriveService,
            PublicacaoDriveAndamentosService publicacaoDriveAndamentosService,
            ProcessoMovimentacoesConsolidadoDriveAutoService consolidadoDriveAutoService,
            ProjudiOrquestradorGate orquestradorGate,
            RagIndexacaoService ragIndexacaoService,
            @Value("${projudi.orquestrador.passo-backfill:10}") int passoBackfill,
            @Value("${projudi.orquestrador.delay-ms-download:2000}") long delayMsDownload) {
        this.movimentacoesListagemService = movimentacoesListagemService;
        this.driveArquivamentoService = driveArquivamentoService;
        this.teorService = teorService;
        this.googleDriveService = googleDriveService;
        this.publicacaoDriveAndamentosService = publicacaoDriveAndamentosService;
        this.consolidadoDriveAutoService = consolidadoDriveAutoService;
        this.orquestradorGate = orquestradorGate;
        this.ragIndexacaoService = ragIndexacaoService;
        this.passoBackfill = passoBackfill > 0 ? passoBackfill : 10;
        this.delayMsDownload = delayMsDownload >= 0 ? delayMsDownload : 2000;
    }

    public ProjudiOrquestradorService.ResultadoSomenteDriveProcesso executarPassada(
            Long credencialId, ProcessoEntity processo, List<String> detalhes) {
        long inicioMs = System.currentTimeMillis();
        List<String> logDetalhes = detalhes != null ? detalhes : new ArrayList<>();
        String numeroCnj = processo.getNumeroCnj();
        if (!StringUtils.hasText(numeroCnj)) {
            return ProjudiOrquestradorService.ResultadoSomenteDriveProcesso.erro(
                    "?", System.currentTimeMillis() - inicioMs, "Processo sem numeroCnj.", logDetalhes);
        }
        if (!googleDriveService.isConfigurado()) {
            return ProjudiOrquestradorService.ResultadoSomenteDriveProcesso.erro(
                    numeroCnj,
                    System.currentTimeMillis() - inicioMs,
                    "Google Drive não configurado.",
                    logDetalhes);
        }

        try {
            ProjudiMovimentacoesListagemService.ListagemMovimentacoes listagem =
                    movimentacoesListagemService.listarComFallbackReduzido(credencialId, numeroCnj);
            List<ProjudiTeorService.MovimentacaoProjudi> movs = listagem.movimentacoes();
            LocalDate dataDistribuicaoProjudi = listagem.dataDistribuicao();

            if (movs.isEmpty()) {
                logDetalhes.add(numeroCnj + " | PROJUDI retornou 0 movimentações.");
                return ProjudiOrquestradorService.ResultadoSomenteDriveProcesso.erro(
                        numeroCnj,
                        System.currentTimeMillis() - inicioMs,
                        "PROJUDI não retornou movimentações para este processo. "
                                + "Verifique número CNJ e credenciais. "
                                + "O código OTP é lido automaticamente da conta Gmail configurada no servidor "
                                + "(projudi.token.remetente), não da sua caixa pessoal.",
                        logDetalhes,
                        listagem.dataDistribuicao());
            }

            List<ProjudiTeorService.MovimentacaoProjudi> comDoc =
                    ProjudiDriveProgressivoUtil.filtrarComDocDesc(movs);
            String pastaMovimentacoesId =
                    driveArquivamentoService.resolverPastaMovimentacoesId(processo, numeroCnj, logDetalhes);
            if (pastaMovimentacoesId == null) {
                return ProjudiOrquestradorService.ResultadoSomenteDriveProcesso.erro(
                        numeroCnj,
                        System.currentTimeMillis() - inicioMs,
                        "Pasta Movimentações não resolvida.",
                        logDetalhes,
                        dataDistribuicaoProjudi);
            }

            List<String> nomesDrive = googleDriveService.listarFilhos(pastaMovimentacoesId).stream()
                    .map(com.google.api.services.drive.model.File::getName)
                    .toList();
            Set<Integer> arquivadas = ProjudiDriveProgressivoUtil.extrairNumerosArquivados(nomesDrive);
            int jaArquivados = ProjudiDriveProgressivoUtil.contarJaArquivadasEmComDoc(comDoc, arquivadas);

            ProjudiDriveProgressivoUtil.SelecaoProgressiva selecao =
                    ProjudiDriveProgressivoUtil.selecionarMovimentacoes(comDoc, arquivadas, passoBackfill);
            logDetalhes.add(numeroCnj + " | seleção progressiva: " + selecao.resumo());

            int arquivosEnviados = 0;
            int idxMov = 0;
            List<RagArquivoDriveEnviado> novosParaRag = new ArrayList<>();
            for (ProjudiTeorService.MovimentacaoProjudi mov : selecao.baixar()) {
                // Prioridade do utilizador (ex.: protocolo): cede o robô num ponto seguro. O restante
                // é progressivo e será arquivado na próxima passada.
                if (orquestradorGate.haPrioridadeAguardando()) {
                    logDetalhes.add(numeroCnj + " | arquivamento cedeu o robô a um protocolo do "
                            + "utilizador — restante será arquivado na próxima passada.");
                    log.info("Arquivamento PROJUDI cedeu o robô (cnj={}) a operação prioritária.", numeroCnj);
                    break;
                }
                if (idxMov > 0 && delayMsDownload > 0) {
                    Thread.sleep(delayMsDownload);
                }
                List<ProjudiTeorService.ArquivoTeor> arquivos =
                        teorService.baixarDocumentos(credencialId, mov.idMovimentacaoArquivo());
                String nomes = arquivos.stream()
                        .map(ProjudiTeorService.ArquivoTeor::nomeArquivo)
                        .collect(Collectors.joining(", "));
                arquivosEnviados += driveArquivamentoService.enviarArquivosMovimentacaoAoDrive(
                        processo, numeroCnj, mov, arquivos, nomes, pastaMovimentacoesId, logDetalhes, novosParaRag);
                idxMov++;
            }

            if (!novosParaRag.isEmpty()) {
                ragIndexacaoService.indexarArquivosNovos(numeroCnj, List.copyOf(novosParaRag));
            }

            publicacaoDriveAndamentosService.tentarMarcarAndamentosNoDrivePorCnj(
                    numeroCnj, pastaMovimentacoesId, arquivosEnviados);

            consolidadoDriveAutoService.tentarAposArquivamento(processo, arquivosEnviados);

            List<String> nomesDriveApos = googleDriveService.listarFilhos(pastaMovimentacoesId).stream()
                    .map(com.google.api.services.drive.model.File::getName)
                    .toList();
            Set<Integer> arquivadasApos = ProjudiDriveProgressivoUtil.extrairNumerosArquivados(nomesDriveApos);
            int totalArquivadasDrive = arquivadasApos.size();
            // Conclusão por CONJUNTO: ainda há movimentação com documento cujo número não está
            // no Drive? (não comparar contagens — lacunas podem coincidir em total).
            boolean temMais =
                    ProjudiDriveProgressivoUtil.contarFaltantesEmComDoc(comDoc, arquivadasApos) > 0;

            int movimentacoesTentadas = selecao.baixar().size();
            if (movimentacoesTentadas > 0 && arquivosEnviados == 0) {
                return ProjudiOrquestradorService.ResultadoSomenteDriveProcesso.erroComEstado(
                        numeroCnj,
                        jaArquivados,
                        comDoc.size(),
                        totalArquivadasDrive,
                        temMais,
                        System.currentTimeMillis() - inicioMs,
                        ProjudiOrquestradorErroUtil.resumirFalhaUploadDrive(logDetalhes),
                        logDetalhes,
                        selecao,
                        dataDistribuicaoProjudi);
            }

            return new ProjudiOrquestradorService.ResultadoSomenteDriveProcesso(
                    numeroCnj,
                    arquivosEnviados,
                    jaArquivados,
                    comDoc.size(),
                    totalArquivadasDrive,
                    temMais,
                    System.currentTimeMillis() - inicioMs,
                    null,
                    logDetalhes,
                    selecao,
                    dataDistribuicaoProjudi);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ProjudiOrquestradorService.ResultadoSomenteDriveProcesso.erro(
                    numeroCnj, System.currentTimeMillis() - inicioMs, "Interrompido: " + e.getMessage(), logDetalhes);
        } catch (Exception e) {
            log.warn("Falha somente Drive PROJUDI (cnj={}): {}", numeroCnj, e.getMessage());
            return ProjudiOrquestradorService.ResultadoSomenteDriveProcesso.erro(
                    numeroCnj,
                    System.currentTimeMillis() - inicioMs,
                    ProjudiOrquestradorErroUtil.mensagemResumida(e),
                    logDetalhes);
        }
    }
}
