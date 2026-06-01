package br.com.vilareal.projudi;

import br.com.vilareal.documento.DocumentoDrivePastaService;
import br.com.vilareal.documento.DrivePastaInfoDto;
import br.com.vilareal.documento.DrivePastaProcessoDto;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.documento.PdfTextoExtracaoUtil;
import br.com.vilareal.documento.WordTextoExtracaoUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import com.google.api.services.drive.model.File;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * TEMP — sonda read-only: arquivos da pasta do processo no Drive (recursivo a partir de
 * {@code Proc. {numeroInterno}}) + extração de texto nativo. Remover após validar Júlia.
 */
@Service
public class ProjudiProcessoArquivosDiagnosticoService {

    private final ProjudiDriveMovimentacoesPdfSupport pdfSupport;
    private final DocumentoDrivePastaService documentoDrivePastaService;
    private final GoogleDriveService googleDriveService;

    public ProjudiProcessoArquivosDiagnosticoService(
            ProjudiDriveMovimentacoesPdfSupport pdfSupport,
            DocumentoDrivePastaService documentoDrivePastaService,
            GoogleDriveService googleDriveService) {
        this.pdfSupport = pdfSupport;
        this.documentoDrivePastaService = documentoDrivePastaService;
        this.googleDriveService = googleDriveService;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> listarArquivosProcesso(String cnj) throws Exception {
        if (!StringUtils.hasText(cnj)) {
            return Map.of("erro", "cnj obrigatório");
        }
        if (!googleDriveService.isConfigurado()) {
            return Map.of("erro", "Google Drive não configurado");
        }
        var processoOpt = pdfSupport.buscarProcessoPorCnj(cnj.trim());
        if (processoOpt.isEmpty()) {
            return Map.of("erro", "processo não encontrado no cadastro local", "cnj", cnj.trim());
        }
        ProcessoEntity processo = processoOpt.get();
        String codigoCliente = documentoDrivePastaService.resolverCodigoClienteDoProcesso(processo);
        Integer numeroInterno = processo.getNumeroInterno();
        if (!StringUtils.hasText(codigoCliente) || numeroInterno == null) {
            return Map.of("erro", "processo sem código cliente ou número interno", "cnj", cnj.trim());
        }

        DrivePastaProcessoDto pastaResolvida = documentoDrivePastaService.resolverPastaRaizProcesso(
                googleDriveService, codigoCliente.trim(), numeroInterno);
        if (pastaResolvida == null || !StringUtils.hasText(pastaResolvida.pastaId())) {
            return Map.of("erro", "pasta raiz do processo não encontrada no Drive", "cnj", cnj.trim());
        }

        PastaVarredura varredura = resolverPastaVarredura(pastaResolvida, numeroInterno);

        List<ItemArquivoProcesso> arquivos = new ArrayList<>();
        listarRecursivo(varredura.pastaId(), "", arquivos);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("cnj", cnj.trim());
        out.put("processoId", processo.getId());
        out.put("codigoCliente", codigoCliente.trim());
        out.put("numeroInterno", numeroInterno);
        out.put("pastaRaizResolvidaId", pastaResolvida.pastaId());
        out.put("pastaRaizResolvidaNome", pastaResolvida.nomePasta());
        out.put("pastaRaizResolvidaCaminho", pastaResolvida.caminho());
        out.put("pastaVarreduraId", varredura.pastaId());
        out.put("pastaVarreduraNome", varredura.nomePasta());
        out.put("subiuDoNivelReu", varredura.subiuDoNivelReu());
        out.put("totalArquivos", arquivos.size());
        out.put("arquivos", arquivos);
        return out;
    }

    public Map<String, Object> extrairTextoArquivo(String fileId) throws Exception {
        if (!StringUtils.hasText(fileId)) {
            return Map.of("erro", "fileId obrigatório");
        }
        if (!googleDriveService.isConfigurado()) {
            return Map.of("erro", "Google Drive não configurado");
        }
        GoogleDriveService.DriveArquivoMetadados meta = googleDriveService.obterMetadadosArquivo(fileId);
        byte[] bytes = googleDriveService.baixarBytesArquivo(fileId);

        String fonte;
        String texto;
        if (PdfTextoExtracaoUtil.parecePdf(bytes)
                || "application/pdf".equalsIgnoreCase(meta.mimeType())) {
            texto = PdfTextoExtracaoUtil.extrairTexto(bytes);
            fonte = StringUtils.hasText(texto) && !PdfTextoExtracaoUtil.precisaOcr(texto, 32)
                    ? "pdf-nativo"
                    : "sem-texto";
        } else if (WordTextoExtracaoUtil.pareceDocx(bytes, meta.mimeType(), meta.nome())) {
            texto = WordTextoExtracaoUtil.extrairDocx(bytes);
            fonte = "docx";
        } else if (WordTextoExtracaoUtil.pareceDoc(bytes, meta.mimeType(), meta.nome())) {
            texto = WordTextoExtracaoUtil.extrairDoc(bytes);
            fonte = "doc";
        } else {
            texto = "";
            fonte = "sem-texto";
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("fileId", meta.fileId());
        out.put("nome", meta.nome());
        out.put("mimeType", meta.mimeType());
        out.put("fonte", fonte);
        out.put("chars", texto.length());
        out.put("texto", texto);
        return out;
    }

    /**
     * Regra: varrer a partir de {@code Proc. {numeroInterno}}. Se {@link DocumentoDrivePastaService
     * #resolverPastaRaizProcesso} devolveu a pasta do réu/parte oposta (filha do Proc.), sobe um
     * nível.
     */
    PastaVarredura resolverPastaVarredura(DrivePastaProcessoDto pastaResolvida, Integer numeroInterno)
            throws Exception {
        String pastaId = pastaResolvida.pastaId();
        String nome = pastaResolvida.nomePasta();
        if (ehPastaProc(nome, numeroInterno)) {
            return new PastaVarredura(pastaId, nome, false);
        }
        DrivePastaInfoDto info = googleDriveService.obterInfoPasta(pastaId);
        if (info != null
                && StringUtils.hasText(info.paiId())
                && StringUtils.hasText(info.paiNome())
                && ehPastaProc(info.paiNome(), numeroInterno)) {
            return new PastaVarredura(info.paiId(), info.paiNome(), true);
        }
        return new PastaVarredura(pastaId, nome, false);
    }

    static boolean ehPastaProc(String nomePasta, Integer numeroInterno) {
        if (!StringUtils.hasText(nomePasta) || numeroInterno == null) {
            return false;
        }
        int numero = numeroInterno;
        String esperado = String.format("Proc. %02d", numero);
        return nomePasta.trim().equalsIgnoreCase(esperado);
    }

    private void listarRecursivo(String pastaId, String prefixo, List<ItemArquivoProcesso> out) throws Exception {
        for (File f : googleDriveService.listarFilhosComMetadados(pastaId)) {
            if (googleDriveService.isPasta(f)) {
                String sub = prefixo.isEmpty() ? f.getName() : prefixo + "/" + f.getName();
                listarRecursivo(f.getId(), sub, out);
                continue;
            }
            String caminhoRelativo = prefixo.isEmpty() ? f.getName() : prefixo + "/" + f.getName();
            out.add(new ItemArquivoProcesso(
                    f.getId(),
                    f.getName(),
                    caminhoRelativo,
                    f.getMimeType(),
                    f.getModifiedTime() != null ? f.getModifiedTime().toString() : null,
                    f.getMd5Checksum(),
                    f.getSize() != null ? f.getSize() : 0L,
                    ehMovimentacoes(caminhoRelativo)));
        }
    }

    static boolean ehMovimentacoes(String caminhoRelativo) {
        if (!StringUtils.hasText(caminhoRelativo)) {
            return false;
        }
        String primeiro = caminhoRelativo.split("/")[0];
        String norm = Normalizer.normalize(primeiro.trim(), Normalizer.Form.NFC);
        return ProjudiDriveMovimentacoesPdfSupport.PASTA_MOVIMENTACOES.equalsIgnoreCase(norm);
    }

    record PastaVarredura(String pastaId, String nomePasta, boolean subiuDoNivelReu) {}

    public record ItemArquivoProcesso(
            String fileId,
            String nome,
            String caminhoRelativo,
            String mimeType,
            String modifiedTime,
            String md5Checksum,
            long tamanho,
            boolean ehMovimentacoes) {}
}
