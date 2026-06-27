package br.com.vilareal.documento;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.documento.tema.DocumentoTemaResolver;
import br.com.vilareal.documento.tema.TemaDocumento;
import br.com.vilareal.imovel.application.ContratoLocacaoFiadorSupport;
import br.com.vilareal.imovel.application.ContratoLocacaoInquilinoResolver;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
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
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class ContratoLocacaoDocumentoService {

    private static final String TEMPLATE_CONTRATO = "documentos/contrato-aluguel";
    private static final String CIDADE_ESTADO_PADRAO = "Anápolis, estado de Goiás";
    private static final String VARIANTE_PADRAO = "GERAL - Multa fixa";
    private static final Pattern URL_HTTP = Pattern.compile("(https?://\\S+)");

    private final DocumentoPdfService pdfService;
    private final DocumentoTemaResolver temaResolver;
    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final PessoaRepository pessoaRepository;
    private final TopicoRepository topicoRepository;
    private final TopicoProcessadorService topicoProcessadorService;
    private final QualificacaoPessoaUtil qualificacaoPessoaUtil;
    private final ContratoLocacaoInquilinoResolver inquilinoResolver;

    public ContratoLocacaoDocumentoService(
            DocumentoPdfService pdfService,
            DocumentoTemaResolver temaResolver,
            ContratoLocacaoRepository contratoLocacaoRepository,
            PessoaRepository pessoaRepository,
            TopicoRepository topicoRepository,
            TopicoProcessadorService topicoProcessadorService,
            QualificacaoPessoaUtil qualificacaoPessoaUtil,
            ContratoLocacaoInquilinoResolver inquilinoResolver) {
        this.pdfService = pdfService;
        this.temaResolver = temaResolver;
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.pessoaRepository = pessoaRepository;
        this.topicoRepository = topicoRepository;
        this.topicoProcessadorService = topicoProcessadorService;
        this.qualificacaoPessoaUtil = qualificacaoPessoaUtil;
        this.inquilinoResolver = inquilinoResolver;
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
        if (locador == null || locador.getId() == null) {
            throw new BusinessRuleException("Cadastre o locador (proprietário) no imóvel antes de gerar o contrato.");
        }
        List<Long> locatariosPessoaIds =
                inquilinoResolver.resolverLocatariosPessoaIds(contrato, request.inquilinosPessoaIds());
        if (locatariosPessoaIds.isEmpty()) {
            throw new BusinessRuleException("Cadastre o locatário (inquilino) no imóvel antes de gerar o contrato.");
        }
        List<PessoaEntity> locatarios = carregarPessoasPorIds(locatariosPessoaIds);
        if (locatarios.isEmpty()) {
            throw new BusinessRuleException("Cadastre o locatário (inquilino) no imóvel antes de gerar o contrato.");
        }
        boolean pluralLocatarios = locatarios.size() > 1;

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
        parametros.put("quantidadeLocatarios", String.valueOf(locatariosPessoaIds.size()));
        List<Long> fiadoresPessoaIds = ContratoLocacaoFiadorSupport.extrairPessoaIds(contrato.getFiadoresJson());
        List<PessoaEntity> fiadores = ContratoLocacaoFiadorSupport.carregarFiadores(contrato, pessoaRepository);
        boolean temFiadores = !fiadores.isEmpty();

        String tituloContrato = ContratoLocacaoBlocoUtil.tituloPadrao();
        List<String> clausulasHtml = new ArrayList<>();
        String preambuloHtml = "";
        int numeroClausula = 0;
        StringBuilder clausulaTextoAtual = null;
        Integer numeroClausulaAtual = null;

        for (TopicoEntity bloco : blocos) {
            String template = bloco.getConteudoTemplate();
            if (!StringUtils.hasText(template)) {
                continue;
            }
            if (ContratoLocacaoBlocoUtil.isCentral(template)) {
                tituloContrato = ContratoLocacaoBlocoUtil.extrairTituloCentral(template);
                continue;
            }
            if (ContratoLocacaoBlocoUtil.isCabecalhoFecho(template)
                    || ContratoLocacaoBlocoUtil.isCabecalhoMetadados(template)
                    || ContratoLocacaoBlocoUtil.isBlocoPreambuloInstrumento(template)) {
                continue;
            }
            if (!temFiadores && ContratoLocacaoBlocoUtil.pareceClausulaFiador(template, bloco)) {
                continue;
            }

            TopicoProcessadorService.ResultadoProcessamento proc =
                    topicoProcessadorService.processarTemplateLocacao(
                            template, locador.getId(), locatariosPessoaIds, fiadoresPessoaIds, parametros);
            String texto = ContratoLocacaoBlocoUtil.limparMetadadosFormato(proc.texto());
            texto = LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao(texto);
            if (!StringUtils.hasText(texto)) {
                continue;
            }

            if (ContratoLocacaoBlocoUtil.isParagrafoClausula(template, bloco)) {
                if (clausulaTextoAtual != null) {
                    clausulaTextoAtual.append('\n').append(texto.trim());
                } else {
                    numeroClausula++;
                    numeroClausulaAtual = numeroClausula;
                    clausulaTextoAtual = new StringBuilder(texto.trim());
                }
                continue;
            }

            if (ContratoLocacaoBlocoUtil.isClausulaPrincipal(template, bloco)) {
                adicionarClausulaHtml(clausulasHtml, clausulaTextoAtual, numeroClausulaAtual);
                clausulaTextoAtual = null;
                numeroClausulaAtual = null;
                numeroClausula++;
                numeroClausulaAtual = numeroClausula;
                clausulaTextoAtual = new StringBuilder(texto.trim());
                continue;
            }

            if (clausulaTextoAtual != null) {
                clausulaTextoAtual.append('\n').append(texto.trim());
            } else {
                clausulasHtml.add(textoProcessadoParaHtml(texto));
            }
        }
        adicionarClausulaHtml(clausulasHtml, clausulaTextoAtual, numeroClausulaAtual);
        if (clausulasHtml.isEmpty()) {
            throw new BusinessRuleException("O modelo selecionado não produziu texto após processar os dados do imóvel.");
        }

        String qualificacaoLocador =
                qualificacaoPessoaUtil.gerarQualificacaoContratoLocacaoPorPessoaId(locador.getId());
        String qualificacaoLocatario = locatarios.stream()
                .map(p -> qualificacaoPessoaUtil.gerarQualificacaoContratoLocacaoPorPessoaId(p.getId()))
                .filter(StringUtils::hasText)
                .collect(Collectors.joining(", e "));
        String nomeLocador = ContratoHonorariosClausulas.normalizarNomeAssinatura(
                Utf8MojibakeUtil.corrigir(locador.getNome()));
        String nomeLocatario = locatarios.stream()
                .map(p -> ContratoHonorariosClausulas.normalizarNomeAssinatura(Utf8MojibakeUtil.corrigir(p.getNome())))
                .filter(StringUtils::hasText)
                .collect(Collectors.joining(" E "));
        preambuloHtml = textoProcessadoParaHtml(QualificacaoPessoaUtil.montarPreambuloContratoAluguel(
                qualificacaoLocador, qualificacaoLocatario, pluralLocatarios));
        if (temFiadores) {
            preambuloHtml = ContratoLocacaoPreambuloUtil.injetarFiadoresNoPreambuloHtml(
                    preambuloHtml, fiadores, qualificacaoPessoaUtil);
        }
        List<String> nomesNegrito = new ArrayList<>();
        nomesNegrito.add(nomeLocador);
        for (PessoaEntity locatario : locatarios) {
            if (locatario != null && StringUtils.hasText(locatario.getNome())) {
                nomesNegrito.add(Utf8MojibakeUtil.corrigir(locatario.getNome()));
            }
        }
        for (PessoaEntity fiador : fiadores) {
            if (fiador != null && StringUtils.hasText(fiador.getNome())) {
                nomesNegrito.add(Utf8MojibakeUtil.corrigir(fiador.getNome()));
            }
        }
        preambuloHtml = ContratoLocacaoNegritoUtil.aplicarNegritoNomesCompletos(
                preambuloHtml, nomesNegrito.toArray(String[]::new));

        String cidadeEstado = StringUtils.hasText(request.cidadeEstado())
                ? request.cidadeEstado().trim()
                : CIDADE_ESTADO_PADRAO;
        String localData = pdfService.montarLocalData(cidadeEstado, data);

        TemaDocumento tema = resolverTema(contrato.getImovel());

        Map<String, Object> variables = new HashMap<>();
        variables.put("tituloContrato", tituloContrato);
        variables.put("preambuloHtml", preambuloHtml);
        variables.put("clausulas", clausulasHtml);
        variables.put(
                "fechoHtml",
                ContratoFechoTexto.montarFechoAluguel(ContratoFormaAssinatura.resolver(request.formaAssinatura())));
        variables.put("localData", localData);
        variables.put("nomeLocador", nomeLocador);
        variables.put("nomeLocatario", nomeLocatario);
        variables.put("rotuloLocatario", pluralLocatarios ? "Locatários" : "Locatário");
        variables.put("temFiadores", temFiadores);
        variables.put("fiadorAssinaturas", ContratoLocacaoAssinaturaUtil.montarVariaveisAssinaturaFiadores(fiadores));

        return pdfService.gerarPdfDeTemplate(TEMPLATE_CONTRATO, variables, tema);
    }

    private List<PessoaEntity> carregarPessoasPorIds(List<Long> pessoaIds) {
        List<PessoaEntity> out = new ArrayList<>();
        if (pessoaIds == null) {
            return out;
        }
        for (Long id : pessoaIds) {
            if (id == null || id < 1) {
                continue;
            }
            pessoaRepository.findById(id).ifPresent(out::add);
        }
        return out;
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
            if (StringUtils.hasText(im.getGaragens())) {
                params.put("garagens", im.getGaragens().trim());
            }
            if (StringUtils.hasText(im.getInscricaoImobiliaria())) {
                params.put("inscricaoImobiliaria", im.getInscricaoImobiliaria().trim());
            }
        }
        LocacaoTemplateLegadoSupport.registrarAliasesLegado(params, contrato, data);
        return params;
    }

    private static boolean parecePreambulo(String texto) {
        String t = texto.trim().toLowerCase(Locale.ROOT);
        return t.contains("pelo presente instrumento") || t.contains("têm por justo e contratado");
    }

    private static void adicionarClausulaHtml(
            List<String> clausulasHtml, StringBuilder clausulaTextoAtual, Integer numeroClausulaAtual) {
        if (clausulaTextoAtual == null || !StringUtils.hasText(clausulaTextoAtual)) {
            return;
        }
        int numero = numeroClausulaAtual != null ? numeroClausulaAtual : 0;
        String html = ContratoLocacaoBlocoUtil.prefixoClausulaHtml(numero)
                + textoProcessadoParaHtml(clausulaTextoAtual.toString());
        clausulasHtml.add(html);
    }

    static String textoProcessadoParaHtml(String texto) {
        if (!StringUtils.hasText(texto)) {
            return "";
        }
        String normalizado = texto.trim().replaceAll("\\n{2,}", "\n");
        return linkificarUrlsContrato(normalizado);
    }

    static String linkificarUrlsContrato(String texto) {
        Matcher matcher = URL_HTTP.matcher(texto);
        StringBuilder sb = new StringBuilder();
        int ultimo = 0;
        while (matcher.find()) {
            sb.append(escapeHtml(texto.substring(ultimo, matcher.start())));
            String url = removerPontuacaoFinalUrl(matcher.group(1));
            int fimUrl = matcher.start() + url.length();
            String urlEsc = escapeHtml(url);
            sb.append("<a href=\"")
                    .append(urlEsc)
                    .append("\" class=\"contrato-link\">")
                    .append(urlEsc)
                    .append("</a>");
            ultimo = fimUrl;
            matcher.region(fimUrl, texto.length());
        }
        sb.append(escapeHtml(texto.substring(ultimo)));
        return sb.toString();
    }

    private static String removerPontuacaoFinalUrl(String url) {
        if (!StringUtils.hasText(url)) {
            return "";
        }
        String u = url;
        while (!u.isEmpty() && ",.;:)".indexOf(u.charAt(u.length() - 1)) >= 0) {
            u = u.substring(0, u.length() - 1);
        }
        return u;
    }

    static String escapeHtml(String texto) {
        return texto
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
