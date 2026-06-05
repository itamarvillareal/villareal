package br.com.vilareal.projudi.pipeline;

import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.projudi.ProjudiOrquestradorPersistenciaService;
import br.com.vilareal.projudi.ProjudiTeorService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Modo completo PROJUDI: listagem, dedup, download, Drive, publicações e {@code proxima_consulta}.
 */
@Component
public class ProjudiModoCompletoPipeline {

    private static final Logger log = LoggerFactory.getLogger(ProjudiModoCompletoPipeline.class);

    private final ProjudiTeorService teorService;
    private final ProjudiMovimentacoesListagemService movimentacoesListagemService;
    private final ProjudiMovimentacaoNovidadeClassifier movimentacaoNovidadeClassifier;
    private final ProjudiDriveArquivamentoService driveArquivamentoService;
    private final ProjudiPublicacaoMovimentacaoRegistrarService publicacaoRegistrarService;
    private final GoogleDriveService googleDriveService;
    private final ProjudiOrquestradorPersistenciaService persistenciaService;
    private final int intervaloHorasProximaConsulta;

    public ProjudiModoCompletoPipeline(
            ProjudiTeorService teorService,
            ProjudiMovimentacoesListagemService movimentacoesListagemService,
            ProjudiMovimentacaoNovidadeClassifier movimentacaoNovidadeClassifier,
            ProjudiDriveArquivamentoService driveArquivamentoService,
            ProjudiPublicacaoMovimentacaoRegistrarService publicacaoRegistrarService,
            GoogleDriveService googleDriveService,
            ProjudiOrquestradorPersistenciaService persistenciaService,
            @Value("${projudi.orquestrador.intervalo-horas:12}") int intervaloHorasProximaConsulta) {
        this.teorService = teorService;
        this.movimentacoesListagemService = movimentacoesListagemService;
        this.movimentacaoNovidadeClassifier = movimentacaoNovidadeClassifier;
        this.driveArquivamentoService = driveArquivamentoService;
        this.publicacaoRegistrarService = publicacaoRegistrarService;
        this.googleDriveService = googleDriveService;
        this.persistenciaService = persistenciaService;
        this.intervaloHorasProximaConsulta = intervaloHorasProximaConsulta > 0
                ? intervaloHorasProximaConsulta
                : 12;
    }

    public ResultadoParcial processarProcesso(
            Long credencialId,
            boolean dryRun,
            ProcessoEntity processo,
            String numeroCnj,
            Integer maxMovimentacoesComDoc,
            List<String> detalhes) {
        int movimentacoesLidas = 0;
        int movimentacoesComDoc = 0;
        int teoresNovos = 0;
        int teoresJaExistentes = 0;
        int arquivosBaixados = 0;
        int erros = 0;
        List<ProjudiTeorService.MovimentacaoProjudi> movs =
                movimentacoesListagemService.listarComFallbackReduzido(credencialId, numeroCnj);

        movimentacoesLidas = movs.size();

        List<ProjudiTeorService.MovimentacaoProjudi> movsComDocumento = new ArrayList<>();
        for (ProjudiTeorService.MovimentacaoProjudi mov : movs) {
            if (!mov.temDocumento() || mov.idMovimentacaoArquivo() == null) {
                continue;
            }
            movimentacoesComDoc++;
            movsComDocumento.add(mov);
        }

        ProjudiMovimentacaoNovidadeClassifier.ClassificacaoNovidade classificacao =
                movimentacaoNovidadeClassifier.classificar(numeroCnj, movsComDocumento, maxMovimentacoesComDoc);
        teoresNovos = classificacao.teoresNovos();
        teoresJaExistentes = classificacao.teoresJaExistentes();

        for (ProjudiTeorService.MovimentacaoProjudi mov : classificacao.novas()) {
            String hashConteudo = ProjudiMovimentacaoHashUtil.hashConteudoMovimentacao(numeroCnj, mov.idMovi());

            List<ProjudiTeorService.ArquivoTeor> arquivos =
                    teorService.baixarDocumentos(credencialId, mov.idMovimentacaoArquivo());
            arquivosBaixados += arquivos.size();

            String nomes = arquivos.stream()
                    .map(ProjudiTeorService.ArquivoTeor::nomeArquivo)
                    .collect(Collectors.joining(", "));

            if (!dryRun && !arquivos.isEmpty()) {
                if (processo == null) {
                    detalhes.add(numeroCnj + " | mov " + mov.numero() + " [" + mov.tipo() + "] "
                            + mov.dataHora() + " -> " + arquivos.size()
                            + " arquivo(s): " + nomes
                            + " | AVISO: sem ProcessoEntity — Drive pulado.");
                } else if (!googleDriveService.isConfigurado()) {
                    detalhes.add(numeroCnj + " | mov " + mov.numero() + " [" + mov.tipo() + "] "
                            + mov.dataHora() + " -> " + arquivos.size()
                            + " arquivo(s): " + nomes
                            + " | AVISO: Google Drive não configurado — upload pulado.");
                } else {
                    driveArquivamentoService.enviarArquivosMovimentacaoAoDrive(
                            processo, numeroCnj, mov, arquivos, nomes, detalhes);
                }
            } else {
                detalhes.add(numeroCnj + " | mov " + mov.numero() + " [" + mov.tipo() + "] "
                        + mov.dataHora() + " -> " + arquivos.size() + " arquivo(s): " + nomes);
            }

            if (!dryRun) {
                try {
                    publicacaoRegistrarService.registrarMovimentacao(
                            processo, numeroCnj, mov, hashConteudo, detalhes);
                } catch (Exception e) {
                    erros++;
                    detalhes.add(numeroCnj + " | mov " + mov.numero() + " | ERRO publicação: "
                            + e.getClass().getSimpleName() + ": " + e.getMessage());
                    log.warn("Falha ao gravar publicação PROJUDI (cnj={}, mov={}): {}",
                            numeroCnj, mov.numero(), e.getMessage(), e);
                }
            }
        }

        if (!dryRun && processo != null) {
            persistenciaService.atualizarProximaConsulta(processo.getId(), intervaloHorasProximaConsulta);
        }

        return new ResultadoParcial(
                movimentacoesLidas, movimentacoesComDoc, teoresNovos, teoresJaExistentes, arquivosBaixados, erros);
    }

    public record ResultadoParcial(
            int movimentacoesLidas,
            int movimentacoesComDoc,
            int teoresNovos,
            int teoresJaExistentes,
            int arquivosBaixados,
            int erros) {
    }
}
