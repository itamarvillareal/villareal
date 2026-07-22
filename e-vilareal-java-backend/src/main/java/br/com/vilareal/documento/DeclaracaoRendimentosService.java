package br.com.vilareal.documento;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.tema.DocumentoTemaResolver;
import br.com.vilareal.documento.tema.TemaDocumento;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class DeclaracaoRendimentosService {

    private static final String TEMPLATE = "documentos/declaracao-rendimentos";
    private static final String CIDADE_ESTADO_PADRAO = "Anápolis, estado de Goiás";

    private static final String TRECHO_COM_ATIVIDADE =
            "que, embora possuo atividade remunerada, não disponho de recursos financeiros suficientes "
                    + "para prover as custas processuais e emolumentos cartorários, sem prejuízo para "
                    + "manutenção própria e de minha família.";

    private static final String TRECHO_SEM_ATIVIDADE =
            "que não exerço atividade remunerada e não disponho de recursos financeiros suficientes "
                    + "para prover as custas processuais e emolumentos cartorários, sem prejuízo para "
                    + "manutenção própria e de minha família.";

    private final DocumentoPdfService pdfService;
    private final PessoaRepository pessoaRepository;
    private final ProcessoParteRepository processoParteRepository;
    private final QualificacaoPessoaUtil qualificacaoPessoaUtil;
    private final DocumentoTemaResolver temaResolver;

    public DeclaracaoRendimentosService(
            DocumentoPdfService pdfService,
            PessoaRepository pessoaRepository,
            ProcessoParteRepository processoParteRepository,
            QualificacaoPessoaUtil qualificacaoPessoaUtil,
            DocumentoTemaResolver temaResolver) {
        this.pdfService = pdfService;
        this.pessoaRepository = pessoaRepository;
        this.processoParteRepository = processoParteRepository;
        this.qualificacaoPessoaUtil = qualificacaoPessoaUtil;
        this.temaResolver = temaResolver;
    }

    @Transactional(readOnly = true)
    public byte[] gerar(DeclaracaoRendimentosRequest request) {
        if (request == null || request.pessoaId() == null) {
            throw new IllegalArgumentException("pessoaId é obrigatório");
        }
        if (request.exerceAtividadeRemunerada() == null) {
            throw new IllegalArgumentException("exerceAtividadeRemunerada é obrigatório");
        }

        Long pessoaId = request.pessoaId();
        PessoaEntity pessoa = pessoaRepository.findById(pessoaId)
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + pessoaId));

        String qualificacaoHtml = resolverQualificacaoDeclarante(pessoaId, request.processoId());
        String qualificacao = qualificacaoProcuracaoParaTextoPlano(qualificacaoHtml);
        String nomeDeclarante = pessoa.getNome() != null ? pessoa.getNome().trim().toUpperCase(Locale.ROOT) : "";
        String cpfDeclarante = QualificacaoPessoaUtil.formatarCpf(pessoa.getCpf());

        LocalDate data = request.data() != null ? request.data() : LocalDate.now();
        String cidadeEstado = request.cidadeEstado() != null && !request.cidadeEstado().isBlank()
                ? request.cidadeEstado().trim()
                : CIDADE_ESTADO_PADRAO;
        String localData = pdfService.montarLocalData(cidadeEstado, data);
        String trechoAtividade =
                Boolean.TRUE.equals(request.exerceAtividadeRemunerada()) ? TRECHO_COM_ATIVIDADE : TRECHO_SEM_ATIVIDADE;

        Map<String, Object> variables = new HashMap<>();
        variables.put("qualificacaoDeclarante", qualificacao);
        variables.put("trechoAtividadeRemunerada", trechoAtividade);
        variables.put("nomeDeclarante", nomeDeclarante);
        variables.put("cpfDeclarante", cpfDeclarante);
        variables.put("localData", localData);

        TemaDocumento tema = temaResolver.resolverPorProcessoId(request.processoId());
        return pdfService.gerarPdfDeTemplate(TEMPLATE, variables, tema);
    }

    static String qualificacaoProcuracaoParaTextoPlano(String html) {
        if (html == null || html.isBlank()) {
            return "";
        }
        return html.replaceAll("(?i)</?strong>", "")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .trim();
    }

    private String resolverQualificacaoDeclarante(Long pessoaId, Long processoId) {
        if (processoId != null) {
            List<ProcessoParteEntity> partes =
                    processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(processoId);
            for (ProcessoParteEntity parte : partes) {
                if (parte.getPessoa() != null && pessoaId.equals(parte.getPessoa().getId())) {
                    return qualificacaoPessoaUtil.gerarQualificacaoProcuracaoPorProcessoParte(parte);
                }
            }
        }
        return qualificacaoPessoaUtil.gerarQualificacaoProcuracaoPorPessoaId(pessoaId);
    }
}
