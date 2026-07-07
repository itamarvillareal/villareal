package br.com.vilareal.documento;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.HomologacaoAcordoTextoBuilder.BoletoLinha;
import br.com.vilareal.documento.HomologacaoAcordoTextoBuilder.ClausulasConfig;
import br.com.vilareal.documento.HomologacaoAcordoTextoBuilder.TituloLinha;
import br.com.vilareal.documento.tema.DocumentoTemaResolver;
import br.com.vilareal.documento.tema.TemaDocumento;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
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

/** Monta e gera o PDF da petição interlocutória de homologação de acordo. */
@Service
public class PeticaoHomologacaoAcordoService {

    private static final String FORMA_PAGAMENTO_PADRAO =
            "liquidadas por intermédio do pagamento dos boletos bancários anexos";
    private static final DateTimeFormatter DATA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final ProcessoRepository processoRepository;
    private final ProcessoParteRepository processoParteRepository;
    private final DocumentoPdfService pdfService;
    private final DocumentoTemaResolver temaResolver;

    public PeticaoHomologacaoAcordoService(
            ProcessoRepository processoRepository,
            ProcessoParteRepository processoParteRepository,
            DocumentoPdfService pdfService,
            DocumentoTemaResolver temaResolver) {
        this.processoRepository = processoRepository;
        this.processoParteRepository = processoParteRepository;
        this.pdfService = pdfService;
        this.temaResolver = temaResolver;
    }

    @Transactional(readOnly = true)
    public byte[] gerar(PeticaoHomologacaoAcordoRequest req) {
        if (req == null || req.processoId() == null) {
            throw new IllegalArgumentException("processoId é obrigatório");
        }
        if (req.conteudoEditado() != null && StringUtils.hasText(req.conteudoEditado().corpoUnico())) {
            return gerarPdfFromConteudo(req.conteudoEditado(), req.processoId());
        }
        return gerarPdfFromVariaveis(resolverVariaveis(req), req.processoId());
    }

    @Transactional(readOnly = true)
    public PeticaoHomologacaoAcordoConteudoPreview montarConteudoPreview(PeticaoHomologacaoAcordoRequest req) {
        if (req == null || req.processoId() == null) {
            throw new IllegalArgumentException("processoId é obrigatório");
        }
        return new PeticaoHomologacaoAcordoConteudoPreview(montarCorpoUnico(resolverVariaveis(req)));
    }

    @Transactional(readOnly = true)
    public byte[] gerarPdfPreview(PeticaoHomologacaoAcordoPreviewPdfRequest request) {
        if (request == null || request.conteudo() == null) {
            throw new IllegalArgumentException("conteudo é obrigatório");
        }
        if (request.processoId() == null) {
            throw new IllegalArgumentException("processoId é obrigatório");
        }
        return gerarPdfFromConteudo(request.conteudo(), request.processoId());
    }

    private byte[] gerarPdfFromConteudo(PeticaoHomologacaoAcordoConteudoPreview conteudo, Long processoId) {
        TemaDocumento tema = temaResolver.resolverPorProcessoId(processoId);
        Map<String, Object> vars = new HashMap<>();
        vars.put("corpoUnicoHtml", DocumentoReformatarCorpoUnicoHtml.extrairHtmlParaPdf(conteudo.corpoUnico()));
        return pdfService.gerarPdfDeTemplate("documentos/peticao-homologacao-acordo", vars, tema);
    }

    private byte[] gerarPdfFromVariaveis(VariaveisHomologacao vars, Long processoId) {
        TemaDocumento tema = temaResolver.resolverPorProcessoId(processoId);
        Map<String, Object> variables = new HashMap<>();
        variables.put("enderecamentoHtml", vars.enderecamentoHtml());
        variables.put("autosHtml", vars.autosHtml());
        variables.put("qualificacaoInterlocutorasHtml", vars.qualificacaoInterlocutorasHtml());
        variables.put("corpoHtml", vars.corpoHtml());
        variables.put("fechoHtml", vars.fechoHtml());
        variables.put("advogadoNome", vars.advogadoNome());
        variables.put("advogadoOab", vars.advogadoOab());
        return pdfService.gerarPdfDeTemplate("documentos/peticao-homologacao-acordo", variables, tema);
    }

