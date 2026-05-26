package br.com.vilareal.documento;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/** Delega para {@link DocumentoReformatarService} (compatibilidade com endpoint /formatar-arquivo). */
@Service
public class DocumentoArquivoImportacaoService {

    private final DocumentoReformatarService reformatarService;

    public DocumentoArquivoImportacaoService(DocumentoReformatarService reformatarService) {
        this.reformatarService = reformatarService;
    }

    public byte[] formatarArquivoComoPdf(
            MultipartFile arquivo,
            String enderecamento,
            String numeroProcesso,
            String cidadeEstado,
            String dataIso)
            throws IOException {
        return reformatarService.reformatar(arquivo, enderecamento, numeroProcesso, cidadeEstado, dataIso);
    }
}
