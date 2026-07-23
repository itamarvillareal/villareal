package br.com.vilareal.projudi.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.DocumentoNomeNumeracaoUtil;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.pessoa.application.PessoaDocumentoDriveService;
import br.com.vilareal.pessoa.application.PessoaP7sDriveItem;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.projudi.api.dto.InicialDocumentoPessoaResponse;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Documentos constitutivos (.p7s) na pasta {@code Pessoas/{id8}/…} para instruir a inicial,
 * separados dos documentos específicos do processo (pasta «Assinar»).
 */
@Service
public class ProjudiInicialDocumentosPessoaService {

    /** PROJUDI: 16 = Petição (reservado à peça inicial do processo). Demais = Outros (1). */
    static final int ID_ARQUIVO_TIPO_OUTROS = 1;

    private final PessoaRepository pessoaRepository;
    private final PessoaDocumentoDriveService pessoaDocumentoDriveService;
    private final GoogleDriveService googleDriveService;

    public ProjudiInicialDocumentosPessoaService(
            PessoaRepository pessoaRepository,
            PessoaDocumentoDriveService pessoaDocumentoDriveService,
            GoogleDriveService googleDriveService) {
        this.pessoaRepository = pessoaRepository;
        this.pessoaDocumentoDriveService = pessoaDocumentoDriveService;
        this.googleDriveService = googleDriveService;
    }

    public List<InicialDocumentoPessoaResponse> listarConstitutivos(Long pessoaIdAutor) {
        if (pessoaIdAutor == null || pessoaIdAutor < 1) {
            throw new IllegalArgumentException("pessoaIdAutor é obrigatório.");
        }
        List<PessoaContexto> pessoas = resolverPessoasContexto(pessoaIdAutor);
        List<InicialDocumentoPessoaResponse> out = new ArrayList<>();
        for (PessoaContexto ctx : pessoas) {
            for (PessoaP7sDriveItem item : pessoaDocumentoDriveService.listarP7sNoDrive(ctx.pessoaId())) {
                out.add(toResponse(item, ctx));
            }
        }
        out.sort(Comparator.comparingInt((InicialDocumentoPessoaResponse d) ->
                        DocumentoNomeNumeracaoUtil.extrairPrefixoNumerico(d.nomeArquivo()))
                .thenComparing(InicialDocumentoPessoaResponse::nomeArquivo));
        return List.copyOf(out);
    }

    public byte[] baixarP7s(String driveFileId, Long pessoaIdAutor) {
        if (!StringUtils.hasText(driveFileId) || pessoaIdAutor == null) {
            throw new IllegalArgumentException("driveFileId e pessoaIdAutor são obrigatórios.");
        }
        String driveFileIdNorm = driveFileId.trim();
        for (PessoaContexto ctx : resolverPessoasContexto(pessoaIdAutor)) {
            boolean permitido = pessoaDocumentoDriveService.listarP7sNoDrive(ctx.pessoaId()).stream()
                    .anyMatch(item -> driveFileIdNorm.equals(item.p7sDriveFileId()));
            if (!permitido) {
                continue;
            }
            if (!googleDriveService.isConfigurado()) {
                throw new IllegalStateException("Google Drive não configurado.");
            }
            try {
                return googleDriveService.baixarBytesArquivo(driveFileIdNorm);
            } catch (Exception e) {
                throw new BusinessRuleException("Falha ao baixar .p7s do Drive: " + e.getMessage());
            }
        }
        throw new BusinessRuleException("Arquivo não encontrado na pasta Pessoas do autor ou representante.");
    }

    List<PessoaContexto> resolverPessoasContexto(Long pessoaIdAutor) {
        PessoaEntity autor = pessoaRepository
                .findById(pessoaIdAutor)
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + pessoaIdAutor));
        List<PessoaContexto> out = new ArrayList<>();
        out.add(new PessoaContexto(autor.getId(), autor.getNome(), "AUTOR"));
        if (ehPessoaJuridica(autor.getCpf())) {
            PessoaEntity responsavel = autor.getResponsavel();
            if (responsavel != null && responsavel.getId() != null) {
                out.add(new PessoaContexto(
                        responsavel.getId(),
                        responsavel.getNome(),
                        "REPRESENTANTE"));
            }
        }
        return List.copyOf(out);
    }

    private InicialDocumentoPessoaResponse toResponse(PessoaP7sDriveItem item, PessoaContexto ctx) {
        return new InicialDocumentoPessoaResponse(
                item.p7sDriveFileId(),
                ctx.pessoaId(),
                ctx.nomeExibicao(),
                item.tipoPasta(),
                item.nomeArquivo(),
                ID_ARQUIVO_TIPO_OUTROS,
                ctx.origem());
    }

    static boolean ehPessoaJuridica(String cpfCnpj) {
        if (!StringUtils.hasText(cpfCnpj)) {
            return false;
        }
        String digitos = cpfCnpj.replaceAll("\\D", "");
        return digitos.length() == 14;
    }

    record PessoaContexto(Long pessoaId, String nome, String origem) {
        String nomeExibicao() {
            return StringUtils.hasText(nome) ? nome.trim() : "Pessoa " + pessoaId;
        }
    }
}
