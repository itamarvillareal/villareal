package br.com.vilareal.topicos.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.FlexaoUtil;
import br.com.vilareal.documento.LocacaoConcordanciaReuUtil;
import br.com.vilareal.documento.LocacaoTemplateLegadoSupport;
import br.com.vilareal.documento.MoedaBrParser;
import br.com.vilareal.documento.QualificacaoPessoaUtil;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.topicos.api.dto.TopicoProcessarResponse;
import br.com.vilareal.topicos.infrastructure.persistence.entity.TopicoEntity;
import br.com.vilareal.topicos.infrastructure.persistence.repository.TopicoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class TopicoProcessadorService {

    private static final Pattern SEPARADOR_BLOCO = Pattern.compile("8\\*&\\*@&#\\(\\*@&93837942");
    private static final Pattern TAG_FORMATACAO = Pattern.compile("\\(\"([^\"]+)\"\\)");
    private static final Pattern PLACEHOLDER_NOME =
            Pattern.compile("Nome\\(\"(Autor|Reu|Fiador)\",\"all\"\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PLACEHOLDER_QUALIFICA = Pattern.compile(
            "Qualifica_Sem_Nome_?\\(\"(Autor|Reu|Fiador)\",\"all\"\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PLACEHOLDER_QUALIFICA_FIADOR = Pattern.compile(
            "Qualifica\\(\"Fiador\",\"all\"(?:,[^)]*)?\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PLACEHOLDER_ADEQUA =
            Pattern.compile("(?:Ucase|Lcase|Propercase)?\\(Adequa\\(\"@\",\"(Autor|Reu|Fiador)\",\"(.+?)\"\\)\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PLACEHOLDER_ADEQUA_SIMPLES =
            Pattern.compile("Adequa\\(\"@\",\"(Autor|Reu|Fiador)\",\"(.+?)\"\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PLACEHOLDER_EXTENSO =
            Pattern.compile("Extensoreais\\(\"(.+?)\"\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PLACEHOLDER_DATA =
            Pattern.compile("DataPorExtenso\\(\"(.+?)\"\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PLACEHOLDER_UCASE = Pattern.compile("Ucase\\((.+?)\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PLACEHOLDER_LCASE = Pattern.compile("Lcase\\((.+?)\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PLACEHOLDER_PROPER = Pattern.compile("Propercase\\((.+?)\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PLACEHOLDER_GENERICO =
            Pattern.compile("[A-Za-z_][A-Za-z0-9_]*\\([^)]*\\)");

    private static final Map<String, String[]> ADEQUA_MAP = Map.ofEntries(
            Map.entry("comprador", new String[] {"Comprador", "Compradora", "Compradores", "Compradoras"}),
            Map.entry("vendedor", new String[] {"Vendedor", "Vendedora", "Vendedores", "Vendedoras"}),
            Map.entry("autor", new String[] {"Autor", "Autora", "Autores", "Autoras"}),
            Map.entry("reu", new String[] {"Réu", "Ré", "Réus", "Rés"}),
            Map.entry("requerente", new String[] {"Requerente", "Requerente", "Requerentes", "Requerentes"}),
            Map.entry("requerido", new String[] {"Requerido", "Requerida", "Requeridos", "Requeridas"}),
            Map.entry("locador", new String[] {"Locador", "Locadora", "Locadores", "Locadoras"}),
            Map.entry("locatario", new String[] {"Locatário", "Locatária", "Locatários", "Locatárias"}),
            Map.entry("locatário", new String[] {"Locatário", "Locatária", "Locatários", "Locatárias"}),
            Map.entry("fiador", new String[] {"Fiador", "Fiadora", "Fiadores", "Fiadoras"}),
            Map.entry("credor", new String[] {"Credor", "Credora", "Credores", "Credoras"}),
            Map.entry("devedor", new String[] {"Devedor", "Devedora", "Devedores", "Devedoras"}));

    /** Artigos/preposições: Ucase legado deve virar "Os", não "OS". */
    private static final Set<String> ARTIGOS_UCASE_LEGADO = Set.of(
            "o", "a", "os", "as", "um", "uma", "uns", "umas",
            "do", "da", "dos", "das", "no", "na", "nos", "nas",
            "ao", "aos");

    private final TopicoRepository topicoRepository;
    private final ProcessoParteRepository processoParteRepository;
    private final PessoaRepository pessoaRepository;
    private final QualificacaoPessoaUtil qualificacaoPessoaUtil;

    public TopicoProcessadorService(
            TopicoRepository topicoRepository,
            ProcessoParteRepository processoParteRepository,
            PessoaRepository pessoaRepository,
            QualificacaoPessoaUtil qualificacaoPessoaUtil) {
        this.topicoRepository = topicoRepository;
        this.processoParteRepository = processoParteRepository;
        this.pessoaRepository = pessoaRepository;
        this.qualificacaoPessoaUtil = qualificacaoPessoaUtil;
    }

    @Transactional(readOnly = true)
    public TopicoProcessarResponse processarTopico(Long topicoId, Long processoId, Map<String, String> parametros) {
        TopicoEntity topico = topicoRepository
                .findById(topicoId)
                .filter(TopicoEntity::getAtivo)
                .orElseThrow(() -> new ResourceNotFoundException("Tópico não encontrado: " + topicoId));
        return montarResposta(topico, processarTemplate(topico.getConteudoTemplate(), processoId, parametros));
    }

    @Transactional(readOnly = true)
    public List<TopicoProcessarResponse> processarMultiplos(
            List<Long> topicoIds, Long processoId, Map<String, String> parametros) {
        if (topicoIds == null || topicoIds.isEmpty()) {
            return List.of();
        }
        Map<Long, TopicoEntity> porId = new LinkedHashMap<>();
        for (TopicoEntity t : topicoRepository.findByIdInAndAtivoTrue(topicoIds)) {
            porId.put(t.getId(), t);
        }
        List<TopicoProcessarResponse> out = new ArrayList<>();
        for (Long id : topicoIds) {
            TopicoEntity topico = porId.get(id);
            if (topico == null) {
                throw new ResourceNotFoundException("Tópico não encontrado: " + id);
            }
            out.add(montarResposta(topico, processarTemplate(topico.getConteudoTemplate(), processoId, parametros)));
        }
        return out;
    }

    private TopicoProcessarResponse montarResposta(TopicoEntity topico, ResultadoProcessamento resultado) {
        TopicoProcessarResponse resp = new TopicoProcessarResponse();
        resp.setTopicoId(topico.getId());
        resp.setNome(topico.getNome());
        resp.setTipoFormatacao(topico.getTipoFormatacao());
        resp.setTextoProcessado(resultado.texto());
        resp.setPlaceholdersNaoResolvidos(resultado.naoResolvidos());
        return resp;
    }

    ResultadoProcessamento processarTemplate(String template, Long processoId, Map<String, String> parametros) {
        return processarTemplateComContexto(template, carregarPartes(processoId), parametros, false);
    }

    /** Locador = Autor; locatário = Réu (mesma convenção dos modelos legados de locação). */
    @Transactional(readOnly = true)
    public ResultadoProcessamento processarTemplateLocacao(
            String template, Long locadorPessoaId, Long locatarioPessoaId, Map<String, String> parametros) {
        List<Long> locatarios =
                locatarioPessoaId != null && locatarioPessoaId > 0 ? List.of(locatarioPessoaId) : List.of();
        return processarTemplateLocacao(template, locadorPessoaId, locatarios, List.of(), parametros);
    }

    /** Locador = Autor; locatário = Réu; fiadores = polo Fiador. */
    @Transactional(readOnly = true)
    public ResultadoProcessamento processarTemplateLocacao(
            String template,
            Long locadorPessoaId,
            Long locatarioPessoaId,
            List<Long> fiadoresPessoaIds,
            Map<String, String> parametros) {
        List<Long> locatarios =
                locatarioPessoaId != null && locatarioPessoaId > 0 ? List.of(locatarioPessoaId) : List.of();
        return processarTemplateLocacao(template, locadorPessoaId, locatarios, fiadoresPessoaIds, parametros);
    }

    /** Locador = Autor; locatários = Réus; fiadores = polo Fiador. */
    @Transactional(readOnly = true)
    public ResultadoProcessamento processarTemplateLocacao(
            String template,
            Long locadorPessoaId,
            List<Long> locatariosPessoaIds,
            List<Long> fiadoresPessoaIds,
            Map<String, String> parametros) {
        Map<String, String> params = parametros != null ? parametros : Map.of();
        return processarTemplateComContexto(
                template,
                carregarPartesLocacao(locadorPessoaId, locatariosPessoaIds, fiadoresPessoaIds),
                params,
                true);
    }

    private ResultadoProcessamento processarTemplateComContexto(
            String template, ContextoPartes ctx, Map<String, String> parametros, boolean locacao) {
        if (!StringUtils.hasText(template)) {
            return new ResultadoProcessamento("", List.of());
        }
        String texto = SEPARADOR_BLOCO.matcher(template).replaceAll("\n\n");
        texto = TAG_FORMATACAO.matcher(texto).replaceAll("");

        Map<String, String> params = parametros != null ? parametros : Map.of();

        // Antes do preprocess legado: Class_do_Processo vira "" e quebra o padrão Qualifica("Fiador","all",…).
        texto = substituirPadrao(texto, PLACEHOLDER_QUALIFICA_FIADOR, m -> resolverQualificacao(ctx, "Fiador", locacao, false));

        if (locacao) {
            texto = LocacaoTemplateLegadoSupport.preprocessar(texto, params);
            texto = LocacaoConcordanciaReuUtil.injetarAdequaReuPalavrasSoltas(texto);
        }
        texto = substituirPadrao(texto, PLACEHOLDER_NOME, m -> resolverNome(ctx, m.group(1), locacao));
        texto = substituirPadrao(texto, PLACEHOLDER_QUALIFICA, m -> resolverQualificacao(ctx, m.group(1), locacao, true));
        texto = substituirPadrao(texto, PLACEHOLDER_ADEQUA, m -> adequar(ctx, m.group(1), m.group(2), m.group(0)));
        texto = substituirPadrao(texto, PLACEHOLDER_ADEQUA_SIMPLES, m -> adequar(ctx, m.group(1), m.group(2), m.group(0)));
        texto = substituirPadrao(texto, PLACEHOLDER_EXTENSO, m -> valorPorExtenso(m.group(1), params));
        texto = substituirPadrao(texto, PLACEHOLDER_DATA, m -> dataPorExtenso(m.group(1), params));
        texto = aplicarCaixasLegado(texto);

        if (locacao) {
            texto = substituirPadrao(texto, PLACEHOLDER_QUALIFICA_FIADOR, m -> resolverQualificacao(ctx, "Fiador", locacao, false));
            texto = LocacaoTemplateLegadoSupport.limparArtefatosLegado(texto);
            texto = LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao(texto);
            texto = LocacaoConcordanciaReuUtil.aplicarConcordanciaLocatarioProcessado(
                    texto, ctx.reus().size(), inferirFeminino(ctx.reus()));
        }

        List<String> naoResolvidos = new ArrayList<>();
        Matcher restante = PLACEHOLDER_GENERICO.matcher(texto);
        while (restante.find()) {
            String ph = restante.group();
            if (!naoResolvidos.contains(ph)) {
                naoResolvidos.add(ph);
            }
        }
        return new ResultadoProcessamento(texto.trim(), naoResolvidos);
    }

    private static String substituirPadrao(String texto, Pattern pattern, java.util.function.Function<Matcher, String> replacer) {
        Matcher m = pattern.matcher(texto);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            m.appendReplacement(sb, Matcher.quoteReplacement(replacer.apply(m)));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private ContextoPartes carregarPartes(Long processoId) {
        if (processoId == null) {
            return ContextoPartes.vazio();
        }
        List<ProcessoParteEntity> partes = processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(processoId);
        List<ProcessoParteEntity> autores = new ArrayList<>();
        List<ProcessoParteEntity> reus = new ArrayList<>();
        for (ProcessoParteEntity p : partes) {
            if (poloEhAutor(p.getPolo())) {
                autores.add(p);
            } else if (poloEhReu(p.getPolo())) {
                reus.add(p);
            }
        }
        return new ContextoPartes(autores, reus, List.of());
    }

    private ContextoPartes carregarPartesLocacao(
            Long locadorPessoaId, List<Long> locatariosPessoaIds, List<Long> fiadoresPessoaIds) {
        List<ProcessoParteEntity> autores = new ArrayList<>();
        List<ProcessoParteEntity> reus = new ArrayList<>();
        List<ProcessoParteEntity> fiadores = new ArrayList<>();
        if (locadorPessoaId != null) {
            pessoaRepository
                    .findById(locadorPessoaId)
                    .ifPresent(p -> autores.add(parteComPessoa(p, "AUTOR")));
        }
        if (locatariosPessoaIds != null) {
            for (Long locatarioPessoaId : locatariosPessoaIds) {
                if (locatarioPessoaId == null || locatarioPessoaId < 1) {
                    continue;
                }
                pessoaRepository
                        .findById(locatarioPessoaId)
                        .ifPresent(p -> reus.add(parteComPessoa(p, "REU")));
            }
        }
        if (fiadoresPessoaIds != null) {
            for (Long fiadorId : fiadoresPessoaIds) {
                if (fiadorId == null) {
                    continue;
                }
                pessoaRepository
                        .findById(fiadorId)
                        .ifPresent(p -> fiadores.add(parteComPessoa(p, "FIADOR")));
            }
        }
        return new ContextoPartes(autores, reus, fiadores);
    }

    private static ProcessoParteEntity parteComPessoa(PessoaEntity pessoa, String polo) {
        ProcessoParteEntity parte = new ProcessoParteEntity();
        parte.setPessoa(pessoa);
        parte.setPolo(polo);
        return parte;
    }

    private String resolverNome(ContextoPartes ctx, String poloRef, boolean locacao) {
        List<ProcessoParteEntity> partes = partesPorReferencia(ctx, poloRef);
        if (partes.isEmpty()) {
            return "";
        }
        if (locacao && partes.size() > 1) {
            return "";
        }
        List<String> nomes = new ArrayList<>();
        for (ProcessoParteEntity p : partes) {
            String nome = nomeParte(p);
            if (StringUtils.hasText(nome)) {
                nomes.add(nome);
            }
        }
        return String.join(" e ", nomes);
    }

    private String resolverQualificacao(ContextoPartes ctx, String poloRef) {
        return resolverQualificacao(ctx, poloRef, false, true);
    }

    private String resolverQualificacao(ContextoPartes ctx, String poloRef, boolean locacao, boolean semNome) {
        List<ProcessoParteEntity> partes = partesPorReferencia(ctx, poloRef);
        if (partes.isEmpty()) {
            return "";
        }
        boolean qualificacaoCompletaPorParte = locacao && semNome && partes.size() > 1;
        List<String> qualificacoes = new ArrayList<>();
        for (ProcessoParteEntity p : partes) {
            if (p.getPessoa() != null && p.getPessoa().getId() != null) {
                qualificacoes.add(
                        resolverQualificacaoPorParte(p, locacao, qualificacaoCompletaPorParte ? false : semNome));
            } else if (StringUtils.hasText(p.getQualificacao())) {
                qualificacoes.add(p.getQualificacao().trim());
            }
        }
        return locacao ? String.join(", e ", qualificacoes) : String.join("; ", qualificacoes);
    }

    private String resolverQualificacaoPorParte(
            ProcessoParteEntity parte, boolean locacao, boolean semNome) {
        Long pessoaId = parte.getPessoa().getId();
        Long enderecoId = QualificacaoPessoaUtil.enderecoIdDaParte(parte);
        if (locacao) {
            return semNome
                    ? qualificacaoPessoaUtil.gerarQualificacaoContratoLocacaoSemNomePorPessoaId(pessoaId, enderecoId)
                    : qualificacaoPessoaUtil.gerarQualificacaoContratoLocacaoPorPessoaId(pessoaId, enderecoId);
        }
        return semNome
                ? qualificacaoPessoaUtil.gerarQualificacaoSemNomePorPessoaId(pessoaId, enderecoId)
                : qualificacaoPessoaUtil.gerarQualificacaoPorPessoaId(pessoaId, enderecoId, false);
    }

    private String resolverQualificacaoPorPessoaId(Long pessoaId, boolean locacao, boolean semNome) {
        if (locacao) {
            return semNome
                    ? qualificacaoPessoaUtil.gerarQualificacaoContratoLocacaoSemNomePorPessoaId(pessoaId)
                    : qualificacaoPessoaUtil.gerarQualificacaoContratoLocacaoPorPessoaId(pessoaId);
        }
        return semNome
                ? qualificacaoPessoaUtil.gerarQualificacaoSemNomePorPessoaId(pessoaId)
                : qualificacaoPessoaUtil.gerarQualificacaoPorPessoaId(pessoaId, false);
    }

    private String adequar(ContextoPartes ctx, String poloRef, String palavraBase, String expressaoOriginal) {
        List<ProcessoParteEntity> partes = partesPorReferencia(ctx, poloRef);
        boolean feminino = inferirFeminino(partes);
        boolean plural = partes.size() > 1;
        String chave = palavraBase.trim().toLowerCase(Locale.ROOT);
        String[] opcoes = ADEQUA_MAP.get(chave);
        String resultado;
        if (opcoes != null) {
            resultado = plural ? (feminino ? opcoes[3] : opcoes[2]) : (feminino ? opcoes[1] : opcoes[0]);
        } else {
            FlexaoUtil.Genero genero = feminino ? FlexaoUtil.Genero.FEMININO : FlexaoUtil.Genero.MASCULINO;
            FlexaoUtil.Numero numero = plural ? FlexaoUtil.Numero.PLURAL : FlexaoUtil.Numero.SINGULAR;
            resultado = FlexaoUtil.adequar(palavraBase, genero, numero);
        }
        String expr = expressaoOriginal.toLowerCase(Locale.ROOT);
        if (expr.startsWith("ucase")) {
            return aplicarUcaseLegado(resultado);
        }
        if (expr.startsWith("lcase")) {
            return resultado.toLowerCase(Locale.ROOT);
        }
        if (expr.startsWith("propercase")) {
            return properCase(resultado);
        }
        return resultado;
    }

    private static boolean inferirFeminino(List<ProcessoParteEntity> partes) {
        if (partes.isEmpty()) {
            return false;
        }
        if (partes.size() > 1) {
            return partes.stream().allMatch(TopicoProcessadorService::parteFeminina);
        }
        return parteFeminina(partes.get(0));
    }

    private static boolean parteFeminina(ProcessoParteEntity parte) {
        PessoaEntity pessoa = parte.getPessoa();
        if (pessoa == null) {
            return false;
        }
        if (parecePessoaJuridicaPorNome(pessoa.getNome())) {
            return true;
        }
        return QualificacaoPessoaUtil.determinarFeminino(pessoa.getNome(), null);
    }

    /** PJ usa flexão feminina nos modelos legados (LOCADORA, inscrita no CNPJ, etc.). */
    private static boolean parecePessoaJuridicaPorNome(String nome) {
        if (!StringUtils.hasText(nome)) {
            return false;
        }
        String upper = nome.toUpperCase(Locale.ROOT);
        return upper.contains(" LTDA")
                || upper.contains(" S/A")
                || upper.contains(" S.A.")
                || upper.contains(" EIRELI")
                || upper.contains(" MEI")
                || upper.contains(" ME ");
    }

    private static List<ProcessoParteEntity> partesPorReferencia(ContextoPartes ctx, String poloRef) {
        if ("fiador".equalsIgnoreCase(poloRef)) {
            return ctx.fiadores();
        }
        if ("reu".equalsIgnoreCase(poloRef)) {
            return ctx.reus();
        }
        return ctx.autores();
    }

    private static String aplicarCaixasLegado(String texto) {
        String atual = texto;
        for (int i = 0; i < 6; i++) {
            String proximo = substituirPadrao(atual, PLACEHOLDER_UCASE, m -> aplicarUcaseLegado(m.group(1).trim()));
            proximo = substituirPadrao(proximo, PLACEHOLDER_LCASE, m -> m.group(1).trim().toLowerCase(Locale.ROOT));
            proximo = substituirPadrao(proximo, PLACEHOLDER_PROPER, m -> properCase(m.group(1).trim()));
            if (proximo.equals(atual)) {
                return proximo;
            }
            atual = proximo;
        }
        return atual;
    }

    private static String nomeParte(ProcessoParteEntity parte) {
        if (parte.getPessoa() != null && StringUtils.hasText(parte.getPessoa().getNome())) {
            return parte.getPessoa().getNome().trim();
        }
        return parte.getNomeLivre() != null ? parte.getNomeLivre().trim() : "";
    }

    private static boolean poloEhAutor(String polo) {
        String p = normalizarPolo(polo);
        return p.contains("AUTOR") || p.contains("REQUERENTE");
    }

    private static boolean poloEhReu(String polo) {
        String p = normalizarPolo(polo);
        return p.contains("REU") || p.contains("RÉU") || p.contains("REQUERIDO");
    }

    private static String normalizarPolo(String polo) {
        return java.text.Normalizer.normalize(String.valueOf(polo != null ? polo : ""), java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toUpperCase(Locale.ROOT);
    }

    private static String valorPorExtenso(String literal, Map<String, String> params) {
        String raw = StringUtils.hasText(literal) ? literal.trim() : params.getOrDefault("valorCausa", "");
        if (!StringUtils.hasText(raw)) {
            return literal;
        }
        try {
            BigDecimal valor = MoedaBrParser.parseValorMonetario(raw);
            return extensoReais(valor.setScale(2, RoundingMode.HALF_UP));
        } catch (Exception e) {
            return raw;
        }
    }

    private static String dataPorExtenso(String literal, Map<String, String> params) {
        String raw = StringUtils.hasText(literal) ? literal.trim() : params.getOrDefault("data", "");
        LocalDate data;
        try {
            data = StringUtils.hasText(raw) ? LocalDate.parse(raw) : LocalDate.now();
        } catch (Exception e) {
            data = LocalDate.now();
        }
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy", Locale.forLanguageTag("pt-BR"));
        return data.format(fmt);
    }

    private static String aplicarUcaseLegado(String texto) {
        if (!StringUtils.hasText(texto)) {
            return texto != null ? texto : "";
        }
        String t = texto.trim();
        if (ARTIGOS_UCASE_LEGADO.contains(t.toLowerCase(Locale.ROOT))) {
            return properCase(t);
        }
        return t.toUpperCase(Locale.ROOT);
    }

    private static String properCase(String texto) {
        if (!StringUtils.hasText(texto)) {
            return texto;
        }
        String[] partes = texto.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < partes.length; i++) {
            String p = partes[i];
            if (!p.isEmpty()) {
                sb.append(Character.toUpperCase(p.charAt(0)));
                if (p.length() > 1) {
                    sb.append(p.substring(1).toLowerCase(Locale.ROOT));
                }
            }
            if (i < partes.length - 1) {
                sb.append(' ');
            }
        }
        return sb.toString();
    }

    private static String extensoReais(BigDecimal valor) {
        long reais = valor.longValue();
        int centavos = valor.remainder(BigDecimal.ONE).movePointRight(2).intValue();
        StringBuilder sb = new StringBuilder();
        if (reais > 0) {
            sb.append(numeroPorExtenso(reais)).append(reais == 1 ? " real" : " reais");
        }
        if (centavos > 0) {
            if (!sb.isEmpty()) {
                sb.append(" e ");
            }
            sb.append(numeroPorExtenso(centavos)).append(centavos == 1 ? " centavo" : " centavos");
        }
        if (sb.isEmpty()) {
            return "zero reais";
        }
        return sb.toString();
    }

    private static String numeroPorExtenso(long n) {
        if (n == 0) {
            return "zero";
        }
        if (n < 0 || n > 999_999_999) {
            return Long.toString(n);
        }
        String[] unidades = {
            "", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
            "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"
        };
        String[] dezenas = {"", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"};
        String[] centenas = {"", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"};

        List<String> partes = new ArrayList<>();
        long milhao = n / 1_000_000;
        long restoMilhao = n % 1_000_000;
        long mil = restoMilhao / 1_000;
        long resto = restoMilhao % 1_000;

        if (milhao > 0) {
            partes.add(milhao == 1 ? "um milhão" : numeroPorExtenso(milhao) + " milhões");
        }
        if (mil > 0) {
            partes.add(mil == 1 ? "mil" : numeroPorExtenso(mil) + " mil");
        }
        if (resto > 0) {
            if (resto < 20) {
                partes.add(unidades[(int) resto]);
            } else {
                int d = (int) (resto / 10);
                int u = (int) (resto % 10);
                if (resto == 100) {
                    partes.add("cem");
                } else if (resto >= 100) {
                    partes.add(centenas[(int) (resto / 100)] + (resto % 100 > 0 ? " e " + numeroPorExtenso(resto % 100) : ""));
                } else {
                    partes.add(dezenas[d] + (u > 0 ? " e " + unidades[u] : ""));
                }
            }
        }
        return String.join(" e ", partes);
    }

    private record ContextoPartes(
            List<ProcessoParteEntity> autores, List<ProcessoParteEntity> reus, List<ProcessoParteEntity> fiadores) {
        static ContextoPartes vazio() {
            return new ContextoPartes(List.of(), List.of(), List.of());
        }
    }

    public record ResultadoProcessamento(String texto, List<String> naoResolvidos) {}
}
