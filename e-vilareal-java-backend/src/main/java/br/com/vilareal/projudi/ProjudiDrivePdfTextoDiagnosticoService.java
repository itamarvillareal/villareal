package br.com.vilareal.projudi;

import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.documento.PdfTextoExtracaoUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

/** TEMP — extrai texto dos PDFs na pasta Movimentações do Drive (read-only). Remover após prototipar triagem. */
@Service
public class ProjudiDrivePdfTextoDiagnosticoService {

    private static final int LIMITE_TEXTO = 3000;

    private final ProjudiDriveMovimentacoesPdfSupport pdfSupport;
    private final GoogleDriveService googleDriveService;

    public ProjudiDrivePdfTextoDiagnosticoService(
            ProjudiDriveMovimentacoesPdfSupport pdfSupport,
            GoogleDriveService googleDriveService) {
        this.pdfSupport = pdfSupport;
        this.googleDriveService = googleDriveService;
    }

    @Transactional(readOnly = true)
    public List<ItemDrivePdfTexto> extrairTextos(List<String> cnjs) throws Exception {
        if (cnjs == null || cnjs.isEmpty()) {
            return List.of();
        }
        List<ItemDrivePdfTexto> out = new ArrayList<>();
        for (String cnj : cnjs) {
            if (!StringUtils.hasText(cnj)) {
                continue;
            }
            String cnjTrim = cnj.trim();
            var processo = pdfSupport.buscarProcessoPorCnj(cnjTrim).orElse(null);
            if (processo == null) {
                out.add(ItemDrivePdfTexto.erro(cnjTrim, "processo não encontrado no cadastro local"));
                continue;
            }
            String pastaMovimentacoesId = pdfSupport.resolverPastaMovimentacoesId(processo);
            if (!StringUtils.hasText(pastaMovimentacoesId)) {
                out.add(ItemDrivePdfTexto.erro(cnjTrim, "pasta Movimentações não encontrada no Drive"));
                continue;
            }
            for (var pdf : pdfSupport.listarPdfsOrdenados(pastaMovimentacoesId)) {
                byte[] bytes = googleDriveService.baixarBytesArquivo(pdf.fileId());
                String texto = PdfTextoExtracaoUtil.extrairTexto(bytes);
                out.add(new ItemDrivePdfTexto(
                        cnjTrim,
                        pdf.seqMov(),
                        pdf.nome(),
                        truncar(texto)));
            }
        }
        return out;
    }

    private static String truncar(String texto) {
        if (texto == null || texto.length() <= LIMITE_TEXTO) {
            return texto == null ? "" : texto;
        }
        return texto.substring(0, LIMITE_TEXTO) + "…";
    }

    public record ItemDrivePdfTexto(String cnj, Integer movimentacao, String nomeArquivo, String textoExtraido) {
        static ItemDrivePdfTexto erro(String cnj, String msg) {
            return new ItemDrivePdfTexto(cnj, null, null, msg);
        }
    }
}
