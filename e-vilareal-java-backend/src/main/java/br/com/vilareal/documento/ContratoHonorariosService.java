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
        Long pessoaId = request.pessoaId();
        PessoaEntity pessoa = pessoaRepository.findById(pessoaId)
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + pessoaId));

        String clausula3Texto = resolverClausula3Texto(
                request, flexaoContratanteResolver.resolver(pessoaId, request.contratantePessoaIds()));

        TemaDocumento tema = temaResolver.resolverPorProcessoId(request.processoId());
        String qualificacaoContratante = qualificacaoPessoaUtil.gerarQualificacaoContratoContratantePorPessoaId(pessoaId);
        String qualificacaoContratado = QualificacaoPessoaUtil.montarQualificacaoContratoContratado(
                ContratoAdvogadoPadrao.NOME, ContratoAdvogadoPadrao.OAB);
        String preambuloHtml = QualificacaoPessoaUtil.montarPreambuloContratoHonorarios(
                qualificacaoContratante, qualificacaoContratado);
        List<String> clausulas = ContratoHonorariosClausulas.montarClausulas(
                request.objetoContrato(), clausula3Texto);

        String nomeContratante = ContratoHonorariosClausulas.normalizarNomeAssinatura(pessoa.getNome());
        String nomeContratado = ContratoHonorariosClausulas.normalizarNomeAssinatura(
                extrairNomeAdvogadoSemTitulo(ContratoAdvogadoPadrao.NOME));

        LocalDate data = request.data() != null ? request.data() : LocalDate.now();
        String cidadeEstado = request.cidadeEstado() != null && !request.cidadeEstado().isBlank()
                ? request.cidadeEstado().trim()
                : CIDADE_ESTADO_PADRAO;
        String localData = pdfService.montarLocalData(cidadeEstado, data);

        Map<String, Object> variables = new HashMap<>();
        variables.put("preambuloHtml", preambuloHtml);
        variables.put("clausulas", clausulas);
        variables.put("fechoHtml", ContratoFechoTexto.montarFechoHonorarios(
                ContratoFormaAssinatura.resolver(request.formaAssinatura())));
        variables.put("localData", localData);
        variables.put("nomeContratante", nomeContratante);
        variables.put("nomeContratado", nomeContratado);

        byte[] pdf = pdfService.gerarPdfDeTemplate(TEMPLATE_CONTRATO, variables, tema);

        if (devePersistir(request)) {
            persistenciaService.registrarContratoGerado(request, clausula3Texto, request.clausula3Dados());
        }

        return pdf;
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
