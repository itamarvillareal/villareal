package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.*;
import br.com.vilareal.financeiro.domain.*;
import br.com.vilareal.financeiro.domain.FinanceiroDescricaoPessoaExtracao;
import br.com.vilareal.financeiro.domain.FinanceiroDescricaoPessoaExtrator;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.RegraClassificacaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.RegraClassificacaoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.ClienteCodigoPessoaResolver;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class FinanceiroSugestaoService {

    private final RegraClassificacaoRepository regraRepository;
    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final ContaContabilRepository contaContabilRepository;
    private final PessoaRepository pessoaRepository;
    private final ProcessoRepository processoRepository;
    private final ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;
    private final FinanceiroSaudeService financeiroSaudeService;

    public FinanceiroSugestaoService(
            RegraClassificacaoRepository regraRepository,
            LancamentoFinanceiroRepository lancamentoRepository,
            ContaContabilRepository contaContabilRepository,
            PessoaRepository pessoaRepository,
            ProcessoRepository processoRepository,
            ClienteCodigoPessoaResolver clienteCodigoPessoaResolver,
            @Lazy FinanceiroSaudeService financeiroSaudeService) {
        this.regraRepository = regraRepository;
        this.lancamentoRepository = lancamentoRepository;
        this.contaContabilRepository = contaContabilRepository;
        this.pessoaRepository = pessoaRepository;
        this.processoRepository = processoRepository;
        this.clienteCodigoPessoaResolver = clienteCodigoPessoaResolver;
        this.financeiroSaudeService = financeiroSaudeService;
    }

    @Transactional(readOnly = true)
    public List<SugestaoClassificacaoResponse> sugerir(Long lancamentoId) {
        LancamentoFinanceiroEntity lancamento = carregarLancamento(lancamentoId);
        return sugerir(lancamento);
    }

    @Transactional(readOnly = true)
    public List<SugestaoClassificacaoResponse> sugerir(LancamentoFinanceiroEntity lancamento) {
        List<SugestaoClassificacaoResponse> todas = new ArrayList<>();
        todas.addAll(camadaRendimentosAplicacoes(lancamento));
        todas.addAll(camadaRegras(lancamento));
        List<SugestaoClassificacaoResponse> deposito = camadaDepositoIdentificado(lancamento);
        todas.addAll(deposito);
        if (deposito.isEmpty()) {
            todas.addAll(camadaPessoaProcessos(lancamento));
        }
        todas.addAll(camadaHistorico(lancamento));
        todas.addAll(camadaRecorrencia(lancamento));
        return deduplicarEOrdenar(todas);
    }

    @Transactional(readOnly = true)
    public Map<Long, List<SugestaoClassificacaoResponse>> sugerirLote(List<Long> lancamentoIds) {
        if (lancamentoIds == null || lancamentoIds.isEmpty()) {
            return Map.of();
        }
        if (lancamentoIds.size() > 50) {
            throw new BusinessRuleException("Máximo de 50 lançamentos por lote.");
        }
        Map<Long, List<SugestaoClassificacaoResponse>> out = new LinkedHashMap<>();
        for (Long id : lancamentoIds) {
            out.put(id, sugerir(id));
        }
        return out;
    }

    @Transactional
    public LancamentoFinanceiroResponse aplicarSugestao(AplicarSugestaoRequest req) {
        LancamentoFinanceiroEntity e = carregarLancamento(req.getLancamentoId());
        aplicarClassificacaoEmEntity(e, req.getContaContabilId(), req.getClienteId(), req.getProcessoId());
        LancamentoFinanceiroResponse saved = toLancamentoResponse(lancamentoRepository.save(e));
        financeiroSaudeService.invalidarCacheSaude();
        return saved;
    }

    @Transactional
    public AplicarSugestaoLoteResult aplicarSugestoesLote(AplicarSugestaoLoteRequest req) {
        AplicarSugestaoLoteResult result = new AplicarSugestaoLoteResult();
        for (AplicarSugestaoLoteItemRequest item : req.getAplicacoes()) {
            try {
                AplicarSugestaoRequest um = new AplicarSugestaoRequest();
                um.setLancamentoId(item.getLancamentoId());
                um.setContaContabilId(item.getContaContabilId());
                um.setClienteId(item.getClienteId());
                um.setProcessoId(item.getProcessoId());
                aplicarSugestao(um);
                result.setAplicados(result.getAplicados() + 1);
            } catch (Exception ex) {
                result.getErros().add(item.getLancamentoId() + ": " + ex.getMessage());
            }
        }
        if (result.getAplicados() > 0) {
            financeiroSaudeService.invalidarCacheSaude();
        }
        return result;
    }

    private List<SugestaoClassificacaoResponse> camadaRendimentosAplicacoes(LancamentoFinanceiroEntity lancamento) {
        if (!FinanceiroDescricaoIndicaContaF.indica(lancamento.getDescricao(), lancamento.getDescricaoDetalhada())) {
            return List.of();
        }
        ContaContabilEntity contaF =
                contaContabilRepository.findFirstByCodigoIgnoreCase("F").orElse(null);
        if (contaF == null) {
            return List.of();
        }
        SugestaoClassificacaoResponse s =
                baseSugestao(contaF, ConfiancaSugestao.ALTA, OrigemSugestao.REGRA);
        s.setDescricaoRegra("rendimentos/aplicações (COR JURS, JUROS, CRI, LCA, CDB) → F");
        return List.of(s);
    }

    private List<SugestaoClassificacaoResponse> camadaRegras(LancamentoFinanceiroEntity lancamento) {
        String texto = textoParaMatch(lancamento);
        List<SugestaoClassificacaoResponse> out = new ArrayList<>();
        for (RegraClassificacaoEntity regra : regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()) {
            if (regra.getNumeroBanco() != null
                    && !Objects.equals(regra.getNumeroBanco(), lancamento.getNumeroBanco())) {
                continue;
            }
            if (!ClassificacaoAutomaticaService.matchRegra(regra, texto)) {
                continue;
            }
            ConfiancaSugestao conf = confiancaDeRegra(regra.getConfianca());
            SugestaoClassificacaoResponse s = baseSugestao(regra.getContaContabil(), conf, OrigemSugestao.REGRA);
            s.setRegraId(regra.getId());
            s.setDescricaoRegra(regra.getPadraoDescricao() + " → " + regra.getContaContabil().getCodigo());
            if (regra.getCliente() != null) {
                s.setClienteId(regra.getCliente().getId());
            }
            if (regra.getProcesso() != null) {
                s.setProcessoId(regra.getProcesso().getId());
            }
            out.add(s);
        }
        return out;
    }

    private List<SugestaoClassificacaoResponse> camadaDepositoIdentificado(LancamentoFinanceiroEntity lancamento) {
        FinanceiroDescricaoPessoaExtracao ext = FinanceiroDescricaoPessoaExtrator.extrair(
                lancamento.getDescricao(), lancamento.getDescricaoDetalhada());
        if (!ext.temCpf()) {
            return List.of();
        }
        Optional<PessoaEntity> pessoaOpt = pessoaRepository.findByCpf(ext.cpfDigitos());
        if (pessoaOpt.isPresent() && StringUtils.hasText(ext.nome())
                && !nomesCompativeis(ext.nome(), pessoaOpt.get().getNome())) {
            return List.of();
        }

        List<LancamentoFinanceiroEntity> anteriores = lancamentoRepository.findDepositosIdentificadosPorCpfNoTexto(
                ext.cpfDigitos(),
                lancamento.getId(),
                EtapaLancamento.IMPORTADO,
                PageRequest.of(0, 3));
        if (anteriores.isEmpty()) {
            return List.of();
        }

        LancamentoFinanceiroEntity ref = anteriores.get(0);
        if (ref.getCliente() == null) {
            return List.of();
        }
        ContaContabilEntity contaA = ref.getContaContabil();
        if (contaA == null || !"A".equalsIgnoreCase(contaA.getCodigo())) {
            contaA = contaContabilRepository.findFirstByCodigoIgnoreCase("A").orElse(null);
        }
        if (contaA == null) {
            return List.of();
        }

        SugestaoClassificacaoResponse s = baseSugestao(contaA, ConfiancaSugestao.ALTA, OrigemSugestao.DEPOSITO_IDENTIFICADO);
        s.setClienteId(ref.getCliente().getId());
        if (ref.getProcesso() != null) {
            s.setProcessoId(ref.getProcesso().getId());
        }
        pessoaOpt.ifPresent(p -> s.setPagadorPessoaId(p.getId()));
        s.setOcorrencias((long) anteriores.size());
        s.setDescricaoRegra(montarDescricaoDepositoAnterior(ref, ext));
        s.setRotuloVinculo(montarRotuloVinculo(ref.getCliente().getId(), ref.getProcesso()));
        return List.of(s);
    }

    private List<SugestaoClassificacaoResponse> camadaPessoaProcessos(LancamentoFinanceiroEntity lancamento) {
        FinanceiroDescricaoPessoaExtracao ext = FinanceiroDescricaoPessoaExtrator.extrair(
                lancamento.getDescricao(), lancamento.getDescricaoDetalhada());
        if (!ext.temCpf()) {
            return List.of();
        }
        PessoaEntity pessoa = pessoaRepository.findByCpf(ext.cpfDigitos()).orElse(null);
        if (pessoa == null) {
            return List.of();
        }
        if (StringUtils.hasText(ext.nome()) && !nomesCompativeis(ext.nome(), pessoa.getNome())) {
            return List.of();
        }

        ContaContabilEntity contaA =
                contaContabilRepository.findFirstByCodigoIgnoreCase("A").orElse(null);
        if (contaA == null) {
            return List.of();
        }

        List<ProcessoEntity> processos = processoRepository.findAllDistinctVinculadosPessoa(pessoa.getId());
        if (processos.isEmpty()) {
            return List.of();
        }

        List<SugestaoClassificacaoResponse> out = new ArrayList<>();
        for (ProcessoEntity proc : processos) {
            if (proc.getPessoa() == null || proc.getNumeroInterno() == null) {
                continue;
            }
            SugestaoClassificacaoResponse s =
                    baseSugestao(contaA, ConfiancaSugestao.MEDIA, OrigemSugestao.PESSOA_PROCESSO);
            s.setClienteId(proc.getPessoa().getId());
            s.setProcessoId(proc.getId());
            s.setPagadorPessoaId(pessoa.getId());
            s.setRotuloVinculo(montarRotuloVinculo(proc.getPessoa().getId(), proc));
            s.setDescricaoRegra("cliente: " + resumirNome(pessoa.getNome()) + " → " + s.getRotuloVinculo());
            out.add(s);
        }
        return out;
    }

    private List<SugestaoClassificacaoResponse> camadaHistorico(LancamentoFinanceiroEntity lancamento) {
        String descricao = lancamento.getDescricao();
        if (!StringUtils.hasText(descricao)) {
            return List.of();
        }
        List<Object[]> rows = lancamentoRepository.contarContaPorDescricaoHistorico(
                lancamento.getNumeroBanco(), descricao.trim());
        List<SugestaoClassificacaoResponse> out = new ArrayList<>();
        for (Object[] row : rows) {
            Long contaId = ((Number) row[0]).longValue();
            long total = ((Number) row[1]).longValue();
            ContaContabilEntity conta = contaContabilRepository.findById(contaId)
                    .orElse(null);
            if (conta == null) {
                continue;
            }
            ConfiancaSugestao conf = total >= 3 ? ConfiancaSugestao.MEDIA : ConfiancaSugestao.BAIXA;
            SugestaoClassificacaoResponse s = baseSugestao(conta, conf, OrigemSugestao.HISTORICO);
            s.setOcorrencias(total);
            out.add(s);
        }
        return out;
    }

    private List<SugestaoClassificacaoResponse> camadaRecorrencia(LancamentoFinanceiroEntity lancamento) {
        if (lancamento.getNumeroBanco() == null || !StringUtils.hasText(lancamento.getDescricao())) {
            return List.of();
        }
        BigDecimal valor = lancamento.getValor();
        if (valor == null) {
            return List.of();
        }
        BigDecimal valorMin = valor.multiply(new BigDecimal("0.95")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal valorMax = valor.multiply(new BigDecimal("1.05")).setScale(2, RoundingMode.HALF_UP);
        int anoMes = lancamento.getDataLancamento().getYear() * 100 + lancamento.getDataLancamento().getMonthValue();

        List<LancamentoFinanceiroEntity> candidatos = lancamentoRepository.findRecorrenciaCandidatos(
                lancamento.getNumeroBanco(),
                lancamento.getDescricao().trim(),
                valorMin,
                valorMax,
                anoMes);
        if (candidatos.isEmpty()) {
            return List.of();
        }

        Map<Long, Long> freqPorConta = new LinkedHashMap<>();
        LancamentoFinanceiroEntity melhorA = null;
        for (LancamentoFinanceiroEntity c : candidatos) {
            Long contaId = c.getContaContabil().getId();
            freqPorConta.merge(contaId, 1L, Long::sum);
            if ("A".equalsIgnoreCase(c.getContaContabil().getCodigo()) && c.getCliente() != null) {
                if (melhorA == null || c.getDataLancamento().isAfter(melhorA.getDataLancamento())) {
                    melhorA = c;
                }
            }
        }

        Long contaIdMaisFrequente = freqPorConta.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);
        if (contaIdMaisFrequente == null) {
            return List.of();
        }
        ContaContabilEntity conta = contaContabilRepository.findById(contaIdMaisFrequente).orElse(null);
        if (conta == null) {
            return List.of();
        }

        SugestaoClassificacaoResponse s = baseSugestao(conta, ConfiancaSugestao.MEDIA, OrigemSugestao.RECORRENCIA);
        s.setOcorrencias(freqPorConta.get(contaIdMaisFrequente));
        if (melhorA != null && "A".equalsIgnoreCase(conta.getCodigo())) {
            s.setClienteId(melhorA.getCliente().getId());
            if (melhorA.getProcesso() != null) {
                s.setProcessoId(melhorA.getProcesso().getId());
            }
        }
        return List.of(s);
    }

    private static ConfiancaSugestao confiancaDeRegra(BigDecimal confianca) {
        if (confianca == null) {
            return ConfiancaSugestao.ALTA;
        }
        if (confianca.compareTo(new BigDecimal("0.90")) >= 0) {
            return ConfiancaSugestao.ALTA;
        }
        if (confianca.compareTo(new BigDecimal("0.70")) >= 0) {
            return ConfiancaSugestao.MEDIA;
        }
        return ConfiancaSugestao.BAIXA;
    }

    private static String textoParaMatch(LancamentoFinanceiroEntity lancamento) {
        String d1 = lancamento.getDescricao() != null ? lancamento.getDescricao() : "";
        String d2 = lancamento.getDescricaoDetalhada() != null ? lancamento.getDescricaoDetalhada() : "";
        return (d1 + " " + d2).trim();
    }

    private static SugestaoClassificacaoResponse baseSugestao(
            ContaContabilEntity conta, ConfiancaSugestao confianca, OrigemSugestao origem) {
        SugestaoClassificacaoResponse s = new SugestaoClassificacaoResponse();
        s.setContaContabilId(conta.getId());
        s.setContaCodigo(conta.getCodigo());
        s.setContaNome(conta.getNome());
        s.setConfianca(confianca);
        s.setOrigem(origem);
        return s;
    }

    private List<SugestaoClassificacaoResponse> deduplicarEOrdenar(List<SugestaoClassificacaoResponse> todas) {
        Map<String, SugestaoClassificacaoResponse> porChave = new LinkedHashMap<>();
        for (SugestaoClassificacaoResponse s : todas) {
            if (contaDesconhecida(s.getContaCodigo())) {
                continue;
            }
            String chave = chaveSugestao(s);
            SugestaoClassificacaoResponse existente = porChave.get(chave);
            if (existente == null || s.getConfianca().ordinal() < existente.getConfianca().ordinal()) {
                porChave.put(chave, s);
            }
        }
        return porChave.values().stream()
                .sorted(Comparator.comparingInt(s -> s.getConfianca().ordinal()))
                .collect(Collectors.toList());
    }

    /** Conta N = importado sem classificação; não sugerir aprovação automática. */
    private static boolean contaDesconhecida(String contaCodigo) {
        return StringUtils.hasText(contaCodigo) && "N".equalsIgnoreCase(contaCodigo.trim());
    }

    private static String chaveSugestao(SugestaoClassificacaoResponse s) {
        return s.getContaContabilId()
                + "|"
                + (s.getClienteId() != null ? s.getClienteId() : "")
                + "|"
                + (s.getProcessoId() != null ? s.getProcessoId() : "");
    }

    private String montarRotuloVinculo(Long clientePessoaId, ProcessoEntity processo) {
        if (clientePessoaId == null) {
            return "";
        }
        String cod = clienteCodigoPessoaResolver.codigoClienteExibicaoParaPessoaId(clientePessoaId);
        if (processo != null && processo.getNumeroInterno() != null) {
            return cod + " · proc " + processo.getNumeroInterno();
        }
        return cod;
    }

    private String montarDescricaoDepositoAnterior(
            LancamentoFinanceiroEntity ref, FinanceiroDescricaoPessoaExtracao ext) {
        String rotulo = montarRotuloVinculo(
                ref.getCliente().getId(), ref.getProcesso());
        String quando = ref.getDataLancamento() != null ? ref.getDataLancamento().toString() : "";
        String nome = StringUtils.hasText(ext.nome()) ? resumirNome(ext.nome()) : "mesmo CPF";
        return "depósito anterior (" + nome + ", " + quando + "): " + rotulo;
    }

    private static String resumirNome(String nome) {
        if (!StringUtils.hasText(nome)) {
            return "";
        }
        String t = nome.trim();
        return t.length() > 48 ? t.substring(0, 45) + "…" : t;
    }

    private static boolean nomesCompativeis(String nomeExtrato, String nomeCadastro) {
        String a = normalizarNomeComparacao(nomeExtrato);
        String b = normalizarNomeComparacao(nomeCadastro);
        if (!StringUtils.hasText(a) || !StringUtils.hasText(b)) {
            return true;
        }
        if (a.contains(b) || b.contains(a)) {
            return true;
        }
        Set<String> ta = tokensNomeSignificativos(a);
        Set<String> tb = tokensNomeSignificativos(b);
        if (ta.isEmpty() || tb.isEmpty()) {
            return false;
        }
        long comuns = ta.stream().filter(tb::contains).count();
        return comuns >= 2 || (comuns >= 1 && (ta.size() == 1 || tb.size() == 1));
    }

    private static String normalizarNomeComparacao(String nome) {
        if (!StringUtils.hasText(nome)) {
            return "";
        }
        String n = Normalizer.normalize(nome.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD);
        return n.replaceAll("\\p{M}+", "").replaceAll("[^a-z0-9\\s]", " ").replaceAll("\\s+", " ").trim();
    }

    private static Set<String> tokensNomeSignificativos(String nomeNorm) {
        Set<String> out = new LinkedHashSet<>();
        for (String t : nomeNorm.split("\\s+")) {
            if (t.length() >= 3 && !Set.of("dos", "das", "de", "da", "do", "e").contains(t)) {
                out.add(t);
            }
        }
        return out;
    }

    private void aplicarClassificacaoEmEntity(
            LancamentoFinanceiroEntity e, Long contaContabilId, Long clienteId, Long processoId) {
        ContaContabilEntity conta = contaContabilRepository.findById(contaContabilId)
                .orElseThrow(() -> new ResourceNotFoundException("Conta contábil não encontrada: " + contaContabilId));
        e.setContaContabil(conta);

        PessoaEntity cliente = null;
        if (clienteId != null) {
            cliente = pessoaRepository.findById(clienteId)
                    .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado: " + clienteId));
        }
        ProcessoEntity processo = null;
        if (processoId != null) {
            processo = processoRepository.findById(processoId)
                    .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));
            if (cliente != null && !processo.getPessoa().getId().equals(cliente.getId())) {
                throw new BusinessRuleException("O processo informado não pertence ao cliente indicado.");
            }
            if (cliente == null) {
                cliente = processo.getPessoa();
            }
        }
        e.setCliente(cliente);
        e.setProcesso(processo);

        Long cid = e.getCliente() != null ? e.getCliente().getId() : null;
        e.setEtapa(EtapaLancamento.calcular(conta.getCodigo(), e.getGrupoCompensacao(), cid));
    }

    private LancamentoFinanceiroEntity carregarLancamento(Long id) {
        return lancamentoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Lançamento não encontrado: " + id));
    }

    private LancamentoFinanceiroResponse toLancamentoResponse(LancamentoFinanceiroEntity e) {
        LancamentoFinanceiroResponse r = new LancamentoFinanceiroResponse();
        r.setId(e.getId());
        r.setContaContabilId(e.getContaContabil().getId());
        r.setContaContabilNome(Utf8MojibakeUtil.corrigir(e.getContaContabil().getNome()));
        r.setClienteId(e.getCliente() != null ? e.getCliente().getId() : null);
        r.setProcessoId(e.getProcesso() != null ? e.getProcesso().getId() : null);
        r.setBancoNome(Utf8MojibakeUtil.corrigir(e.getBancoNome()));
        r.setNumeroBanco(e.getNumeroBanco());
        r.setNumeroLancamento(Utf8MojibakeUtil.corrigir(e.getNumeroLancamento()));
        r.setDataLancamento(e.getDataLancamento());
        r.setDataCompetencia(e.getDataCompetencia());
        r.setDescricao(Utf8MojibakeUtil.corrigir(e.getDescricao()));
        r.setDescricaoDetalhada(Utf8MojibakeUtil.corrigir(e.getDescricaoDetalhada()));
        r.setValor(e.getValor());
        r.setNatureza(e.getNatureza());
        r.setRefTipo(Utf8MojibakeUtil.corrigir(e.getRefTipo()));
        r.setOrigem(Utf8MojibakeUtil.corrigir(e.getOrigem()));
        r.setStatus(Utf8MojibakeUtil.corrigir(e.getStatus()));
        r.setEtapa(e.getEtapa() != null ? e.getEtapa().name() : EtapaLancamento.IMPORTADO.name());
        r.setGrupoCompensacao(Utf8MojibakeUtil.corrigir(e.getGrupoCompensacao()));
        return r;
    }
}
