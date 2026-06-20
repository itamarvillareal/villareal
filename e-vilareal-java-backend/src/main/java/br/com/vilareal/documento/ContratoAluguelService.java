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

        String qualificacaoLocador = String.join(", e ", partes.qualificacoesLocador());
        String qualificacaoLocatario = String.join(", e ", partes.qualificacoesLocatario());
        String preambuloHtml = QualificacaoPessoaUtil.montarPreambuloContratoAluguel(
                qualificacaoLocador, qualificacaoLocatario);

        List<String> clausulas = ContratoAluguelClausulas.montarClausulas();
        String nomeLocador = partes.nomesLocador().stream().collect(Collectors.joining(" E "));
        String nomeLocatario = partes.nomesLocatario().stream().collect(Collectors.joining(" E "));

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
        variables.put("nomeLocador", nomeLocador);
        variables.put("nomeLocatario", nomeLocatario);

        return pdfService.gerarPdfDeTemplate(TEMPLATE_CONTRATO, variables, tema);
    }
}
