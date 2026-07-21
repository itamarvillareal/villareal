package br.com.vilareal.processo.application;

import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.projudi.ProjudiDriveProgressivoUtil;
import br.com.vilareal.projudi.ProjudiTeorService;
import br.com.vilareal.projudi.pipeline.ProjudiDriveArquivamentoService;
import br.com.vilareal.projudi.pipeline.ProjudiMovimentacoesListagemService;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Verifica se todas as movimentações PROJUDI com documento já estão arquivadas na pasta
 * {@code Movimentações} do Drive — sem baixar novos arquivos.
 */
@Service
public class ProcessoProjudiAcervoIntegralDriveCheckerService {

    public record VerificacaoAcervo(
            boolean completo,
            int totalComDocumento,
            int totalArquivadasDrive,
            int faltantes,
            String erro) {

        public static VerificacaoAcervo erro(String mensagem) {
            return new VerificacaoAcervo(false, 0, 0, 0, mensagem);
        }
    }

    private final ProjudiMovimentacoesListagemService movimentacoesListagemService;
    private final ProjudiDriveArquivamentoService driveArquivamentoService;
    private final GoogleDriveService googleDriveService;

    public ProcessoProjudiAcervoIntegralDriveCheckerService(
            ProjudiMovimentacoesListagemService movimentacoesListagemService,
            ProjudiDriveArquivamentoService driveArquivamentoService,
            GoogleDriveService googleDriveService) {
        this.movimentacoesListagemService = movimentacoesListagemService;
        this.driveArquivamentoService = driveArquivamentoService;
        this.googleDriveService = googleDriveService;
    }

    public VerificacaoAcervo verificar(ProcessoEntity processo, Long credencialId) {
        if (processo == null) {
            return VerificacaoAcervo.erro("Processo nulo");
        }
        if (credencialId == null || credencialId <= 0) {
            return VerificacaoAcervo.erro("credencialId inválido");
        }
        String numeroCnj = processo.getNumeroCnj();
        if (!StringUtils.hasText(numeroCnj)) {
            return VerificacaoAcervo.erro("Processo sem número CNJ");
        }
        if (!googleDriveService.isConfigurado()) {
            return VerificacaoAcervo.erro("Google Drive não configurado");
        }

        try {
            ProjudiMovimentacoesListagemService.ListagemMovimentacoes listagem =
                    movimentacoesListagemService.listarComFallbackReduzido(credencialId, numeroCnj.trim());
            List<ProjudiTeorService.MovimentacaoProjudi> comDoc =
                    ProjudiDriveProgressivoUtil.filtrarComDocDesc(listagem.movimentacoes());
            if (comDoc.isEmpty()) {
                return new VerificacaoAcervo(false, 0, 0, 0, "Nenhuma movimentação com documento no PROJUDI");
            }

            List<String> detalhes = new ArrayList<>();
            String pastaMovimentacoesId =
                    driveArquivamentoService.resolverPastaMovimentacoesId(processo, numeroCnj.trim(), detalhes);
            if (!StringUtils.hasText(pastaMovimentacoesId)) {
                return VerificacaoAcervo.erro("Pasta Movimentações não resolvida no Drive");
            }

            List<String> nomesDrive = googleDriveService.listarFilhos(pastaMovimentacoesId).stream()
                    .map(com.google.api.services.drive.model.File::getName)
                    .toList();
            Set<Integer> arquivadas = ProjudiDriveProgressivoUtil.extrairNumerosArquivados(nomesDrive);
            int faltantes = ProjudiDriveProgressivoUtil.contarFaltantesEmComDoc(comDoc, arquivadas);
            boolean completo = faltantes == 0;
            return new VerificacaoAcervo(
                    completo, comDoc.size(), arquivadas.size(), faltantes, completo ? null : "Acervo incompleto no Drive");
        } catch (Exception e) {
            return VerificacaoAcervo.erro(e.getMessage());
        }
    }
}