    private VariaveisHomologacao resolverVariaveis(PeticaoHomologacaoAcordoRequest req) {
        if (req.boletos() == null || req.boletos().isEmpty()) {
            throw new IllegalArgumentException("Informe ao menos um boleto no plano de pagamento.");
        }

        ProcessoEntity processo = processoRepository.findByIdForJuliaEnactment(req.processoId())
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + req.processoId()));

        TemaDocumento tema = temaResolver.resolverPorProcesso(processo);

        List<ProcessoParteEntity> partes =
                processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(req.processoId());
        List<ProcessoParteEntity> autores = new ArrayList<>();
        List<ProcessoParteEntity> reus = new ArrayList<>();
        for (ProcessoParteEntity parte : partes) {
            if (ehPoloAtivo(parte.getPolo())) {
                autores.add(parte);
            } else if (ehPoloPassivo(parte.getPolo())) {
                reus.add(parte);
            }
        }

        String enderecamentoHtml = StringUtils.hasText(req.enderecamento())
                ? req.enderecamento().trim()
                : montarEnderecamentoPadrao(processo);

        String numeroCnj = StringUtils.hasText(req.numeroCnj())
                ? req.numeroCnj().trim()
                : nz(processo.getNumeroCnj()).trim();
        String autosHtml = numeroCnj.isEmpty() ? "" : "Autos nº " + esc(numeroCnj);

        String qualificacaoInterlocutorasHtml = montarQualificacaoInterlocutoriaHtml(autores, reus);

        String unidade = StringUtils.hasText(req.unidade()) ? req.unidade().trim() : nz(processo.getUnidade()).trim();
        List<TituloLinha> titulos = converterTitulos(req.titulos());
        BigDecimal totalGeralInformado = PeticaoExecucaoService.parseBRLOuNull(req.totalGeral());
        BigDecimal totalGeral = totalGeralInformado != null
                ? totalGeralInformado
                : titulos.stream().map(TituloLinha::valor).reduce(BigDecimal.ZERO, BigDecimal::add);
        String totalExtenso = ValorExtensoUtil.reaisPorExtenso(totalGeral);

        List<BoletoLinha> boletos = converterBoletos(req.boletos());
        ClausulasConfig clausulas = resolverClausulas(req.clausulas());

        String corpoFatosHtml = HomologacaoAcordoTextoBuilder.montarCorpoFatos(totalGeral, totalExtenso, unidade, titulos);
        String corpoAcordoHtml = HomologacaoAcordoTextoBuilder.montarCorpoAcordo(boletos, clausulas);
        String corpoPedidosHtml = HomologacaoAcordoTextoBuilder.montarCorpoPedidos(clausulas);
        String corpoHtml = corpoFatosHtml + corpoAcordoHtml + corpoPedidosHtml;

        String cidadeEstado = PeticaoExecucaoService.formatarCidadeLocalData(processo.getCidade());
        LocalDate data = req.data() != null ? req.data() : LocalDate.now();
        String localData = pdfService.montarLocalData(cidadeEstado, data);
        String advogadoNome = tema.advogadoNomeEfetivo();
        String advogadoOab = tema.advogadoOabEfetivo();

        String fechoHtml = montarFechoHomologacaoHtml(localData, advogadoNome, advogadoOab, autores, reus);

        return new VariaveisHomologacao(
                enderecamentoHtml,
                autosHtml,
                qualificacaoInterlocutorasHtml,
                corpoHtml,
                fechoHtml,
                advogadoNome,
                advogadoOab);
    }

    static String montarCorpoUnico(VariaveisHomologacao vars) {
        StringBuilder sb = new StringBuilder();
        sb.append("<div class=\"doc-edicao-preview doc-homologacao-preview\">");
        sb.append(DocumentoReformatarCorpoUnicoHtml.montarCabecalhoEdicaoPreview(
                vars.advogadoNome(), vars.advogadoOab()));
        sb.append("<div class=\"corpo-documento\">");
        sb.append("<p class=\"enderecamento\">").append(vars.enderecamentoHtml()).append("</p>");
        if (StringUtils.hasText(vars.autosHtml())) {
            sb.append("<p class=\"autos\">").append(vars.autosHtml()).append("</p>");
        }
        sb.append("<div class=\"qualificacao\">")
                .append(vars.qualificacaoInterlocutorasHtml())
                .append("</div>");
        sb.append("<div class=\"corpo\">").append(vars.corpoHtml()).append("</div>");
        sb.append("<div class=\"fecho\">").append(vars.fechoHtml()).append("</div>");
        sb.append("</div></div>");
        return sb.toString();
    }

    private record VariaveisHomologacao(
            String enderecamentoHtml,
            String autosHtml,
            String qualificacaoInterlocutorasHtml,
            String corpoHtml,
            String fechoHtml,
            String advogadoNome,
            String advogadoOab) {}

    static String montarQualificacaoInterlocutoriaHtml(
            List<ProcessoParteEntity> autores, List<ProcessoParteEntity> reus) {
        String nomeAutor = nomeSimples(autores).toUpperCase(Locale.ROOT);
        String nomeReu = nomeSimples(reus).toUpperCase(Locale.ROOT);
        boolean pluralAutor = autores.size() > 1;
        boolean pluralReu = reus.size() > 1;
        String qualAutor = pluralAutor ? "já devidamente qualificados" : "já devidamente qualificado";
        String qualReu = pluralReu ? "também já devidamente qualificados" : "também já devidamente qualificado";
        return "<p class=\"qualificacao-parte\">"
                + "<strong>" + nbspNome(nomeAutor) + "</strong>, " + qualAutor + " na Ação que move em face de "
                + "<strong>" + nbspNome(nomeReu) + "</strong>, " + qualReu
                + ", vem respeitosamente à presença de Vossa Excelência, expor e ao final requerer:</p>";
    }

    static String montarFechoHomologacaoHtml(
            String localData,
            String advogadoNome,
            String advogadoOab,
            List<ProcessoParteEntity> autores,
            List<ProcessoParteEntity> reus) {
        StringBuilder fecho = new StringBuilder();
        fecho.append("<p class=\"fecho-termos\">Nestes termos,<br/>Pede deferimento.</p>")
                .append("<p class=\"fecho-local-data\">")
                .append(esc(localData))
                .append("</p>")
                .append(blocoAssinaturaAdvogado(advogadoNome, advogadoOab));
        for (ProcessoParteEntity parte : autores) {
            fecho.append(blocoAssinaturaParte(parte));
        }
        for (ProcessoParteEntity parte : reus) {
            fecho.append(blocoAssinaturaParte(parte));
        }
        return fecho.toString();
    }

    private static String blocoAssinaturaAdvogado(String advogadoNome, String advogadoOab) {
        return "<div class=\"assinatura-bloco\">"
                + "<p class=\"assinatura-nome\">"
                + esc(advogadoNome)
                + "</p>"
                + "<p class=\"assinatura-doc\">"
                + esc(advogadoOab)
                + "</p>"
                + "</div>";
    }

    private static String blocoAssinaturaParte(ProcessoParteEntity parte) {
        String nome = nomeParte(parte);
        if (!StringUtils.hasText(nome)) {
            return "";
        }
        DocumentoParte doc = resolverDocumentoParte(parte.getPessoa());
        StringBuilder bloco = new StringBuilder();
        bloco.append("<div class=\"assinatura-bloco\">")
                .append("<p class=\"assinatura-nome\">")
                .append(esc(nome.toUpperCase(Locale.ROOT)))
                .append("</p>");
        if (doc != null) {
            bloco.append("<p class=\"assinatura-doc\">")
                    .append(esc(doc.rotulo()))
                    .append(' ')
                    .append(esc(doc.valorFormatado()))
                    .append("</p>");
        }
        bloco.append("</div>");
        return bloco.toString();
    }

    private static String nomeParte(ProcessoParteEntity parte) {
        if (parte == null) {
            return "";
        }
        if (parte.getPessoa() != null && StringUtils.hasText(parte.getPessoa().getNome())) {
            return parte.getPessoa().getNome().trim();
        }
        return StringUtils.hasText(parte.getNomeLivre()) ? parte.getNomeLivre().trim() : "";
    }

    private record DocumentoParte(String rotulo, String valorFormatado) {}

    private static DocumentoParte resolverDocumentoParte(PessoaEntity pessoa) {
        if (pessoa == null || !StringUtils.hasText(pessoa.getCpf())) {
            return null;
        }
        String digitos = pessoa.getCpf().replaceAll("\\D", "");
        if (digitos.length() == 14) {
            return new DocumentoParte("CNPJ", QualificacaoPessoaUtil.formatarCnpj(digitos));
        }
        if (digitos.length() == 11) {
            return new DocumentoParte("CPF", QualificacaoPessoaUtil.formatarCpf(digitos));
        }
        return null;
    }

    static String montarEnderecamentoPadrao(ProcessoEntity processo) {
        String comp = nz(processo.getCompetencia()).trim();
        String cidade = nz(processo.getCidade()).trim().toUpperCase(Locale.ROOT);
        String uf = nz(processo.getUf()).trim().toUpperCase(Locale.ROOT);
        if (!comp.isEmpty()) {
            return "MERITÍSSIMO JUÍZO DO " + comp.toUpperCase(Locale.ROOT) + " DA COMARCA DE " + cidade + " - " + uf;
        }
        return "MERITÍSSIMO JUÍZO DA COMARCA DE " + cidade + " - " + uf;
    }

    private static ClausulasConfig resolverClausulas(PeticaoHomologacaoAcordoRequest.ClausulasHomologacaoDto dto) {
        if (dto == null) {
            return clausulasPadrao();
        }
        return new ClausulasConfig(
                parsePercent(dto.multaPercent(), new BigDecimal("30")),
                parsePercent(dto.jurosPercent(), new BigDecimal("1")),
                parsePercent(dto.honorariosPercent(), new BigDecimal("20")),
                StringUtils.hasText(dto.formaPagamentoTexto()) ? dto.formaPagamentoTexto().trim() : FORMA_PAGAMENTO_PADRAO,
                dto.incluirArt1335() == null || Boolean.TRUE.equals(dto.incluirArt1335()),
                dto.incluirIrrevogavel() == null || Boolean.TRUE.equals(dto.incluirIrrevogavel()),
                dto.incluirDesistenciaRecursos() == null || Boolean.TRUE.equals(dto.incluirDesistenciaRecursos()),
                dto.incluirCustas90() == null || Boolean.TRUE.equals(dto.incluirCustas90()),
                dto.incluirArt922() == null || Boolean.TRUE.equals(dto.incluirArt922()));
    }

    private static ClausulasConfig clausulasPadrao() {
        return new ClausulasConfig(
                new BigDecimal("30"),
                new BigDecimal("1"),
                new BigDecimal("20"),
                FORMA_PAGAMENTO_PADRAO,
                true,
                true,
                true,
                true,
                true);
    }

    private static BigDecimal parsePercent(String valor, BigDecimal padrao) {
        if (!StringUtils.hasText(valor)) {
            return padrao;
        }
        BigDecimal parsed = PeticaoExecucaoService.parseBRLOuNull(valor);
        return parsed != null && parsed.compareTo(BigDecimal.ZERO) > 0 ? parsed : padrao;
    }

    private static List<TituloLinha> converterTitulos(List<PeticaoExecucaoRequest.TituloDto> titulos) {
        List<TituloLinha> lista = new ArrayList<>();
        if (titulos == null) {
            return lista;
        }
        for (PeticaoExecucaoRequest.TituloDto t : titulos) {
            if (t == null) {
                continue;
            }
            BigDecimal total = PeticaoExecucaoService.parseBRLOuNull(t.total());
            if (total == null) {
                total = PeticaoExecucaoService.parseBRL(t.valorPrincipal())
                        .add(PeticaoExecucaoService.parseBRL(t.atualizacaoMonetaria()))
                        .add(PeticaoExecucaoService.parseBRL(t.juros()))
                        .add(PeticaoExecucaoService.parseBRL(t.multa()))
                        .add(PeticaoExecucaoService.parseBRL(t.honorarios()));
            }
            if (total.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            lista.add(new TituloLinha(nz(t.vencimento()).trim(), total));
        }
        return lista;
    }

    private static List<BoletoLinha> converterBoletos(List<PeticaoHomologacaoAcordoRequest.BoletoParcelaDto> boletos) {
        List<BoletoLinha> lista = new ArrayList<>();
        for (PeticaoHomologacaoAcordoRequest.BoletoParcelaDto b : boletos) {
            if (b == null) {
                continue;
            }
            BigDecimal valor = PeticaoExecucaoService.parseBRL(b.valorParcela());
            if (valor.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            lista.add(new BoletoLinha(valor, nz(b.vencimento()).trim()));
        }
        return lista;
    }

    private static String nbspNome(String nome) {
        return esc(nome).replace(" ", "&nbsp;");
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

    private static boolean ehPoloAtivo(String polo) {
        String p = deAccentUpper(polo);
        return p.contains("AUTOR") || p.contains("REQUERENTE") || p.contains("CLIENTE") || p.contains("EXEQUENTE");
    }

    private static boolean ehPoloPassivo(String polo) {
        String p = deAccentUpper(polo);
        return p.contains("REU") || p.contains("REQUERIDO") || p.contains("EXECUTADO");
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
