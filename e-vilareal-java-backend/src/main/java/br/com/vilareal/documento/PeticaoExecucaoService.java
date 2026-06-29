package br.com.vilareal.documento;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.tema.DocumentoTemaResolver;
import br.com.vilareal.documento.tema.TemaDocumento;
import br.com.vilareal.documento.DebitosTextoBuilder.CapituloDebitos;
import br.com.vilareal.documento.DebitosTextoBuilder.DebitosParams;
import br.com.vilareal.documento.DebitosTextoBuilder.ModoDebito;
import br.com.vilareal.documento.DebitosTextoBuilder.TituloDebitoInput;
import br.com.vilareal.documento.MontadorCorpoPeca.BlocoTopico;
import br.com.vilareal.documento.TopicoTokenResolver.ProcessamentoContexto;
import br.com.vilareal.pessoa.application.PessoaApplicationService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.topicos.infrastructure.persistence.entity.TopicoEntity;
import br.com.vilareal.topicos.infrastructure.persistence.repository.TopicoRepository;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Monta e gera o PDF da petição de Execução de Taxa Condominial, integrando as peças puras já prontas
 * (qualificação, flexão de polos, resolução de tokens dos tópicos, capítulo de débitos) com o template
 * {@code documentos/peticao-execucao}.
 */
@Service
public class PeticaoExecucaoService {

    private static final String CHAVE_BASE = "INICIAL=CIVIL=TÍTULOS=EXECUÇÃO=TAXA CONDOMINIAL=";
    private static final String CHAVE_FATOS = CHAVE_BASE + "003. DOS FATOS";
    private static final String CHAVE_TITULOS_COMPLETO = CHAVE_BASE + "004. DOS TÍTULOS (Completo)";
    private static final String CHAVE_TITULOS_RESUMIDO = CHAVE_BASE + "004. DOS TÍTULOS (Resumido)";
    private static final String CHAVE_DIREITO = CHAVE_BASE + "005. DO DIREITO";
    private static final String CHAVE_PEDIDOS = CHAVE_BASE + "006. DOS PEDIDOS";
    private static final String TITULO_CAPITULO_PEDIDOS = "DOS PEDIDOS";
    private static final String INTRO_CAPITULO_PEDIDOS =
            "Diante do exposto, requer de Vossa Excelência:";
    private static final String TITULO_CAPITULO_VALOR_CAUSA = "DO VALOR DA CAUSA:";
    private static final String TEXTO_CAPITULO_VALOR_CAUSA_PREFIXO =
            "Dá-se ao presente pleito, o valor defeso e cabível de ";

    private static final String TRANSICAO =
            ", por intermédio de sua advogada que esta subscreve, com endereço profissional descrito no rodapé "
                    + "desta, para fins de recebimento de intimações, conforme disposto no artigo 106, inciso I, do "
                    + "CPC, vem com acato e respeito à ínclita presença de Vossa Excelência propor ";
    private static final String FECHO_QUALIF =
            ", consubstanciado nas razões de fato e de direito que prontamente passa a expor.";

    private static final DateTimeFormatter DATA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final ProcessoRepository processoRepository;
    private final ProcessoParteRepository processoParteRepository;
    private final TopicoRepository topicoRepository;
    private final QualificacaoPessoaUtil qualificacaoPessoaUtil;
    private final PessoaApplicationService pessoaApplicationService;
    private final DocumentoPdfService pdfService;
    private final DocumentoTemaResolver temaResolver;

    public PeticaoExecucaoService(
            ProcessoRepository processoRepository,
            ProcessoParteRepository processoParteRepository,
            TopicoRepository topicoRepository,
            QualificacaoPessoaUtil qualificacaoPessoaUtil,
            PessoaApplicationService pessoaApplicationService,
            DocumentoPdfService pdfService,
            DocumentoTemaResolver temaResolver) {
        this.processoRepository = processoRepository;
        this.processoParteRepository = processoParteRepository;
        this.topicoRepository = topicoRepository;
        this.qualificacaoPessoaUtil = qualificacaoPessoaUtil;
        this.pessoaApplicationService = pessoaApplicationService;
        this.pdfService = pdfService;
        this.temaResolver = temaResolver;
    }

