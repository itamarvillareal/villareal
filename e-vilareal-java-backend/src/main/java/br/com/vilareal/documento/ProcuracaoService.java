package br.com.vilareal.documento;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.tema.DocumentoTemaResolver;
import br.com.vilareal.documento.tema.TemaDocumento;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

@Service
public class ProcuracaoService {

    private static final String TEMPLATE_PROCURACAO = "documentos/procuracao-ad-judicia";
    private static final String CIDADE_ESTADO_PADRAO = "Anápolis, estado de Goiás";

    private final DocumentoPdfService pdfService;
    private final PessoaRepository pessoaRepository;
    private final QualificacaoPessoaUtil qualificacaoPessoaUtil;
    private final DocumentoTemaResolver temaResolver;

    public ProcuracaoService(
            DocumentoPdfService pdfService,
            PessoaRepository pessoaRepository,
            QualificacaoPessoaUtil qualificacaoPessoaUtil,
            DocumentoTemaResolver temaResolver) {
        this.pdfService = pdfService;
        this.pessoaRepository = pessoaRepository;
        this.qualificacaoPessoaUtil = qualificacaoPessoaUtil;
        this.temaResolver = temaResolver;
    }

    @Transactional(readOnly = true)
    public byte[] gerarProcuracao(ProcuracaoRequest request) {
        if (request == null || request.pessoaId() == null) {
            throw new IllegalArgumentException("pessoaId é obrigatório");
        }
        Long pessoaId = request.pessoaId();
        PessoaEntity pessoa = pessoaRepository.findById(pessoaId)
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + pessoaId));

        String qualificacao = qualificacaoPessoaUtil.gerarQualificacaoProcuracaoPorPessoaId(pessoaId);
        String nomeOutorgante = pessoa.getNome() != null ? pessoa.getNome().trim().toUpperCase(Locale.ROOT) : "";
        String cpfOutorgante = QualificacaoPessoaUtil.formatarCpf(pessoa.getCpf());

        LocalDate data = request.data() != null ? request.data() : LocalDate.now();
        String cidadeEstado = request.cidadeEstado() != null && !request.cidadeEstado().isBlank()
                ? request.cidadeEstado().trim()
                : CIDADE_ESTADO_PADRAO;
        String localData = pdfService.montarLocalData(cidadeEstado, data);

        Map<String, Object> variables = new HashMap<>();
        variables.put("qualificacaoOutorgante", qualificacao);
        variables.put("nomeOutorgante", nomeOutorgante);
        variables.put("cpfOutorgante", cpfOutorgante);
        variables.put("localData", localData);

        TemaDocumento tema = temaResolver.resolverPorProcessoId(request.processoId());
        return pdfService.gerarPdfDeTemplate(TEMPLATE_PROCURACAO, variables, tema);
    }
}
