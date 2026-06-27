package br.com.vilareal.documento;

import br.com.vilareal.documento.tema.DocumentoTemaResolver;
import br.com.vilareal.documento.tema.TemaDocumento;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ContratoAluguelService {

    private static final String TEMPLATE_CONTRATO = "documentos/contrato-aluguel";
    private static final String CIDADE_ESTADO_PADRAO = "Anápolis, estado de Goiás";

    private final DocumentoPdfService pdfService;
    private final ContratoPartesProcessoResolver partesProcessoResolver;
    private final DocumentoTemaResolver temaResolver;

    public ContratoAluguelService(
            DocumentoPdfService pdfService,
            ContratoPartesProcessoResolver partesProcessoResolver,
            DocumentoTemaResolver temaResolver) {
        this.pdfService = pdfService;
        this.partesProcessoResolver = partesProcessoResolver;
        this.temaResolver = temaResolver;
    }

    @Transactional(readOnly = true)
    public byte[] gerarContrato(ContratoAluguelRequest request) {
        if (request == null || request.processoId() == null) {
            throw new IllegalArgumentException("processoId é obrigatório");
        }

        ContratoPartesProcessoResolver.PartesContratoAluguel partes =
                partesProcessoResolver.resolverPartesAluguel(request.processoId());

        String qualificacaoLocador = partes.qualificacoesLocador().stream()
                .map(QualificacaoPessoaUtil::semVirgulaFinal)
                .collect(Collectors.joining(", e "));
        String qualificacaoLocatario = partes.qualificacoesLocatario().stream()
                .map(QualificacaoPessoaUtil::semVirgulaFinal)
                .collect(Collectors.joining(", e "));
        String preambuloHtml = LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao(
                QualificacaoPessoaUtil.montarPreambuloContratoAluguel(
                        qualificacaoLocador, qualificacaoLocatario, partes.nomesLocatario().size() > 1));

        List<String> clausulas = ContratoAluguelClausulas.montarClausulas();

        LocalDate data = request.data() != null ? request.data() : LocalDate.now();
        String cidadeEstado = request.cidadeEstado() != null && !request.cidadeEstado().isBlank()
                ? request.cidadeEstado().trim()
                : CIDADE_ESTADO_PADRAO;
        String localData = pdfService.montarLocalData(cidadeEstado, data);

        TemaDocumento tema = temaResolver.resolverPorProcessoId(request.processoId());

        Map<String, Object> variables = new HashMap<>();
        variables.put("preambuloHtml", preambuloHtml);
        variables.put("clausulas", clausulas);
        variables.put("fechoHtml", ContratoFechoTexto.montarFechoAluguel(
                ContratoFormaAssinatura.resolver(request.formaAssinatura())));
        variables.put("localData", localData);
        variables.put(
                "linhasAssinatura",
                ContratoLocacaoAssinaturaUtil.montarVariaveisLinhasAssinaturaLocadorLocatario(
                        partes.nomesLocador(), partes.nomesLocatario()));
        variables.put("temFiadores", false);
        variables.put("fiadorAssinaturas", List.of());

        return pdfService.gerarPdfDeTemplate(TEMPLATE_CONTRATO, variables, tema);
    }
}
