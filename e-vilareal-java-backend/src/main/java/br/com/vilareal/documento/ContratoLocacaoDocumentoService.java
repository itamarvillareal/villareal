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
        java.math.BigDecimal valorAluguelEfetivo = request.valorAluguelContrato() != null
                ? request.valorAluguelContrato()
                : contrato.getValorAluguel();
        Map<String, String> parametros = montarParametros(contrato, data, valorAluguelEfetivo);
        LocalDate vigenciaInicio =
                request.dataInicioContrato() != null ? request.dataInicioContrato() : contrato.getDataInicio();
        LocalDate vigenciaFim = request.dataFimContrato() != null ? request.dataFimContrato() : contrato.getDataFim();
        LocacaoTemplateLegadoSupport.aplicarVigenciaLocacao(parametros, vigenciaInicio, vigenciaFim);
        LocacaoTemplateLegadoSupport.aplicarValorLocacao(parametros, valorAluguelEfetivo);
        LocacaoTemplateLegadoSupport.aplicarLinkVistoria(parametros, resolverLinkVistoria(request, contrato));
        LocacaoTemplateLegadoSupport.aplicarDiaVencimento(parametros, resolverDiaVencimento(request, contrato));
        LocacaoTemplateLegadoSupport.aplicarFormaPagamentoAluguel(
                parametros, resolverFormaPagamentoAluguel(request, contrato));
        parametros.put("quantidadeLocatarios", String.valueOf(locatariosPessoaIds.size()));
        List<Long> fiadoresPessoaIds = ContratoLocacaoFiadorSupport.extrairPessoaIds(contrato.getFiadoresJson());
        List<PessoaEntity> fiadores = ContratoLocacaoFiadorSupport.carregarFiadores(contrato, pessoaRepository);
        boolean temFiadores = !fiadores.isEmpty();

        String tituloContrato = ContratoLocacaoBlocoUtil.tituloPadrao();
        List<String> clausulasHtml = new ArrayList<>();
        String preambuloPlain = "";
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
                    || ContratoLocacaoBlocoUtil.isCabecalhoMetadados(template)) {
                continue;
            }
            if (ContratoLocacaoBlocoUtil.isBlocoPreambuloInstrumento(template)) {
                TopicoProcessadorService.ResultadoProcessamento procPreambulo =
                        topicoProcessadorService.processarTemplateLocacao(
                                template, locador.getId(), locatariosPessoaIds, fiadoresPessoaIds, parametros);
                String textoPreambulo =
                        ContratoLocacaoBlocoUtil.limparMetadadosFormato(procPreambulo.texto());
                textoPreambulo = LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao(textoPreambulo);
                if (StringUtils.hasText(textoPreambulo)) {
                    preambuloPlain = textoPreambulo;
                }
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

        if (!StringUtils.hasText(preambuloPlain)) {
            preambuloPlain = montarPreambuloProgramatico(locador, locatarios, pluralLocatarios);
        }
        String nomeLocador = ContratoHonorariosClausulas.normalizarNomeAssinatura(
                Utf8MojibakeUtil.corrigir(locador.getNome()));
        String nomeLocatario = locatarios.stream()
                .map(p -> ContratoHonorariosClausulas.normalizarNomeAssinatura(Utf8MojibakeUtil.corrigir(p.getNome())))
                .filter(StringUtils::hasText)
                .collect(Collectors.joining(" E "));
        preambuloPlain = LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao(preambuloPlain);
        preambuloPlain = LocacaoConcordanciaReuUtil.aplicarConcordanciaLocatarioProcessado(
                preambuloPlain, locatarios.size(), inferirFemininoLocatarios(locatarios));
        preambuloHtml = textoProcessadoParaHtml(preambuloPlain);
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
        preambuloHtml = LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao(preambuloHtml);

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

    private static Map<String, String> montarParametros(
            ContratoLocacaoEntity contrato, LocalDate data, java.math.BigDecimal valorAluguel) {
        Map<String, String> params = new HashMap<>();
        params.put("data", data.toString());
        if (contrato.getDataInicio() != null) {
            params.put("dataInicio", contrato.getDataInicio().toString());
        }
        if (contrato.getDataFim() != null) {
            params.put("dataFim", contrato.getDataFim().toString());
        }
        java.math.BigDecimal valor = valorAluguel != null ? valorAluguel : contrato.getValorAluguel();
        if (valor != null) {
            String br = MoedaBrParser.formatDecimalBr(valor);
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

    private static String resolverLinkVistoria(ContratoLocacaoRequest request, ContratoLocacaoEntity contrato) {
        if (request != null && StringUtils.hasText(request.linkVistoria())) {
            return request.linkVistoria().trim();
        }
        if (contrato == null || contrato.getImovel() == null) {
            return "";
        }
        return LocacaoTemplateLegadoSupport.extrairLinkVistoriaImovel(contrato.getImovel());
    }

    private static Integer resolverDiaVencimento(ContratoLocacaoRequest request, ContratoLocacaoEntity contrato) {
        if (request != null && request.diaVencimentoAluguel() != null && request.diaVencimentoAluguel() >= 1) {
            return request.diaVencimentoAluguel();
        }
        if (contrato != null && contrato.getDiaVencimentoAluguel() != null) {
            return contrato.getDiaVencimentoAluguel();
        }
        return null;
    }

    private static String resolverFormaPagamentoAluguel(
            ContratoLocacaoRequest request, ContratoLocacaoEntity contrato) {
        if (request != null && StringUtils.hasText(request.formaPagamentoAluguel())) {
            return FormaPagamentoAluguelLocacao.normalizar(request.formaPagamentoAluguel());
        }
        if (contrato != null && StringUtils.hasText(contrato.getFormaPagamentoAluguel())) {
            return FormaPagamentoAluguelLocacao.normalizar(contrato.getFormaPagamentoAluguel());
        }
        return FormaPagamentoAluguelLocacao.PADRAO;
    }

    private String montarPreambuloProgramatico(
            PessoaEntity locador, List<PessoaEntity> locatarios, boolean pluralLocatarios) {
        String qualLocador = montarQualificacaoPreambuloParte(locador);
        String qualLocatario = locatarios.stream()
                .map(this::montarQualificacaoPreambuloParte)
                .filter(StringUtils::hasText)
                .collect(Collectors.joining(", e "));
        return QualificacaoPessoaUtil.montarPreambuloContratoAluguel(qualLocador, qualLocatario, pluralLocatarios);
    }

    /** Espelha o modelo legado: {@code Nome()} + {@code Qualifica_Sem_Nome()}. */
    private String montarQualificacaoPreambuloParte(PessoaEntity pessoa) {
        if (pessoa == null || pessoa.getId() == null) {
            return "";
        }
        String nome = ContratoHonorariosClausulas.normalizarNomeAssinatura(
                Utf8MojibakeUtil.corrigir(pessoa.getNome()));
        String qualSemNome =
                qualificacaoPessoaUtil.gerarQualificacaoContratoLocacaoSemNomePorPessoaId(pessoa.getId());
        if (!StringUtils.hasText(nome)) {
            return qualSemNome;
        }
        if (!StringUtils.hasText(qualSemNome)) {
            return nome;
        }
        return nome + ", " + QualificacaoPessoaUtil.semVirgulaFinal(qualSemNome);
    }

    private static boolean inferirFemininoLocatarios(List<PessoaEntity> locatarios) {
        if (locatarios == null || locatarios.isEmpty()) {
            return false;
        }
        if (locatarios.size() > 1) {
            return locatarios.stream()
                    .allMatch(p -> QualificacaoPessoaUtil.determinarFeminino(p.getNome(), null));
        }
        return QualificacaoPessoaUtil.determinarFeminino(locatarios.get(0).getNome(), null);
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
        return quebrarLinhasHtml(sb.toString());
    }

    /** Quebras explícitas em blocos justificáveis (OpenHTMLToPDF não justifica bem {@code <br/>}). */
    static String quebrarLinhasHtml(String html) {
        if (!StringUtils.hasText(html)) {
            return html != null ? html : "";
        }
        if (!html.contains("\n")) {
            return html;
        }
        String[] linhas = html.split("\\n", -1);
        StringBuilder sb = new StringBuilder();
        for (String linha : linhas) {
            if (linha.isEmpty()) {
                continue;
            }
            sb.append("<span class=\"contrato-linha\">").append(linha).append("</span>");
        }
        return sb.isEmpty() ? html : sb.toString();
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
