package br.com.vilareal.projudi.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.documento.TipoDocumentoPessoa;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaDocumentoDriveEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaDocumentoDriveRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.projudi.api.dto.InicialDocumentoPessoaResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Documentos constitutivos (.p7s) na pasta {@code Pessoas/{id8}/…} para instruir a inicial,
 * separados dos documentos específicos do processo (pasta «Assinar»).
 */
@Service
public class ProjudiInicialDocumentosPessoaService {

    /** PROJUDI: 16 = Petição (reservado à peça inicial do processo). Demais = Outros (1). */
    static final int ID_ARQUIVO_TIPO_OUTROS = 1;

    private final PessoaRepository pessoaRepository;
    private final PessoaDocumentoDriveRepository documentoRepository;
    private final GoogleDriveService googleDriveService;

    public ProjudiInicialDocumentosPessoaService(
            PessoaRepository pessoaRepository,
            PessoaDocumentoDriveRepository documentoRepository,
            GoogleDriveService googleDriveService) {
        this.pessoaRepository = pessoaRepository;
        this.documentoRepository = documentoRepository;
        this.googleDriveService = googleDriveService;
    }

    @Transactional(readOnly = true)
    public List<InicialDocumentoPessoaResponse> listarConstitutivos(Long pessoaIdAutor) {
        if (pessoaIdAutor == null || pessoaIdAutor < 1) {
            throw new IllegalArgumentException("pessoaIdAutor é obrigatório.");
        }
        List<PessoaContexto> pessoas = resolverPessoasContexto(pessoaIdAutor);
        List<InicialDocumentoPessoaResponse> out = new ArrayList<>();
        for (PessoaContexto ctx : pessoas) {
            List<PessoaDocumentoDriveEntity> docs =
                    documentoRepository.findByPessoaIdAndP7sDriveFileIdIsNotNullOrderByCreatedAtDescIdDesc(
                            ctx.pessoaId());
            for (PessoaDocumentoDriveEntity doc : docs) {
                out.add(toResponse(doc, ctx));
            }
        }
        out.sort(Comparator.comparingInt(this::ordemTipo).thenComparing(InicialDocumentoPessoaResponse::nomeArquivo));
        return List.copyOf(out);
    }

    @Transactional(readOnly = true)
    public byte[] baixarP7s(Long documentoId, Long pessoaIdAutor) {
        if (documentoId == null || pessoaIdAutor == null) {
            throw new IllegalArgumentException("documentoId e pessoaIdAutor são obrigatórios.");
        }
        PessoaDocumentoDriveEntity doc = documentoRepository
                .findById(documentoId)
                .orElseThrow(() -> new ResourceNotFoundException("Documento não encontrado: " + documentoId));
        Set<Long> pessoaIdsPermitidas =
                new LinkedHashSet<>(resolverPessoasContexto(pessoaIdAutor).stream().map(PessoaContexto::pessoaId).toList());
        if (!pessoaIdsPermitidas.contains(doc.getPessoaId())) {
            throw new BusinessRuleException("Documento não pertence ao autor ou representante desta inicial.");
        }
        if (!StringUtils.hasText(doc.getP7sDriveFileId())) {
            throw new BusinessRuleException("Documento sem .p7s no Drive.");
        }
        if (!googleDriveService.isConfigurado()) {
            throw new IllegalStateException("Google Drive não configurado.");
        }
        try {
            return googleDriveService.baixarBytesArquivo(doc.getP7sDriveFileId());
        } catch (Exception e) {
            throw new BusinessRuleException("Falha ao baixar .p7s do Drive: " + e.getMessage());
        }
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

    private InicialDocumentoPessoaResponse toResponse(PessoaDocumentoDriveEntity doc, PessoaContexto ctx) {
        return new InicialDocumentoPessoaResponse(
                doc.getId(),
                doc.getPessoaId(),
                ctx.nomeExibicao(),
                doc.getTipo(),
                doc.getNomeArquivo(),
                ID_ARQUIVO_TIPO_OUTROS,
                ctx.origem());
    }

    private int ordemTipo(InicialDocumentoPessoaResponse doc) {
        try {
            TipoDocumentoPessoa tipo = TipoDocumentoPessoa.valueOf(doc.tipo());
            return switch (tipo) {
                case PROCURACOES -> 1;
                case CONTRATOS -> 2;
                case DECLARACOES -> 3;
                case DOCUMENTOS -> 4;
                case ASSINADOS -> 5;
            };
        } catch (Exception e) {
            return 99;
        }
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
