package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.*;
import br.com.vilareal.financeiro.domain.*;
import br.com.vilareal.financeiro.domain.FinanceiroDescricaoPessoaExtracao;
import br.com.vilareal.financeiro.domain.FinanceiroDescricaoPessoaExtrator;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoCartaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.RegraClassificacaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoCartaoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.RegraClassificacaoRepository;
import br.com.vilareal.imovel.application.LocacaoReconciliacaoService;
import br.com.vilareal.pessoa.application.ClienteResolverService;
import br.com.vilareal.pessoa.application.TitularPessoaRefHelper;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.api.dto.ProcessoPartesVinculoTexto;
import br.com.vilareal.processo.application.ClienteCodigoPessoaResolver;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class FinanceiroSugestaoService {

    /** Alinhado a PAGE_SIZE_OPTIONS do frontend e spring.data.web.pageable.max-page-size. */
    public static final int MAX_SUGESTAO_CLASSIFICACAO_LOTE = 1000;

    private final RegraClassificacaoRepository regraRepository;
    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final LancamentoCartaoRepository lancamentoCartaoRepository;
    private final FinanceiroCartaoApplicationService financeiroCartaoService;
    private final ContaContabilRepository contaContabilRepository;
    private final PessoaRepository pessoaRepository;
    private final ProcessoRepository processoRepository;
    private final ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;
    private final ProcessoApplicationService processoApplicationService;
    private final FinanceiroSaudeService financeiroSaudeService;
    private final ClienteResolverService clienteResolverService;
    private final LocacaoReconciliacaoService locacaoReconciliacaoService;

    public FinanceiroSugestaoService(
            RegraClassificacaoRepository regraRepository,
            LancamentoFinanceiroRepository lancamentoRepository,
            LancamentoCartaoRepository lancamentoCartaoRepository,
            @Lazy FinanceiroCartaoApplicationService financeiroCartaoService,
            ContaContabilRepository contaContabilRepository,
            PessoaRepository pessoaRepository,
            ProcessoRepository processoRepository,
            ClienteCodigoPessoaResolver clienteCodigoPessoaResolver,
            @Lazy ProcessoApplicationService processoApplicationService,
            ClienteResolverService clienteResolverService,
            @Lazy FinanceiroSaudeService financeiroSaudeService,
            @Lazy LocacaoReconciliacaoService locacaoReconciliacaoService) {
        this.regraRepository = regraRepository;
        this.lancamentoRepository = lancamentoRepository;
        this.lancamentoCartaoRepository = lancamentoCartaoRepository;
        this.financeiroCartaoService = financeiroCartaoService;
        this.contaContabilRepository = contaContabilRepository;
        this.pessoaRepository = pessoaRepository;
        this.processoRepository = processoRepository;
        this.clienteCodigoPessoaResolver = clienteCodigoPessoaResolver;
        this.processoApplicationService = processoApplicationService;
        this.clienteResolverService = clienteResolverService;
        this.financeiroSaudeService = financeiroSaudeService;
        this.locacaoReconciliacaoService = locacaoReconciliacaoService;
    }

    @Transactional(readOnly = true)
    public List<SugestaoClassificacaoResponse> sugerir(Long lancamentoId) {
        return sugerirPorId(lancamentoId);
    }

    @Transactional(readOnly = true)
    public List<SugestaoClassificacaoResponse> sugerir(LancamentoFinanceiroEntity lancamento) {
        return sugerirInterno(lancamento, false);
    }

    private List<SugestaoClassificacaoResponse> sugerirInterno(
            LancamentoFinanceiroEntity lancamento, boolean cartao) {
        List<SugestaoClassificacaoResponse> todas = new ArrayList<>();
        todas.addAll(camadaRendimentosAplicacoes(lancamento));
        boolean compensacaoInterna = FinanceiroDescricaoIndicaContaE.indica(
                lancamento.getDescricao(), lancamento.getDescricaoDetalhada());
        todas.addAll(camadaCompensacaoItamarVrv(lancamento));
        todas.addAll(camadaFinanciamentoImobiliario(lancamento));
        todas.addAll(camadaRegras(lancamento));
        if (!compensacaoInterna) {
            List<SugestaoClassificacaoResponse> deposito = camadaDepositoIdentificado(lancamento);
            todas.addAll(deposito);
            if (deposito.isEmpty()) {
                todas.addAll(camadaPessoaProcessos(lancamento));
            }
        }
        todas.addAll(camadaHistorico(lancamento, cartao));
        todas.addAll(camadaRecorrencia(lancamento, cartao));
        return deduplicarEOrdenar(todas);
    }

    @Transactional(readOnly = true)
    public Map<Long, List<SugestaoClassificacaoResponse>> sugerirLote(List<Long> lancamentoIds) {
        if (lancamentoIds == null || lancamentoIds.isEmpty()) {
            return Map.of();
        }
        if (lancamentoIds.size() > MAX_SUGESTAO_CLASSIFICACAO_LOTE) {
            throw new BusinessRuleException(
                    "Máximo de " + MAX_SUGESTAO_CLASSIFICACAO_LOTE + " lançamentos por lote.");
        }
        Map<Long, List<SugestaoClassificacaoResponse>> out = new LinkedHashMap<>();
        for (Long id : lancamentoIds) {
            out.put(id, sugerirPorId(id));
        }
        return out;
    }

    @Transactional
    public LancamentoFinanceiroResponse aplicarSugestao(AplicarSugestaoRequest req) {
        var banco = lancamentoRepository.findById(req.getLancamentoId());
        if (banco.isPresent()) {
            LancamentoFinanceiroEntity e = banco.get();
            aplicarClassificacaoEmEntity(e, req.getContaContabilId(), req.getClienteId(), req.getProcessoId());
            LancamentoFinanceiroEntity persistido = lancamentoRepository.save(e);
            locacaoReconciliacaoService.registrarAluguelClassificado(persistido);
            LancamentoFinanceiroResponse saved = toLancamentoResponse(persistido);
            financeiroSaudeService.invalidarCacheSaude();
            return saved;
        }
        LancamentoCartaoEntity cartao = lancamentoCartaoRepository
                .findById(req.getLancamentoId())
                .orElseThrow(() -> new ResourceNotFoundException("Lançamento não encontrado: " + req.getLancamentoId()));
        financeiroCartaoService.aplicarClassificacaoInbox(
                req.getLancamentoId(),
                req.getContaContabilId(),
                req.getClienteId(),
                req.getProcessoId());
        return lancamentoCartaoRepository
                .findById(req.getLancamentoId())
                .map(financeiroCartaoService::toInboxClassificarResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Lançamento não encontrado: " + req.getLancamentoId()));
    }

    private List<SugestaoClassificacaoResponse> sugerirPorId(Long lancamentoId) {
        return lancamentoRepository
                .findById(lancamentoId)
                .map(this::sugerir)
                .orElseGet(() -> lancamentoCartaoRepository
                        .findById(lancamentoId)
                        .map(this::sugerirCartao)
                        .orElse(List.of()));
    }

    private List<SugestaoClassificacaoResponse> sugerirCartao(LancamentoCartaoEntity cartao) {
        return sugerirInterno(adaptarCartaoParaSugestao(cartao), true);
    }

    private LancamentoFinanceiroEntity adaptarCartaoParaSugestao(LancamentoCartaoEntity cartao) {
        LancamentoFinanceiroEntity e = new LancamentoFinanceiroEntity();
        e.setId(cartao.getId());
        e.setDescricao(cartao.getDescricao());
        e.setDescricaoDetalhada(cartao.getDescricaoDetalhada());
        e.setDescricaoNorm(cartao.getDescricaoNorm());
        BigDecimal valor = cartao.getValor() != null ? cartao.getValor() : BigDecimal.ZERO;
        e.setValor(valor.abs());
        e.setNatureza(valor.signum() < 0 ? NaturezaLancamento.CREDITO : NaturezaLancamento.DEBITO);
        if (cartao.getCartao() != null) {
            e.setNumeroBanco(cartao.getCartao().getNumeroCartao());
            e.setBancoNome(cartao.getCartao().getNome());
        }
        e.setDataLancamento(cartao.getDataLancamento());
        e.setDataCompetencia(cartao.getDataCompetencia());
        return e;
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

    private List<SugestaoClassificacaoResponse> camadaCompensacaoItamarVrv(LancamentoFinanceiroEntity lancamento) {
        if (!FinanceiroDescricaoIndicaContaE.indica(lancamento.getDescricao(), lancamento.getDescricaoDetalhada())) {
            return List.of();
        }
        ContaContabilEntity contaE =
                contaContabilRepository.findFirstByCodigoIgnoreCase("E").orElse(null);
        if (contaE == null) {
            return List.of();
        }
        SugestaoClassificacaoResponse s =
                baseSugestao(contaE, ConfiancaSugestao.ALTA, OrigemSugestao.REGRA);
        s.setDescricaoRegra("transferência interna Itamar/VRV → E");
        return List.of(s);
    }

    private List<SugestaoClassificacaoResponse> camadaFinanciamentoImobiliario(LancamentoFinanceiroEntity lancamento) {
        if (!FinanceiroDescricaoIndicaContaI.indica(lancamento.getDescricao(), lancamento.getDescricaoDetalhada())) {
            return List.of();
        }
        ContaContabilEntity contaI =
                contaContabilRepository.findFirstByCodigoIgnoreCase("I").orElse(null);
        if (contaI == null) {
            return List.of();
        }
        SugestaoClassificacaoResponse s =
                baseSugestao(contaI, ConfiancaSugestao.ALTA, OrigemSugestao.REGRA);
        s.setDescricaoRegra("financiamento imobiliário → I");
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
            preencherClienteIdSugestao(s, regra.getClienteEntidade(), regra.getPessoaRef(), regra.getProcesso());
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

        List<LancamentoFinanceiroEntity> refs = buscarDepositosIdentificadosReferencia(lancamento, ext);
        if (refs.isEmpty()) {
            return List.of();
        }

        boolean posterior = refs.stream()
                .anyMatch(r -> lancamento.getDataLancamento() != null
                        && r.getDataLancamento() != null
                        && r.getDataLancamento().isAfter(lancamento.getDataLancamento()));

        LancamentoFinanceiroEntity ref = refs.get(0);
        if (ref.getPessoaRef() == null) {
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
        preencherClienteIdSugestao(s, ref.getClienteEntidade(), ref.getPessoaRef(), ref.getProcesso());
        if (ref.getProcesso() != null) {
            s.setProcessoId(ref.getProcesso().getId());
        }
        pessoaOpt.ifPresent(p -> s.setPagadorPessoaId(p.getId()));
        s.setOcorrencias((long) refs.size());
        s.setDescricaoRegra(
                posterior
                        ? montarDescricaoDepositoPosterior(ref, ext)
                        : montarDescricaoDepositoAnterior(ref, ext));
        s.setRotuloVinculo(montarRotuloVinculo(ref.getPessoaRef().getId(), ref.getProcesso()));
        return List.of(s);
    }

    private List<LancamentoFinanceiroEntity> buscarDepositosIdentificadosReferencia(
            LancamentoFinanceiroEntity lancamento, FinanceiroDescricaoPessoaExtracao ext) {
        Long excluirId = lancamento.getId();
        LocalDate dataRef = lancamento.getDataLancamento();
        Pageable page = PageRequest.of(0, 3);
        if (dataRef != null) {
            List<LancamentoFinanceiroEntity> anteriores = lancamentoRepository.findDepositosIdentificadosPorCpfAnteriores(
                    ext.cpfDigitos(), excluirId, EtapaLancamento.IMPORTADO, dataRef, page);
            if (!anteriores.isEmpty()) {
                return anteriores;
            }
            return lancamentoRepository.findDepositosIdentificadosPorCpfPosteriores(
                    ext.cpfDigitos(), excluirId, EtapaLancamento.IMPORTADO, dataRef, page);
        }
        return lancamentoRepository.findDepositosIdentificadosPorCpfNoTexto(
                ext.cpfDigitos(), excluirId, EtapaLancamento.IMPORTADO, page);
    }

    private List<SugestaoClassificacaoResponse> camadaPessoaProcessos(LancamentoFinanceiroEntity lancamento) {
        FinanceiroDescricaoPessoaExtracao ext = FinanceiroDescricaoPessoaExtrator.extrair(
                lancamento.getDescricao(), lancamento.getDescricaoDetalhada());
        List<SugestaoClassificacaoResponse> out = new ArrayList<>(camadaPessoaProcessosPorCpf(lancamento, ext));
        if (out.isEmpty()) {
            out.addAll(camadaPessoaProcessosPorNomeNaDescricao(lancamento));
        }
        return out;
    }

    private List<SugestaoClassificacaoResponse> camadaPessoaProcessosPorCpf(
            LancamentoFinanceiroEntity lancamento, FinanceiroDescricaoPessoaExtracao ext) {
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
        return montarSugestoesPessoaProcessos(pessoa);
    }

    /**
     * Quando não há CPF na descrição, localiza pessoas cadastradas (titular ou parte de processo)
     * cujo nome aparece no texto do extrato — ex.: PIX com nome da parte oposta.
     */
    private List<SugestaoClassificacaoResponse> camadaPessoaProcessosPorNomeNaDescricao(
            LancamentoFinanceiroEntity lancamento) {
        String descNorm = normalizarTextoDescricaoBuscaPessoa(
                lancamento.getDescricao(), lancamento.getDescricaoDetalhada());
        if (!StringUtils.hasText(descNorm)) {
            return List.of();
        }

        ContaContabilEntity contaA =
                contaContabilRepository.findFirstByCodigoIgnoreCase("A").orElse(null);
        if (contaA == null) {
            return List.of();
        }

        List<Object[]> vinculos = processoRepository.findPessoaProcessoIdsPorNomeContidoNaDescricao(descNorm);
        if (vinculos.isEmpty()) {
            return List.of();
        }

        Set<Long> processoIds = new LinkedHashSet<>();
        Map<Long, PessoaEntity> pessoasPorId = new LinkedHashMap<>();
        for (Object[] row : vinculos) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            Long pessoaId = ((Number) row[0]).longValue();
            Long processoId = ((Number) row[1]).longValue();
            PessoaEntity pessoa = pessoasPorId.computeIfAbsent(
                    pessoaId, id -> pessoaRepository.findById(id).orElse(null));
            if (pessoa == null || !nomesCompativeis(descNorm, pessoa.getNome())) {
                continue;
            }
            processoIds.add(processoId);
        }
        if (processoIds.isEmpty()) {
            return List.of();
        }

        Map<Long, List<ProcessoEntity>> processosPorPessoa = new LinkedHashMap<>();
        for (Object[] row : vinculos) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            Long pessoaId = ((Number) row[0]).longValue();
            Long processoId = ((Number) row[1]).longValue();
            PessoaEntity pessoa = pessoasPorId.get(pessoaId);
            if (pessoa == null || !processoIds.contains(processoId)) {
                continue;
            }
            ProcessoEntity proc = processoRepository.findById(processoId).orElse(null);
            if (proc == null || proc.getPessoa() == null || proc.getNumeroInterno() == null) {
                continue;
            }
            List<ProcessoEntity> lista =
                    processosPorPessoa.computeIfAbsent(pessoaId, ignored -> new ArrayList<>());
            if (lista.stream().noneMatch(p -> Objects.equals(p.getId(), proc.getId()))) {
                lista.add(proc);
            }
        }

        List<SugestaoClassificacaoResponse> out = new ArrayList<>();
        for (Map.Entry<Long, List<ProcessoEntity>> entry : processosPorPessoa.entrySet()) {
            PessoaEntity pessoa = pessoasPorId.get(entry.getKey());
            if (pessoa == null) {
                continue;
            }
            out.addAll(montarSugestoesProcessosPriorizados(
                    entry.getValue(), pessoa.getId(), pessoa.getNome(), "nome na descrição"));
        }
        return out;
    }

    private List<SugestaoClassificacaoResponse> montarSugestoesPessoaProcessos(PessoaEntity pessoa) {
        List<ProcessoEntity> processos = processoRepository.findAllDistinctVinculadosPessoa(pessoa.getId());
        return montarSugestoesProcessosPriorizados(processos, pessoa.getId(), pessoa.getNome(), "cliente");
    }

    private List<SugestaoClassificacaoResponse> montarSugestoesProcessosPriorizados(
            List<ProcessoEntity> processosBrutos,
            Long pagadorPessoaId,
            String pagadorNome,
            String prefixoRegra) {
        ContaContabilEntity contaA =
                contaContabilRepository.findFirstByCodigoIgnoreCase("A").orElse(null);
        if (contaA == null) {
            return List.of();
        }

        List<ProcessoEntity> processos = processosBrutos.stream()
                .filter(p -> p.getPessoa() != null && p.getNumeroInterno() != null)
                .collect(Collectors.toCollection(ArrayList::new));
        if (processos.isEmpty()) {
            return List.of();
        }

        Map<Long, ProcessoVinculoSugestaoPrioridadeUtil.AtividadeProcesso> atividade =
                carregarAtividadeProcessos(processos);
        processos.sort(ProcessoVinculoSugestaoPrioridadeUtil.comparadorProcessos(atividade));

        LocalDate hoje = LocalDate.now();
        List<SugestaoClassificacaoResponse> out = new ArrayList<>();
        for (int i = 0; i < processos.size(); i++) {
            ProcessoEntity proc = processos.get(i);
            ProcessoVinculoSugestaoPrioridadeUtil.AtividadeProcesso act = atividade.get(proc.getId());
            ConfiancaSugestao conf =
                    i == 0
                            ? ProcessoVinculoSugestaoPrioridadeUtil.confiancaPrincipalPessoaProcesso(act, hoje)
                            : ConfiancaSugestao.MEDIA;
            SugestaoClassificacaoResponse s =
                    baseSugestao(contaA, conf, OrigemSugestao.PESSOA_PROCESSO);
            preencherClienteIdSugestaoProcesso(s, proc);
            s.setProcessoId(proc.getId());
            s.setPagadorPessoaId(pagadorPessoaId);
            s.setRotuloVinculo(montarRotuloVinculo(proc.getPessoa().getId(), proc));
            s.setDescricaoRegra(
                    prefixoRegra
                            + ": "
                            + resumirNome(pagadorNome)
                            + ProcessoVinculoSugestaoPrioridadeUtil.sufixoAtividadeRegra(act)
                            + " → "
                            + s.getRotuloVinculo());
            out.add(s);
        }
        return out;
    }

    private Map<Long, ProcessoVinculoSugestaoPrioridadeUtil.AtividadeProcesso> carregarAtividadeProcessos(
            List<ProcessoEntity> processos) {
        List<Long> ids = processos.stream()
                .map(ProcessoEntity::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return ProcessoVinculoSugestaoPrioridadeUtil.indexarLinhasAtividade(
                lancamentoRepository.findAtividadeClassificadaPorProcessoIds(ids));
    }

    private static String normalizarTextoDescricaoBuscaPessoa(String descricao, String descricaoDetalhada) {
        String texto = ((descricao != null ? descricao : "") + " " + (descricaoDetalhada != null ? descricaoDetalhada : ""))
                .trim();
        if (!StringUtils.hasText(texto)) {
            return "";
        }
        String n = Normalizer.normalize(texto.toLowerCase(Locale.ROOT), Normalizer.Form.NFD);
        return n.replaceAll("\\p{M}+", "").replaceAll("[^a-z0-9\\s]", " ").replaceAll("\\s+", " ").trim();
    }

    private List<SugestaoClassificacaoResponse> camadaHistorico(
            LancamentoFinanceiroEntity lancamento, boolean cartao) {
        String descricao = lancamento.getDescricao();
        if (!StringUtils.hasText(descricao)) {
            return List.of();
        }
        String descricaoNorm = DescricaoNormalizer.normalizar(descricao);
        String chave = DescricaoNormalizer.chaveEstabelecimento(descricao);
        LocalDate dataRef = lancamento.getDataLancamento();
        Long excluirId = lancamento.getId();
        Integer numeroConta = lancamento.getNumeroBanco();

        List<Object[]> rows = List.of();
        OrigemSugestao origem = OrigemSugestao.HISTORICO;
        boolean prefixo = false;

        if (dataRef != null) {
            rows = buscarHistoricoRows(
                    cartao, numeroConta, descricaoNorm, chave, dataRef, excluirId, false, false);
            if (rows.isEmpty()) {
                rows = buscarHistoricoRows(
                        cartao, numeroConta, descricaoNorm, chave, dataRef, excluirId, true, false);
                origem = OrigemSugestao.HISTORICO_POSTERIOR;
            }
            if (rows.isEmpty()) {
                rows = buscarHistoricoRows(
                        cartao, numeroConta, descricaoNorm, chave, dataRef, excluirId, false, true);
                prefixo = true;
            }
            if (rows.isEmpty()) {
                rows = buscarHistoricoRows(
                        cartao, numeroConta, descricaoNorm, chave, dataRef, excluirId, true, true);
                origem = OrigemSugestao.HISTORICO_POSTERIOR;
                prefixo = true;
            }
        } else {
            rows = buscarHistoricoRows(
                    cartao, numeroConta, descricaoNorm, chave, null, excluirId, false, false);
            if (rows.isEmpty()) {
                rows = buscarHistoricoRows(
                        cartao, numeroConta, descricaoNorm, chave, null, excluirId, false, true);
                prefixo = true;
            }
        }
        return montarSugestoesHistorico(rows, origem, prefixo);
    }

    private List<Object[]> buscarHistoricoRows(
            boolean cartao,
            Integer numeroConta,
            String descricaoNorm,
            String chaveEstabelecimento,
            LocalDate dataRef,
            Long excluirId,
            boolean posterior,
            boolean prefixo) {
        if (numeroConta == null) {
            return List.of();
        }
        if (cartao) {
            if (dataRef == null) {
                return prefixo
                        ? lancamentoCartaoRepository.contarContaPorChaveEstabelecimentoHistoricoCartao(
                                numeroConta, descricaoNorm, chaveEstabelecimento)
                        : lancamentoCartaoRepository.contarContaPorDescricaoHistoricoCartao(
                                numeroConta, descricaoNorm);
            }
            if (prefixo) {
                return posterior
                        ? lancamentoCartaoRepository.contarContaPorChaveEstabelecimentoPosteriorCartao(
                                numeroConta, descricaoNorm, chaveEstabelecimento, dataRef, excluirId)
                        : lancamentoCartaoRepository.contarContaPorChaveEstabelecimentoAnteriorCartao(
                                numeroConta, descricaoNorm, chaveEstabelecimento, dataRef, excluirId);
            }
            return posterior
                    ? lancamentoCartaoRepository.contarContaPorDescricaoHistoricoPosteriorCartao(
                            numeroConta, descricaoNorm, dataRef, excluirId)
                    : lancamentoCartaoRepository.contarContaPorDescricaoHistoricoAnteriorCartao(
                            numeroConta, descricaoNorm, dataRef, excluirId);
        }
        if (dataRef == null) {
            return prefixo
                    ? lancamentoRepository.contarContaPorChaveEstabelecimentoHistorico(
                            numeroConta, descricaoNorm, chaveEstabelecimento)
                    : lancamentoRepository.contarContaPorDescricaoHistorico(numeroConta, descricaoNorm);
        }
        if (prefixo) {
            return posterior
                    ? lancamentoRepository.contarContaPorChaveEstabelecimentoPosterior(
                            numeroConta, descricaoNorm, chaveEstabelecimento, dataRef, excluirId)
                    : lancamentoRepository.contarContaPorChaveEstabelecimentoAnterior(
                            numeroConta, descricaoNorm, chaveEstabelecimento, dataRef, excluirId);
        }
        return posterior
                ? lancamentoRepository.contarContaPorDescricaoHistoricoPosterior(
                        numeroConta, descricaoNorm, dataRef, excluirId)
                : lancamentoRepository.contarContaPorDescricaoHistoricoAnterior(
                        numeroConta, descricaoNorm, dataRef, excluirId);
    }

    private List<SugestaoClassificacaoResponse> montarSugestoesHistorico(
            List<Object[]> rows, OrigemSugestao origem, boolean prefixo) {
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
            if (origem == OrigemSugestao.HISTORICO_POSTERIOR && conf == ConfiancaSugestao.MEDIA) {
                conf = ConfiancaSugestao.BAIXA;
            }
            if (prefixo) {
                conf = ConfiancaSugestao.BAIXA;
            }
            SugestaoClassificacaoResponse s = baseSugestao(conta, conf, origem);
            s.setOcorrencias(total);
            out.add(s);
        }
        return out;
    }

    private List<SugestaoClassificacaoResponse> camadaRecorrencia(
            LancamentoFinanceiroEntity lancamento, boolean cartao) {
        if (lancamento.getNumeroBanco() == null || !StringUtils.hasText(lancamento.getDescricao())) {
            return List.of();
        }
        BigDecimal valor = lancamento.getValor();
        if (valor == null || lancamento.getDataLancamento() == null) {
            return List.of();
        }
        BigDecimal valorMin = valor.multiply(new BigDecimal("0.95")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal valorMax = valor.multiply(new BigDecimal("1.05")).setScale(2, RoundingMode.HALF_UP);
        int anoMes = lancamento.getDataLancamento().getYear() * 100 + lancamento.getDataLancamento().getMonthValue();
        LocalDate dataRef = lancamento.getDataLancamento();
        Long excluirId = lancamento.getId();
        String descricaoNorm = DescricaoNormalizer.normalizar(lancamento.getDescricao());
        String chave = DescricaoNormalizer.chaveEstabelecimento(lancamento.getDescricao());

        List<LancamentoFinanceiroEntity> candidatos =
                buscarRecorrenciaComValor(cartao, lancamento, descricaoNorm, valorMin, valorMax, anoMes, dataRef, excluirId, false);
        OrigemSugestao origem = OrigemSugestao.RECORRENCIA;
        if (candidatos.isEmpty()) {
            candidatos = buscarRecorrenciaComValor(
                    cartao, lancamento, descricaoNorm, valorMin, valorMax, anoMes, dataRef, excluirId, true);
            origem = OrigemSugestao.RECORRENCIA_POSTERIOR;
        }
        if (candidatos.isEmpty()) {
            candidatos = buscarRecorrenciaPorNome(
                    cartao, lancamento.getNumeroBanco(), descricaoNorm, chave, dataRef, excluirId, false);
            origem = OrigemSugestao.RECORRENCIA_NOME;
        }
        if (candidatos.isEmpty()) {
            candidatos = buscarRecorrenciaPorNome(
                    cartao, lancamento.getNumeroBanco(), descricaoNorm, chave, dataRef, excluirId, true);
            origem = OrigemSugestao.RECORRENCIA_NOME;
        }
        if (candidatos.isEmpty()) {
            return List.of();
        }

        return montarSugestaoRecorrencia(lancamento, candidatos, origem);
    }

    private List<LancamentoFinanceiroEntity> buscarRecorrenciaComValor(
            boolean cartao,
            LancamentoFinanceiroEntity lancamento,
            String descricaoNorm,
            BigDecimal valorMin,
            BigDecimal valorMax,
            int anoMes,
            LocalDate dataRef,
            Long excluirId,
            boolean posterior) {
        Integer numeroConta = lancamento.getNumeroBanco();
        if (numeroConta == null) {
            return List.of();
        }
        if (cartao) {
            List<LancamentoCartaoEntity> cartoes = posterior
                    ? lancamentoCartaoRepository.findRecorrenciaCandidatosPosterioresCartao(
                            numeroConta, descricaoNorm, valorMin, valorMax, anoMes, dataRef, excluirId)
                    : lancamentoCartaoRepository.findRecorrenciaCandidatosAnterioresCartao(
                            numeroConta, descricaoNorm, valorMin, valorMax, anoMes, dataRef, excluirId);
            return cartoes.stream().map(this::adaptCartaoCandidatoRecorrencia).toList();
        }
        return posterior
                ? lancamentoRepository.findRecorrenciaCandidatosPosteriores(
                        numeroConta, descricaoNorm, valorMin, valorMax, anoMes, dataRef, excluirId)
                : lancamentoRepository.findRecorrenciaCandidatosAnteriores(
                        numeroConta, descricaoNorm, valorMin, valorMax, anoMes, dataRef, excluirId);
    }

    private List<LancamentoFinanceiroEntity> buscarRecorrenciaPorNome(
            boolean cartao,
            Integer numeroConta,
            String descricaoNorm,
            String chaveEstabelecimento,
            LocalDate dataRef,
            Long excluirId,
            boolean posterior) {
        if (numeroConta == null) {
            return List.of();
        }
        if (cartao) {
            List<LancamentoCartaoEntity> cartoes = posterior
                    ? lancamentoCartaoRepository.findRecorrenciaPorNomePosterioresCartao(
                            numeroConta, descricaoNorm, chaveEstabelecimento, dataRef, excluirId)
                    : lancamentoCartaoRepository.findRecorrenciaPorNomeAnterioresCartao(
                            numeroConta, descricaoNorm, chaveEstabelecimento, dataRef, excluirId);
            return cartoes.stream().map(this::adaptCartaoCandidatoRecorrencia).toList();
        }
        return posterior
                ? lancamentoRepository.findRecorrenciaPorNomePosteriores(
                        numeroConta, descricaoNorm, chaveEstabelecimento, dataRef, excluirId)
                : lancamentoRepository.findRecorrenciaPorNomeAnteriores(
                        numeroConta, descricaoNorm, chaveEstabelecimento, dataRef, excluirId);
    }

    private LancamentoFinanceiroEntity adaptCartaoCandidatoRecorrencia(LancamentoCartaoEntity c) {
        LancamentoFinanceiroEntity e = new LancamentoFinanceiroEntity();
        e.setContaContabil(c.getContaContabil());
        e.setDataLancamento(c.getDataLancamento());
        e.setPessoaRef(c.getPessoaRef());
        e.setClienteEntidade(c.getClienteEntidade());
        e.setProcesso(c.getProcesso());
        return e;
    }

    private List<SugestaoClassificacaoResponse> montarSugestaoRecorrencia(
            LancamentoFinanceiroEntity lancamento,
            List<LancamentoFinanceiroEntity> candidatos,
            OrigemSugestao origem) {
        Map<Long, Long> freqPorConta = new LinkedHashMap<>();
        LancamentoFinanceiroEntity melhorA = null;
        boolean posterior = origem == OrigemSugestao.RECORRENCIA_POSTERIOR;
        for (LancamentoFinanceiroEntity c : candidatos) {
            Long contaId = c.getContaContabil().getId();
            freqPorConta.merge(contaId, 1L, Long::sum);
            if ("A".equalsIgnoreCase(c.getContaContabil().getCodigo()) && c.getPessoaRef() != null) {
                if (!posterior) {
                    if (c.getDataLancamento() != null
                            && (melhorA == null
                                    || melhorA.getDataLancamento() == null
                                    || c.getDataLancamento().isAfter(melhorA.getDataLancamento()))) {
                        melhorA = c;
                    }
                } else if (c.getDataLancamento() != null
                        && (melhorA == null
                                || melhorA.getDataLancamento() == null
                                || c.getDataLancamento().isBefore(melhorA.getDataLancamento()))) {
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

        ConfiancaSugestao conf = origem == OrigemSugestao.RECORRENCIA ? ConfiancaSugestao.MEDIA : ConfiancaSugestao.BAIXA;
        SugestaoClassificacaoResponse s = baseSugestao(conta, conf, origem);
        s.setOcorrencias(freqPorConta.get(contaIdMaisFrequente));
        if (melhorA != null && "A".equalsIgnoreCase(conta.getCodigo())) {
            preencherClienteIdSugestao(s, melhorA.getClienteEntidade(), melhorA.getPessoaRef(), melhorA.getProcesso());
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
        String base =
                processo != null && processo.getNumeroInterno() != null
                        ? cod + " · proc " + processo.getNumeroInterno()
                        : cod;
        return base + montarSufixoPartesProcesso(processo);
    }

    /** «Parte Cliente x Parte oposta», alinhado à tela Processos / Publicações. */
    private String montarSufixoPartesProcesso(ProcessoEntity processo) {
        if (processo == null || processo.getId() == null) {
            return "";
        }
        ProcessoPartesVinculoTexto textos =
                processoApplicationService
                        .resolverTextosPartesVinculoEmLote(Set.of(processo.getId()))
                        .get(processo.getId());
        if (textos == null) {
            return "";
        }
        String parteCliente = StringUtils.hasText(textos.getParteCliente())
                ? textos.getParteCliente().trim()
                : "";
        String parteOposta = StringUtils.hasText(textos.getParteOposta())
                ? textos.getParteOposta().trim()
                : "";
        if (parteCliente.isEmpty() && parteOposta.isEmpty()) {
            return "";
        }
        if (!parteCliente.isEmpty() && !parteOposta.isEmpty()) {
            return " - " + parteCliente + " x " + parteOposta;
        }
        return " - " + (parteCliente.isEmpty() ? parteOposta : parteCliente);
    }

    private String montarDescricaoDepositoAnterior(
            LancamentoFinanceiroEntity ref, FinanceiroDescricaoPessoaExtracao ext) {
        String rotulo = montarRotuloVinculo(
                ref.getPessoaRef().getId(), ref.getProcesso());
        String quando = ref.getDataLancamento() != null ? ref.getDataLancamento().toString() : "";
        String nome = StringUtils.hasText(ext.nome()) ? resumirNome(ext.nome()) : "mesmo CPF";
        return "depósito anterior (" + nome + ", " + quando + "): " + rotulo;
    }

    private String montarDescricaoDepositoPosterior(
            LancamentoFinanceiroEntity ref, FinanceiroDescricaoPessoaExtracao ext) {
        String rotulo = montarRotuloVinculo(
                ref.getPessoaRef().getId(), ref.getProcesso());
        String quando = ref.getDataLancamento() != null ? ref.getDataLancamento().toString() : "";
        String nome = StringUtils.hasText(ext.nome()) ? resumirNome(ext.nome()) : "mesmo CPF";
        return "depósito posterior (" + nome + ", " + quando + "): " + rotulo;
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

        ProcessoEntity processo = null;
        if (processoId != null) {
            processo = processoRepository.findById(processoId)
                    .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));
        }
        ClienteResolverService.VinculoClientePessoa vinculo =
                clienteResolverService.resolverVinculoOpcional(clienteId, processo);
        e.setClienteEntidade(vinculo.clienteEntidade());
        e.setProcesso(processo);

        Long cid = e.getClienteEntidade() != null ? e.getClienteEntidade().getId() : null;
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
        if (e.getClienteEntidade() != null) {
            r.setClienteId(e.getClienteEntidade().getId());
        }
        Long titularId =
                TitularPessoaRefHelper.titularPessoaId(e.getProcesso(), e.getPessoaRef(), e.getClienteEntidade());
        if (titularId != null) {
            r.setPessoaRefId(titularId);
        }
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

    private void preencherClienteIdSugestaoProcesso(SugestaoClassificacaoResponse s, ProcessoEntity proc) {
        ClienteEntity cliente = proc.getCliente();
        if (cliente == null && proc.getPessoa() != null) {
            cliente = clienteResolverService.resolverClienteParaTitular(proc.getPessoa().getId());
        }
        if (cliente != null) {
            s.setClienteId(cliente.getId());
        }
        if (proc.getPessoa() != null) {
            s.setPessoaRefId(proc.getPessoa().getId());
        }
    }

    private void preencherClienteIdSugestao(
            SugestaoClassificacaoResponse s,
            ClienteEntity cliente,
            PessoaEntity pessoaRef,
            ProcessoEntity processo) {
        if (cliente != null) {
            s.setClienteId(cliente.getId());
        } else if (pessoaRef != null) {
            s.setClienteId(clienteResolverService.resolverClienteParaTitular(pessoaRef.getId()).getId());
        } else if (processo != null) {
            preencherClienteIdSugestaoProcesso(s, processo);
            return;
        }
        if (pessoaRef != null) {
            s.setPessoaRefId(pessoaRef.getId());
        }
    }
}
