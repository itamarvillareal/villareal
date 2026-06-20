package br.com.vilareal.documento;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.tema.DocumentoTemaResolver;
import br.com.vilareal.documento.tema.TemaDocumento;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ContratoHonorariosService {

    private static final String TEMPLATE_CONTRATO = "documentos/contrato-honorarios-advocaticios";
    private static final String CIDADE_ESTADO_PADRAO = "Anápolis, estado de Goiás";
    private static final String PREFIXO_CLAUSULA_3 = "Cláusula 3ª. ";

    private final DocumentoPdfService pdfService;
    private final PessoaRepository pessoaRepository;
    private final QualificacaoPessoaUtil qualificacaoPessoaUtil;
    private final DocumentoTemaResolver temaResolver;
    private final ContratoHonorariosPersistenciaService persistenciaService;
    private final ContratoContratanteFlexaoResolver flexaoContratanteResolver;

    public ContratoHonorariosService(
            DocumentoPdfService pdfService,
            PessoaRepository pessoaRepository,
            QualificacaoPessoaUtil qualificacaoPessoaUtil,
            DocumentoTemaResolver temaResolver,
            ContratoHonorariosPersistenciaService persistenciaService,
            ContratoContratanteFlexaoResolver flexaoContratanteResolver) {
        this.pdfService = pdfService;
        this.pessoaRepository = pessoaRepository;
        this.qualificacaoPessoaUtil = qualificacaoPessoaUtil;
        this.temaResolver = temaResolver;
        this.persistenciaService = persistenciaService;
        this.flexaoContratanteResolver = flexaoContratanteResolver;
    }

    @Transactional
    public byte[] gerarContrato(ContratoHonorariosRequest request) {
        if (request == null || request.pessoaId() == null) {
            throw new IllegalArgumentException("pessoaId é obrigatório");
        }
        ContratoHonorariosConteudoPreview conteudo = request.conteudoEditado() != null
                ? request.conteudoEditado()
                : montarConteudoPreview(request);
        byte[] pdf = gerarPdfFromConteudo(conteudo, request.processoId());

        if (devePersistir(request)) {
            ContratoContratanteFlexao flexao =
                    flexaoContratanteResolver.resolver(request.pessoaId(), request.contratantePessoaIds());
            String clausula3Texto = extrairClausula3Texto(conteudo, request, flexao);
            persistenciaService.registrarContratoGerado(request, clausula3Texto, request.clausula3Dados());
        }

        return pdf;
    }

    @Transactional(readOnly = true)
    public ContratoHonorariosConteudoPreview montarConteudoPreview(ContratoHonorariosRequest request) {
        if (request == null || request.pessoaId() == null) {
            throw new IllegalArgumentException("pessoaId é obrigatório");
        }
        Long pessoaId = request.pessoaId();
        PessoaEntity pessoa = pessoaRepository.findById(pessoaId)
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + pessoaId));

        ContratoContratanteFlexao flexao =
                flexaoContratanteResolver.resolver(pessoaId, request.contratantePessoaIds());
        String clausula3Texto = resolverClausula3Texto(request, flexao);

        String qualificacaoContratante = qualificacaoPessoaUtil.gerarQualificacaoContratoContratantePorPessoaId(pessoaId);
        String qualificacaoContratado = QualificacaoPessoaUtil.montarQualificacaoContratoContratado(
                ContratoAdvogadoPadrao.NOME, ContratoAdvogadoPadrao.OAB);

        LocalDate data = request.data() != null ? request.data() : LocalDate.now();
        String cidadeEstado = request.cidadeEstado() != null && !request.cidadeEstado().isBlank()
                ? request.cidadeEstado().trim()
                : CIDADE_ESTADO_PADRAO;

        return new ContratoHonorariosConteudoPreview(
                QualificacaoPessoaUtil.montarPreambuloContratoHonorarios(qualificacaoContratante, qualificacaoContratado),
                ContratoHonorariosClausulas.montarClausulas(request.objetoContrato(), clausula3Texto),
                ContratoFechoTexto.montarFechoHonorarios(ContratoFormaAssinatura.resolver(request.formaAssinatura())),
                pdfService.montarLocalData(cidadeEstado, data),
                ContratoHonorariosClausulas.normalizarNomeAssinatura(pessoa.getNome()),
                ContratoHonorariosClausulas.normalizarNomeAssinatura(
                        extrairNomeAdvogadoSemTitulo(ContratoAdvogadoPadrao.NOME)));
    }

    @Transactional(readOnly = true)
    public byte[] gerarPdfPreview(ContratoHonorariosPreviewPdfRequest request) {
        if (request == null || request.conteudo() == null) {
            throw new IllegalArgumentException("conteudo é obrigatório");
        }
        return gerarPdfFromConteudo(request.conteudo(), request.processoId());
    }

    private byte[] gerarPdfFromConteudo(ContratoHonorariosConteudoPreview conteudo, Long processoId) {
        TemaDocumento tema = temaResolver.resolverPorProcessoId(processoId);
        Map<String, Object> variables = new HashMap<>();
        variables.put("preambuloHtml", conteudo.preambuloHtml());
        variables.put("clausulas", conteudo.clausulas());
        variables.put("fechoHtml", conteudo.fechoHtml());
        variables.put("localData", conteudo.localData());
        variables.put("nomeContratante", conteudo.nomeContratante());
        variables.put("nomeContratado", conteudo.nomeContratado());
        return pdfService.gerarPdfDeTemplate(TEMPLATE_CONTRATO, variables, tema);
    }

    @Transactional(readOnly = true)
    public String montarClausula3Texto(ContratoHonorariosClausula3TextoRequest request) {
        if (request == null) {
            return ContratoHonorariosClausulas.CLAUSULA_3_PADRAO;
        }
        ContratoContratanteFlexao flexao =
                flexaoContratanteResolver.resolver(request.pessoaId(), request.contratantePessoaIds());
        return ContratoHonorariosClausula3TextoBuilder.montarTexto(request.dados(), flexao);
    }

    private static boolean devePersistir(ContratoHonorariosRequest request) {
        if (request.clausula3Dados() == null) {
            return false;
        }
        if (request.persistirDados() != null) {
            return request.persistirDados();
        }
        return true;
    }

    private static String resolverClausula3Texto(
            ContratoHonorariosRequest request, ContratoContratanteFlexao flexaoContratante) {
        if (request.clausula3Dados() != null) {
            return ContratoHonorariosClausula3TextoBuilder.montarTexto(request.clausula3Dados(), flexaoContratante);
        }
        if (StringUtils.hasText(request.clausula3Remuneracao())) {
            return request.clausula3Remuneracao().trim();
        }
        return ContratoHonorariosClausulas.CLAUSULA_3_PADRAO;
    }

    private static String extrairClausula3Texto(
            ContratoHonorariosConteudoPreview conteudo,
            ContratoHonorariosRequest request,
            ContratoContratanteFlexao flexaoContratante) {
        if (conteudo != null && conteudo.clausulas() != null && conteudo.clausulas().size() > 2) {
            String clausula3 = conteudo.clausulas().get(2);
            if (StringUtils.hasText(clausula3) && clausula3.startsWith(PREFIXO_CLAUSULA_3)) {
                return clausula3.substring(PREFIXO_CLAUSULA_3.length()).trim();
            }
        }
        return resolverClausula3Texto(request, flexaoContratante);
    }

    private static String extrairNomeAdvogadoSemTitulo(String advogadoNome) {
        if (advogadoNome == null || advogadoNome.isBlank()) {
            return "";
        }
        String nome = advogadoNome.trim();
        if (nome.regionMatches(true, 0, "Dr. ", 0, 4)) {
            return nome.substring(4).trim();
        }
        if (nome.regionMatches(true, 0, "Dra. ", 0, 5)) {
            return nome.substring(5).trim();
        }
        return nome;
    }
}