    @Transactional(readOnly = true)
    public byte[] gerar(PeticaoExecucaoRequest req) {
        if (req == null || req.processoId() == null) {
            throw new IllegalArgumentException("processoId é obrigatório");
        }
        ProcessoEntity processo = processoRepository.findByIdForJuliaEnactment(req.processoId())
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + req.processoId()));

        TemaDocumento tema = temaResolver.resolverPorProcesso(processo);

        List<ProcessoParteEntity> partes = processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(req.processoId());
        List<ProcessoParteEntity> autores = new ArrayList<>();
        List<ProcessoParteEntity> reus = new ArrayList<>();
        for (ProcessoParteEntity parte : partes) {
            if (ehPoloAtivo(parte.getPolo())) {
                autores.add(parte);
            } else if (ehPoloPassivo(parte.getPolo())) {
                reus.add(parte);
            }
        }

        // 2.1 Não existe petição inicial sem endereço: valida que todas as partes com cadastro
        // (pessoaId) têm endereço, antes de montar qualquer coisa.
        validarEnderecosDasPartes(autores, reus);

        // 2.2 Gênero/número dos polos
        PoloFlexao polAutor = PoloFlexao.determinar(generosDe(autores));
        PoloFlexao polReu = PoloFlexao.determinar(generosDe(reus));
        FlexaoUtil.Numero numeroTitulos =
                req.titulos() != null && req.titulos().size() > 1 ? FlexaoUtil.Numero.PLURAL : FlexaoUtil.Numero.SINGULAR;

        // 2.3 Qualificações (HTML, nome em negrito)
        String qualAutoresHtml = qualificacoesHtml(autores);
        String qualReusHtml = qualificacoesHtml(reus);
        String nomeAutor = nomeSimples(autores);
        String nomeReu = nomeSimples(reus);

        // 2.4 Capítulo de débitos
        List<TituloDebitoInput> titulosInput = converterTitulos(req.titulos());
        ModoDebito modoDebito = "RESUMIDO".equalsIgnoreCase(nz(req.modo()))
                ? ModoDebito.RESUMIDO
                : ModoDebito.COMPLETO;
        DebitosParams params = new DebitosParams(
                modoDebito,
                "Taxa condominial vencida em ",
                formatarDataBR(req.data()),
                req.config() != null ? req.config().indice() : null,
                req.config() != null ? req.config().multa() : null,
                req.config() != null ? req.config().juros() : null,
                req.config() != null ? req.config().periodicidade() : null);
        BigDecimal totalGeralInformado = parseBRLOuNull(req.totalGeral());
        CapituloDebitos cap = DebitosTextoBuilder.montar(titulosInput, params, totalGeralInformado);

        // 2.5 Contexto
        ProcessamentoContexto ctx = new ProcessamentoContexto(
                polAutor.genero(), polAutor.numero(),
                polReu.genero(), polReu.numero(),
                numeroTitulos,
                nz(processo.getUnidade()),
                cap.totalGeralFormatado(),
                cap.totalGeralExtenso(),
                qualAutoresHtml, qualReusHtml,
                nomeAutor, nomeReu,
                Map.of());

        // 2.6 Corpo
        String corpoFatos = MontadorCorpoPeca.processarBlocos(buscarBlocos(CHAVE_FATOS), ctx);
        String capituloDebitosHtml = montarCapituloDebitos(req.modo(), cap, ctx);
        List<BlocoTopico> blocosDireito = buscarBlocos(CHAVE_DIREITO);
        List<BlocoTopico> blocosPedidos = coletarBlocosPedidos(blocosDireito);
        String corpoDireito = MontadorCorpoPeca.processarBlocos(filtrarBlocosCorpoDireito(blocosDireito), ctx);
        String capituloPedidosHtml = montarCapituloPedidos(blocosPedidos, ctx);
        String capituloValorCausaHtml = montarCapituloValorCausa(cap);
        String corpoHtml = corpoFatos + capituloDebitosHtml + corpoDireito + capituloPedidosHtml + capituloValorCausaHtml;

        // 2.7 Cabeçalho da peça, endereçamento e fecho
        String qualificacaoCabecalhoHtml = montarQualificacaoCabecalhoHtml(
                qualAutoresHtml, qualReusHtml, nz(processo.getNaturezaAcao()).trim());

        String enderecamentoHtml = StringUtils.hasText(req.enderecamento())
                ? req.enderecamento().trim()
                : "MERITÍSSIMO JUÍZO DA COMARCA DE " + nz(processo.getCidade()).toUpperCase(Locale.ROOT)
                        + " - " + nz(processo.getUf());

        String cidadeEstado = montarCidadeEstado(processo);
        String localData = pdfService.montarLocalData(cidadeEstado, req.data());
        String advogadoNome = tema.advogadoNomeEfetivo();
        String advogadoOab = tema.advogadoOabEfetivo();
        String fechoHtml = "<p class=\"fecho-termos\">Nestes termos,<br/>Pede deferimento.</p>"
                + "<p style=\"text-align:center;margin-top:18pt;\">" + esc(localData) + "</p>"
                + "<p style=\"text-align:center;margin-top:36pt;font-weight:bold;margin-bottom:0;\">"
                + esc(advogadoNome) + "</p>"
                + "<p style=\"text-align:center;font-weight:bold;margin:0;\">" + esc(advogadoOab) + "</p>";

        // 2.8 PDF
        Map<String, Object> vars = new HashMap<>();
        vars.put("enderecamentoHtml", enderecamentoHtml);
        vars.put("qualificacaoCabecalhoHtml", qualificacaoCabecalhoHtml);
        vars.put("corpoHtml", corpoHtml);
        vars.put("fechoHtml", fechoHtml);
        vars.put("advogadoNome", advogadoNome);
        vars.put("advogadoOab", advogadoOab);
        return pdfService.gerarPdfDeTemplate("documentos/peticao-execucao", vars, tema);
    }

    /**
     * Bloqueia a geração quando alguma parte com cadastro (pessoaId) está sem endereço. A mensagem
     * orienta o usuário a completar o cadastro da pessoa — o frontend a exibe diretamente.
     */
    private void validarEnderecosDasPartes(List<ProcessoParteEntity> autores, List<ProcessoParteEntity> reus) {
        List<ProcessoParteEntity> todas = new ArrayList<>();
        todas.addAll(autores);
        todas.addAll(reus);

        List<String> semEndereco = new ArrayList<>();
        for (ProcessoParteEntity parte : todas) {
            Long pessoaId = parte.getPessoa() != null ? parte.getPessoa().getId() : null;
            if (pessoaId == null) {
                continue; // parte com nome livre não tem cadastro de endereço a validar
            }
            if (!qualificacaoPessoaUtil.possuiEnderecoCadastrado(pessoaId)) {
                String nome = parte.getPessoa().getNome();
                String label = StringUtils.hasText(nome) ? nome.trim() : ("pessoa #" + pessoaId);
                if (!semEndereco.contains(label)) {
                    semEndereco.add(label);
                }
            }
        }

        if (!semEndereco.isEmpty()) {
            throw new IllegalArgumentException(
                    "Não é possível gerar a petição: não existe petição inicial sem endereço. "
                            + "Complete o cadastro da pessoa com o endereço (rua, número, bairro, cidade/UF e CEP) "
                            + "antes de gerar a peça. Pendência em: " + String.join("; ", semEndereco) + ".");
        }
    }

    static String montarQualificacaoCabecalhoHtml(String qualAutoresHtml, String qualReusHtml, String naturezaAcao) {
        return "<p class=\"qualificacao-parte\">" + qualAutoresHtml + TRANSICAO + "</p>"
                + "<p class=\"natureza-acao\"><strong><u>"
                + esc(normalizarNaturezaAcao(naturezaAcao).toUpperCase(Locale.ROOT))
                + "</u></strong></p>"
                + "<p class=\"qualificacao-parte\">em face de " + qualReusHtml + FECHO_QUALIF + "</p>";
    }

    /** Corrige grafia comum no cadastro do processo (ex.: «AÇAO» → «AÇÃO»). */
    static String normalizarNaturezaAcao(String naturezaAcao) {
        String n = nz(naturezaAcao).trim();
        if (n.isEmpty()) {
            return n;
        }
        return n.replace("AÇAO", "AÇÃO").replace("ACAO", "AÇÃO").replace("Acao", "Ação").replace("açao", "ação");
    }

    // ----- corpo dos débitos -----

    private String montarCapituloDebitos(String modo, CapituloDebitos cap, ProcessamentoContexto ctx) {
        String chaveTitulos = "RESUMIDO".equalsIgnoreCase(nz(modo)) ? CHAVE_TITULOS_RESUMIDO : CHAVE_TITULOS_COMPLETO;
        List<BlocoTopico> blocosTitulos = buscarBlocos(chaveTitulos);

        StringBuilder sb = new StringBuilder();
        if (!blocosTitulos.isEmpty()) {
            BlocoTopico bloco0 = blocosTitulos.get(0);
            String tituloResolvido = TopicoTokenResolver.resolver(bloco0.html(), ctx);
            if (StringUtils.hasText(tituloResolvido)) {
                sb.append("<p class=\"titulo\">").append(tituloResolvido).append("</p>");
            }
        }
        sb.append("<p class=\"paragrafo\">").append(nz(cap.cabecalhoHtml())).append("</p>");
        for (String item : cap.itensHtml()) {
            // Cada item de débito é uma alínea a)–e) (counter próprio "alinead", independente dos pedidos).
            sb.append("<p class=\"alinea-debito\">").append(item).append("</p>");
        }
        return sb.toString();
    }

    private List<BlocoTopico> coletarBlocosPedidos(List<BlocoTopico> blocosDireito) {
        List<BlocoTopico> doTopico = buscarBlocos(CHAVE_PEDIDOS);
        List<BlocoTopico> itens = extrairItensPedidos(doTopico);
        if (!itens.isEmpty()) {
            return itens;
        }
        // Fallback: pedidos ainda embutidos no capítulo DO DIREITO (tópico 006 vazio ou só com título).
        return MontadorCorpoPeca.extrairBlocosPorClasse(blocosDireito, "pedido");
    }

    private static List<BlocoTopico> extrairItensPedidos(List<BlocoTopico> blocos) {
        List<BlocoTopico> itens = new ArrayList<>();
        for (BlocoTopico bloco : blocos) {
            if (bloco == null || ehTituloDosPedidos(bloco)) {
                continue;
            }
            if ("pedido".equals(classeNormalizada(bloco.classe()))) {
                itens.add(bloco);
            } else {
                itens.add(new BlocoTopico("pedido", bloco.html()));
            }
        }
        return itens;
    }

    private static List<BlocoTopico> filtrarBlocosCorpoDireito(List<BlocoTopico> blocosDireito) {
        List<BlocoTopico> filtrados = new ArrayList<>();
        for (BlocoTopico bloco : blocosDireito) {
            if (bloco == null || ehTituloDosPedidos(bloco) || "pedido".equals(classeNormalizada(bloco.classe()))) {
                continue;
            }
            filtrados.add(bloco);
        }
        return filtrados;
    }

    static String montarCapituloValorCausa(CapituloDebitos cap) {
        String formatado = cap != null ? nz(cap.totalGeralFormatado()) : "";
        String extenso = cap != null ? formatarExtensoValorCausa(cap.totalGeralExtenso()) : "";
        if (!StringUtils.hasText(formatado)) {
            formatado = "R$ 0,00";
            extenso = "zero reais";
        }
        String paragrafo = esc(TEXTO_CAPITULO_VALOR_CAUSA_PREFIXO)
                + "<span class=\"valor-monetario\"><strong><span class=\"valor-monetario-num\">"
                + esc(formatado) + "</span> (" + esc(extenso) + ")</strong></span>.";
        return "<p class=\"titulo\">" + TITULO_CAPITULO_VALOR_CAUSA + "</p>"
                + "<p class=\"paragrafo\">" + paragrafo + "</p>";
    }

    /** Extenso formal do valor da causa: vírgula após «mil» (ex.: «cinco mil, novecentos…»). */
    static String formatarExtensoValorCausa(String extenso) {
        if (!StringUtils.hasText(extenso)) {
            return "";
        }
        return extenso.replaceFirst("( mil) ([a-záéíóúâêôãç])", "$1, $2");
    }

    private String montarCapituloPedidos(List<BlocoTopico> blocosPedidos, ProcessamentoContexto ctx) {
        if (blocosPedidos == null || blocosPedidos.isEmpty()) {
            return "";
        }
        String itensHtml = MontadorCorpoPeca.processarBlocos(blocosPedidos, ctx);
        if (!StringUtils.hasText(itensHtml)) {
            return "";
        }
        return "<p class=\"titulo\">" + TITULO_CAPITULO_PEDIDOS + "</p>"
                + "<p class=\"paragrafo\">" + INTRO_CAPITULO_PEDIDOS + "</p>"
                + itensHtml;
    }

    static boolean ehTituloDosPedidos(BlocoTopico bloco) {
        if (bloco == null) {
            return false;
        }
        String classe = classeNormalizada(bloco.classe());
        if (!"titulo".equals(classe) && !"subtitulo".equals(classe)) {
            return false;
        }
        String texto = bloco.html() != null ? bloco.html().replaceAll("<[^>]*>", "").strip() : "";
        return deAccentUpper(texto).contains("PEDIDO");
    }

    private static String classeNormalizada(String classe) {
        return classe == null || classe.isBlank() ? "paragrafo" : classe.trim();
    }

    private List<BlocoTopico> buscarBlocos(String chaveNavegacao) {
        List<TopicoEntity> topicos =
                topicoRepository.findByChaveNavegacaoAndAtivoTrueAndConteudoHtmlIsNotNullOrderByBlocoIndiceAsc(
                        chaveNavegacao);
        List<BlocoTopico> blocos = new ArrayList<>(topicos.size());
        for (TopicoEntity t : topicos) {
            blocos.add(new BlocoTopico(t.getClasseHtml(), t.getConteudoHtml()));
        }
        return blocos;
    }

    // ----- partes / gênero / qualificação -----

    private List<FlexaoUtil.Genero> generosDe(List<ProcessoParteEntity> partes) {
        List<FlexaoUtil.Genero> generos = new ArrayList<>(partes.size());
        for (ProcessoParteEntity parte : partes) {
            generos.add(generoDaParte(parte));
        }
        return generos;
    }

    private FlexaoUtil.Genero generoDaParte(ProcessoParteEntity parte) {
        String nome = parte.getPessoa() != null ? parte.getPessoa().getNome() : parte.getNomeLivre();
        String genero = null;
        if (parte.getPessoa() != null && parte.getPessoa().getId() != null) {
            try {
                genero = pessoaApplicationService.obterComplementar(parte.getPessoa().getId()).getGenero();
            } catch (RuntimeException ignored) {
                genero = null;
            }
        }
        boolean feminino = QualificacaoPessoaUtil.determinarFeminino(nome, genero);
        return feminino ? FlexaoUtil.Genero.FEMININO : FlexaoUtil.Genero.MASCULINO;
    }

    private String qualificacoesHtml(List<ProcessoParteEntity> partes) {
        List<String> quals = new ArrayList<>();
        for (ProcessoParteEntity parte : partes) {
            if (parte.getPessoa() != null && parte.getPessoa().getId() != null) {
                quals.add(qualificacaoPessoaUtil.gerarQualificacaoPorPessoaId(parte.getPessoa().getId(), true));
            } else if (StringUtils.hasText(parte.getNomeLivre())) {
                quals.add("<strong>" + esc(parte.getNomeLivre().trim().toUpperCase(Locale.ROOT)) + "</strong>");
            }
        }
        return juntarComE(quals);
    }

    /** Junta com "; " e " e " antes do último (ex.: "A; B e C"). */
    private static String juntarComE(List<String> itens) {
        if (itens.isEmpty()) {
            return "";
        }
        if (itens.size() == 1) {
            return itens.get(0);
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < itens.size(); i++) {
            if (i == 0) {
                sb.append(itens.get(i));
            } else if (i == itens.size() - 1) {
                sb.append(" e ").append(itens.get(i));
            } else {
                sb.append("; ").append(itens.get(i));
            }
        }
        return sb.toString();
    }

    private static String nomeSimples(List<ProcessoParteEntity> partes) {
        List<String> nomes = new ArrayList<>();
        for (ProcessoParteEntity parte : partes) {
            String nome = parte.getPessoa() != null ? parte.getPessoa().getNome() : parte.getNomeLivre();
            if (StringUtils.hasText(nome)) {
                nomes.add(nome.trim());
            }
        }
        return juntarComE(nomes);
    }

    private static boolean ehPoloAtivo(String polo) {
        String p = deAccentUpper(polo);
        return p.contains("AUTOR") || p.contains("REQUERENTE") || p.contains("CLIENTE") || p.contains("EXEQUENTE");
    }

    private static boolean ehPoloPassivo(String polo) {
        String p = deAccentUpper(polo);
        return p.contains("REU") || p.contains("REQUERIDO") || p.contains("EXECUTADO");
    }

    // ----- títulos / valores -----

    private static List<TituloDebitoInput> converterTitulos(List<PeticaoExecucaoRequest.TituloDto> titulos) {
        List<TituloDebitoInput> lista = new ArrayList<>();
        if (titulos == null) {
            return lista;
        }
        for (PeticaoExecucaoRequest.TituloDto t : titulos) {
            lista.add(new TituloDebitoInput(
                    t.descricao(),
                    t.vencimento(),
                    t.diasAtraso() != null ? t.diasAtraso() : 0,
                    parseBRL(t.valorPrincipal()),
                    parseBRL(t.atualizacaoMonetaria()),
                    parseBRL(t.juros()),
                    parseBRL(t.multa()),
                    parseBRL(t.honorarios()),
                    // INV1: total da tela (quando enviado) prevalece sobre a recomposição por soma.
                    parseBRLOuNull(t.total())));
        }
        return lista;
    }

    /** Igual a {@link #parseBRL(String)}, mas devolve {@code null} quando vazio/nulo (em vez de ZERO). */
    static BigDecimal parseBRLOuNull(String valor) {
        if (valor == null || valor.replaceAll("[^0-9,.-]", "").trim().isEmpty()) {
            return null;
        }
        return parseBRL(valor);
    }

    /** Converte "R$ 1.234,56", "1.234,56" ou "1234.56" em BigDecimal; vazio/nulo → ZERO. */
    static BigDecimal parseBRL(String valor) {
        if (valor == null) {
            return BigDecimal.ZERO;
        }
        String s = valor.replaceAll("[^0-9,.-]", "").trim();
        if (s.isEmpty()) {
            return BigDecimal.ZERO;
        }
        boolean temVirgula = s.contains(",");
        boolean temPonto = s.contains(".");
        if (temVirgula && temPonto) {
            // Formato BRL: ponto = milhar, vírgula = decimal.
            s = s.replace(".", "").replace(",", ".");
        } else if (temVirgula) {
            // Apenas vírgula → decimal.
            s = s.replace(",", ".");
        }
        // Apenas ponto (ou nenhum separador) → já está em formato decimal de máquina.
        try {
            return new BigDecimal(s);
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private static String formatarDataBR(LocalDate data) {
        return (data != null ? data : LocalDate.now()).format(DATA_BR);
    }

    private static String montarCidadeEstado(ProcessoEntity processo) {
        return formatarCidadeLocalData(processo.getCidade());
    }

    /** Cidade para o fecho da petição: só o nome, sem UF (ex.: «Anápolis, 10 de junho de 2026.»). */
    static String formatarCidadeLocalData(String cidade) {
        String c = nz(cidade).trim();
        if (c.isEmpty()) {
            return "Anápolis";
        }
        return QualificacaoPessoaUtil.normalizarCidade(c);
    }

    private static String deAccentUpper(String s) {
        if (s == null) {
            return "";
        }
        return Normalizer.normalize(s, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toUpperCase(Locale.ROOT)
                .trim();
    }

    private static String nz(String s) {
        return s != null ? s : "";
    }

    private static String esc(String texto) {
        if (texto == null) {
            return "";
        }
        return texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
