package br.com.vilareal.documento;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.documento.tema.DocumentoTemaResolver;
import br.com.vilareal.documento.tema.TemaDocumento;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.topicos.application.TopicoProcessadorService;
import br.com.vilareal.topicos.infrastructure.persistence.entity.TopicoEntity;
import br.com.vilareal.topicos.infrastructure.persistence.repository.TopicoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ContratoLocacaoDocumentoService {

    private static final String TEMPLATE_CONTRATO = "documentos/contrato-aluguel";
    private static final String CIDADE_ESTADO_PADRAO = "Anápolis, estado de Goiás";
    private static final String VARIANTE_PADRAO = "GERAL - Multa fixa";

    private final DocumentoPdfService pdfService;
    private final DocumentoTemaResolver temaResolver;
    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final TopicoRepository topicoRepository;
    private final TopicoProcessadorService topicoProcessadorService;
    private final QualificacaoPessoaUtil qualificacaoPessoaUtil;

    public ContratoLocacaoDocumentoService(
            DocumentoPdfService pdfService,
            DocumentoTemaResolver temaResolver,
            ContratoLocacaoRepository contratoLocacaoRepository,
            TopicoRepository topicoRepository,
            TopicoProcessadorService topicoProcessadorService,
            QualificacaoPessoaUtil qualificacaoPessoaUtil) {
        this.pdfService = pdfService;
        this.temaResolver = temaResolver;
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.topicoRepository = topicoRepository;
        this.topicoProcessadorService = topicoProcessadorService;
        this.qualificacaoPessoaUtil = qualificacaoPessoaUtil;
    }

    @Transactional(readOnly = true)
    public byte[] gerarContrato(ContratoLocacaoRequest request) {
        if (request == null || request.contratoLocacaoId() == null) {
            throw new IllegalArgumentException("contratoLocacaoId é obrigatório");
        }
        ContratoLocacaoEntity contrato = contratoLocacaoRepository
                .findById(request.contratoLocacaoId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Contrato de locação não encontrado: " + request.contratoLocacaoId()));

        PessoaEntity locador = contrato.getLocadorPessoa();
        PessoaEntity inquilino = contrato.getInquilinoPessoa();
        if (locador == null || locador.getId() == null) {
            throw new BusinessRuleException("Cadastre o locador (proprietário) no imóvel antes de gerar o contrato.");
        }
        if (inquilino == null || inquilino.getId() == null) {
            throw new BusinessRuleException("Cadastre o locatário (inquilino) no imóvel antes de gerar o contrato.");
        }

        String variante = StringUtils.hasText(request.variante()) ? request.variante().trim() : VARIANTE_PADRAO;
        String chave = TopicoChaveLocacaoUtil.resolverChaveExistente(topicoRepository, variante)
                .orElseThrow(() -> new BusinessRuleException(
                        "Modelo de contrato não encontrado para a variante: " + variante));

        List<TopicoEntity> blocos = topicoRepository.findByChaveNavegacaoAndAtivoTrueOrderByBlocoIndiceAsc(chave);
        if (blocos.isEmpty()) {
            throw new BusinessRuleException("Nenhum bloco ativo encontrado para o modelo: " + variante);
        }

        LocalDate data = request.data() != null ? request.data() : LocalDate.now();
        Map<String, String> parametros = montarParametros(contrato, data);

        List<String> clausulasHtml = new ArrayList<>();
        String preambuloHtml = "";
        for (TopicoEntity bloco : blocos) {
            TopicoProcessadorService.ResultadoProcessamento proc =
                    topicoProcessadorService.processarTemplateLocacao(
                            bloco.getConteudoTemplate(), locador.getId(), inquilino.getId(), parametros);
            String texto = proc.texto();
            if (!StringUtils.hasText(texto)) {
                continue;
            }
            String html = textoProcessadoParaHtml(texto);
            if (!StringUtils.hasText(preambuloHtml) && parecePreambulo(texto)) {
                preambuloHtml = html;
            } else {
                clausulasHtml.add(html);
            }
        }
        if (!StringUtils.hasText(preambuloHtml) && !clausulasHtml.isEmpty()) {
            preambuloHtml = clausulasHtml.remove(0);
        }
        if (clausulasHtml.isEmpty() && !StringUtils.hasText(preambuloHtml)) {
            throw new BusinessRuleException("O modelo selecionado não produziu texto após processar os dados do imóvel.");
        }

        String qualificacaoLocador =
                qualificacaoPessoaUtil.gerarQualificacaoContratoContratantePorPessoaId(locador.getId());
        String qualificacaoLocatario =
                qualificacaoPessoaUtil.gerarQualificacaoContratoContratantePorPessoaId(inquilino.getId());
        if (!StringUtils.hasText(preambuloHtml)) {
            preambuloHtml = QualificacaoPessoaUtil.montarPreambuloContratoAluguel(
                    qualificacaoLocador, qualificacaoLocatario);
        }

        String nomeLocador = ContratoHonorariosClausulas.normalizarNomeAssinatura(
                Utf8MojibakeUtil.corrigir(locador.getNome()));
        String nomeLocatario = ContratoHonorariosClausulas.normalizarNomeAssinatura(
                Utf8MojibakeUtil.corrigir(inquilino.getNome()));

        String cidadeEstado = StringUtils.hasText(request.cidadeEstado())
                ? request.cidadeEstado().trim()
                : CIDADE_ESTADO_PADRAO;
        String localData = pdfService.montarLocalData(cidadeEstado, data);

        TemaDocumento tema = resolverTema(contrato.getImovel());

        Map<String, Object> variables = new HashMap<>();
        variables.put("preambuloHtml", preambuloHtml);
        variables.put("clausulas", clausulasHtml);
        variables.put(
                "fechoHtml",
                ContratoFechoTexto.montarFechoAluguel(ContratoFormaAssinatura.resolver(request.formaAssinatura())));
        variables.put("localData", localData);
        variables.put("nomeLocador", nomeLocador);
        variables.put("nomeLocatario", nomeLocatario);

        return pdfService.gerarPdfDeTemplate(TEMPLATE_CONTRATO, variables, tema);
    }

    private TemaDocumento resolverTema(ImovelEntity imovel) {
        if (imovel != null && imovel.getProcesso() != null) {
            ProcessoEntity proc = imovel.getProcesso();
            if (proc.getId() != null) {
                return temaResolver.resolverPorProcessoId(proc.getId());
            }
        }
        return temaResolver.resolverSemProcesso();
    }

    private static Map<String, String> montarParametros(ContratoLocacaoEntity contrato, LocalDate data) {
        Map<String, String> params = new HashMap<>();
        params.put("data", data.toString());
        if (contrato.getDataInicio() != null) {
            params.put("dataInicio", contrato.getDataInicio().toString());
        }
        if (contrato.getDataFim() != null) {
            params.put("dataFim", contrato.getDataFim().toString());
        }
        BigDecimal valor = contrato.getValorAluguel();
        if (valor != null) {
            String br = valor.setScale(2, java.math.RoundingMode.HALF_UP)
                    .toPlainString()
                    .replace('.', ',');
            params.put("valorAluguel", br);
            params.put("valorCausa", br);
        }
        if (contrato.getValorGarantia() != null) {
            params.put(
                    "valorGarantia",
                    contrato.getValorGarantia()
                            .setScale(2, java.math.RoundingMode.HALF_UP)
                            .toPlainString()
                            .replace('.', ','));
        }
        if (contrato.getDiaVencimentoAluguel() != null) {
            params.put("diaVencimentoAluguel", String.valueOf(contrato.getDiaVencimentoAluguel()));
        }
        if (StringUtils.hasText(contrato.getGarantiaTipo())) {
            params.put("garantiaTipo", contrato.getGarantiaTipo().trim());
        }
        ImovelEntity im = contrato.getImovel();
        if (im != null) {
            if (StringUtils.hasText(im.getEnderecoCompleto())) {
                params.put("endereco", im.getEnderecoCompleto().trim());
            }
            if (StringUtils.hasText(im.getUnidade())) {
                params.put("unidade", im.getUnidade().trim());
            }
            if (StringUtils.hasText(im.getCondominio())) {
                params.put("condominio", im.getCondominio().trim());
            }
            if (StringUtils.hasText(im.getInscricaoImobiliaria())) {
                params.put("inscricaoImobiliaria", im.getInscricaoImobiliaria().trim());
            }
        }
        return params;
    }

    private static boolean parecePreambulo(String texto) {
        String t = texto.trim().toLowerCase();
        return t.contains("pelo presente instrumento") || t.contains("têm por justo e contratado");
    }

    static String textoProcessadoParaHtml(String texto) {
        if (!StringUtils.hasText(texto)) {
            return "";
        }
        String[] paragrafos = texto.trim().split("\\n{2,}");
        return java.util.Arrays.stream(paragrafos)
                .map(String::trim)
                .filter(StringUtils::hasText)
                .map(p -> escapeHtml(p).replace("\n", "<br/>"))
                .collect(Collectors.joining("<br/><br/>"));
    }

    private static String escapeHtml(String texto) {
        return texto
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
