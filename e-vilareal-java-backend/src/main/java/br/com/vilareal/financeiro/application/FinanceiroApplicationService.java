package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.*;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.domain.StatusLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.LancamentoFinanceiroSpecifications;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.SaldoInicialBancoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.SaldoInicialBancoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.CompensacaoParDescarteRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.SemelhanteEscritorioDescarteRepository;
import br.com.vilareal.pessoa.application.ClienteResolverService;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.ClienteCodigoPessoaResolver;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.pessoa.application.TitularPessoaRefHelper;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class FinanceiroApplicationService {

    private static final Logger log = LoggerFactory.getLogger(FinanceiroApplicationService.class);
    private static final int LISTAGEM_SEM_PAGINACAO_MAX = 5000;

    private static final Sort ORDEM_LANCAMENTOS =
            Sort.by(Sort.Direction.ASC, "dataLancamento", "id");

    private final ContaContabilRepository contaContabilRepository;
    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final SaldoInicialBancoRepository saldoInicialRepository;
    private final SemelhanteEscritorioDescarteRepository semelhanteEscritorioDescarteRepository;
    private final CompensacaoParDescarteRepository compensacaoParDescarteRepository;
    private final PessoaRepository pessoaRepository;
    private final ProcessoRepository processoRepository;
    private final ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;
    private final ClienteResolverService clienteResolverService;
    private final ContaBancariaResolverService contaBancariaResolverService;
    private final FinanceiroSaudeService financeiroSaudeService;

    public FinanceiroApplicationService(
            ContaContabilRepository contaContabilRepository,
            LancamentoFinanceiroRepository lancamentoRepository,
            SaldoInicialBancoRepository saldoInicialRepository,
            SemelhanteEscritorioDescarteRepository semelhanteEscritorioDescarteRepository,
            CompensacaoParDescarteRepository compensacaoParDescarteRepository,
            PessoaRepository pessoaRepository,
            ProcessoRepository processoRepository,
            ClienteCodigoPessoaResolver clienteCodigoPessoaResolver,
            ClienteResolverService clienteResolverService,
            ContaBancariaResolverService contaBancariaResolverService,
            @Lazy FinanceiroSaudeService financeiroSaudeService) {
        this.contaContabilRepository = contaContabilRepository;
        this.lancamentoRepository = lancamentoRepository;
        this.saldoInicialRepository = saldoInicialRepository;
        this.semelhanteEscritorioDescarteRepository = semelhanteEscritorioDescarteRepository;
        this.compensacaoParDescarteRepository = compensacaoParDescarteRepository;
        this.pessoaRepository = pessoaRepository;
        this.processoRepository = processoRepository;
        this.clienteCodigoPessoaResolver = clienteCodigoPessoaResolver;
        this.clienteResolverService = clienteResolverService;
        this.contaBancariaResolverService = contaBancariaResolverService;
        this.financeiroSaudeService = financeiroSaudeService;
    }

    private void invalidarCacheSaude() {
        financeiroSaudeService.invalidarCacheSaude();
    }

    @Transactional(readOnly = true)
    public List<ContaContabilResponse> listarContasAtivas() {
        return contaContabilRepository.findByAtivoTrueOrderByOrdemExibicaoAscIdAsc().stream()
                .map(this::toContaResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public ContaContabilResponse criarConta(ContaContabilWriteRequest req) {
        String codigo = normalizarCodigo(req.getCodigo());
        String nome = req.getNome().trim();
        validarUnicidadeConta(codigo, nome, null);
        ContaContabilEntity e = new ContaContabilEntity();
        e.setCodigo(codigo);
        e.setNome(nome);
        e.setAtivo(req.getAtivo());
        e.setOrdemExibicao(req.getOrdemExibicao());
        return toContaResponse(contaContabilRepository.save(e));
    }

    @Transactional
    public ContaContabilResponse atualizarConta(Long id, ContaContabilWriteRequest req) {
        ContaContabilEntity e = contaContabilRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Conta contábil não encontrada: " + id));
        String codigo = normalizarCodigo(req.getCodigo());
        String nome = req.getNome().trim();
        validarUnicidadeConta(codigo, nome, id);
        e.setCodigo(codigo);
        e.setNome(nome);
        e.setAtivo(req.getAtivo());
        e.setOrdemExibicao(req.getOrdemExibicao());
        return toContaResponse(contaContabilRepository.save(e));
    }

    @Transactional(readOnly = true)
    public List<LancamentoFinanceiroResponse> listarLancamentos(
            Long clienteId,
            Long processoId,
            Long contaContabilId,
            java.time.LocalDate dataInicio,
            java.time.LocalDate dataFim) {
        Page<LancamentoFinanceiroResponse> page = listarLancamentosPaginado(
                clienteId,
                processoId,
                contaContabilId,
                dataInicio,
                dataFim,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                PageRequest.of(0, LISTAGEM_SEM_PAGINACAO_MAX, ORDEM_LANCAMENTOS));
        if (page.getTotalElements() > LISTAGEM_SEM_PAGINACAO_MAX) {
            log.warn(
                    "GET /lancamentos sem paginação atingiu limite de {} de {} registros",
                    LISTAGEM_SEM_PAGINACAO_MAX,
                    page.getTotalElements());
        }
        return page.getContent();
    }

    @Transactional(readOnly = true)
    public Page<LancamentoFinanceiroResponse> listarLancamentosPaginado(
            Long clienteId,
            Long processoId,
            Long contaContabilId,
            java.time.LocalDate dataInicio,
            java.time.LocalDate dataFim,
            EtapaLancamento etapa,
            Integer numeroBanco,
            String busca,
            Boolean semClienteId,
            Boolean semGrupoCompensacao,
            Integer ano,
            Integer mes,
            String contaCodigos,
            Boolean contaCodigosExcluir,
            String cadastroPlenitude,
            String codigoCliente,
            Integer numeroInternoProcesso,
            Pageable pageable) {
        var codigos = LancamentoFinanceiroSpecifications.parseContaCodigosParam(contaCodigos);
        boolean excluir = Boolean.TRUE.equals(contaCodigosExcluir);
        var spec = LancamentoFinanceiroSpecifications.comFiltros(
                resolverClientePkFiltro(clienteId),
                processoId,
                codigos.isEmpty() ? contaContabilId : null,
                dataInicio,
                dataFim,
                etapa,
                numeroBanco,
                busca,
                semClienteId,
                semGrupoCompensacao,
                ano,
                mes,
                codigos,
                excluir,
                cadastroPlenitude);
        spec = spec.and(comChaveNaturalContaCorrente(codigoCliente, numeroInternoProcesso));
        return lancamentoRepository.findAll(spec, pageable).map(this::toLancamentoResponse);
    }

    @Transactional(readOnly = true)
    public Page<LancamentoExtratoListItemResponse> listarExtratoPaginado(
            Long clienteId,
            Long processoId,
            Long contaContabilId,
            java.time.LocalDate dataInicio,
            java.time.LocalDate dataFim,
            EtapaLancamento etapa,
            Integer numeroBanco,
            String busca,
            Boolean semClienteId,
            Boolean semGrupoCompensacao,
            Integer ano,
            Integer mes,
            String contaCodigos,
            Boolean contaCodigosExcluir,
            String cadastroPlenitude,
            String codigoCliente,
            Integer numeroInternoProcesso,
            Pageable pageable) {
        var codigos = LancamentoFinanceiroSpecifications.parseContaCodigosParam(contaCodigos);
        boolean excluir = Boolean.TRUE.equals(contaCodigosExcluir);
        var spec = LancamentoFinanceiroSpecifications.comFiltros(
                resolverClientePkFiltro(clienteId),
                processoId,
                codigos.isEmpty() ? contaContabilId : null,
                dataInicio,
                dataFim,
                etapa,
                numeroBanco,
                busca,
                semClienteId,
                semGrupoCompensacao,
                ano,
                mes,
                codigos,
                excluir,
                cadastroPlenitude);
        spec = spec.and(comChaveNaturalContaCorrente(codigoCliente, numeroInternoProcesso));
        return lancamentoRepository.findAll(spec, pageable).map(this::toExtratoListItem);
    }

    @Transactional(readOnly = true)
    public SaldoBancoResponse saldoPorNumeroBanco(Integer numeroBanco) {
        return saldoPorNumeroBanco(numeroBanco, null);
    }

    @Transactional(readOnly = true)
    public SaldoBancoResponse saldoPorNumeroBanco(Integer numeroBanco, java.time.LocalDate dataReferencia) {
        if (numeroBanco == null) {
            throw new BusinessRuleException("numeroBanco é obrigatório.");
        }
        var r = new SaldoBancoResponse();
        r.setNumeroBanco(numeroBanco);
        r.setDataUltimoLancamento(lancamentoRepository.findDataUltimoLancamentoPorNumeroBanco(numeroBanco));
        if (dataReferencia != null) {
            var saldoAte = lancamentoRepository.sumSaldoAssinadoPorNumeroBancoAteData(numeroBanco, dataReferencia);
            var movDia = lancamentoRepository.sumSaldoAssinadoPorNumeroBancoNoDia(numeroBanco, dataReferencia);
            var abertura = saldoAberturaAplicavel(numeroBanco, dataReferencia);
            r.setDataReferencia(dataReferencia);
            r.setSaldoInicial(abertura);
            r.setSaldo((saldoAte != null ? saldoAte : java.math.BigDecimal.ZERO).add(abertura));
            r.setLancamentosAteData(lancamentoRepository.countByNumeroBancoAteData(numeroBanco, dataReferencia));
            r.setMovimentoNoDia(movDia != null ? movDia : java.math.BigDecimal.ZERO);
            r.setLancamentosNoDia(lancamentoRepository.countByNumeroBancoNoDia(numeroBanco, dataReferencia));
            r.setTotalLancamentos(lancamentoRepository.countByNumeroBanco(numeroBanco));
        } else {
            var saldo = lancamentoRepository.sumSaldoAssinadoPorNumeroBanco(numeroBanco);
            var abertura = saldoAberturaAplicavel(numeroBanco, null);
            r.setSaldoInicial(abertura);
            r.setSaldo((saldo != null ? saldo : java.math.BigDecimal.ZERO).add(abertura));
            r.setTotalLancamentos(lancamentoRepository.countByNumeroBanco(numeroBanco));
        }
        return r;
    }

    /**
     * Saldo de abertura aplicável ao cálculo: o valor informado para o banco quando a data de
     * referência do cálculo for {@code null} (saldo total) ou não anterior à
     * {@code dataReferencia} do saldo inicial. Caso contrário, zero.
     */
    private java.math.BigDecimal saldoAberturaAplicavel(Integer numeroBanco, LocalDate dataAte) {
        if (numeroBanco == null) {
            return java.math.BigDecimal.ZERO;
        }
        return saldoInicialRepository.findById(numeroBanco)
                .filter(s -> dataAte == null || !dataAte.isBefore(s.getDataReferencia()))
                .map(SaldoInicialBancoEntity::getValor)
                .orElse(java.math.BigDecimal.ZERO);
    }

    @Transactional(readOnly = true)
    public SaldoBancoMensalResponse saldoMensalPorDia(Integer numeroBanco, int ano, int mes) {
        if (numeroBanco == null) {
            throw new BusinessRuleException("numeroBanco é obrigatório.");
        }
        if (mes < 1 || mes > 12) {
            throw new BusinessRuleException("mes deve estar entre 1 e 12.");
        }
        var inicioMes = java.time.LocalDate.of(ano, mes, 1);
        var fimMes = inicioMes.withDayOfMonth(inicioMes.lengthOfMonth());

        var inicioMesVespera = inicioMes.minusDays(1);
        var saldoInicial = lancamentoRepository.sumSaldoAssinadoPorNumeroBancoAteData(
                numeroBanco, inicioMesVespera);
        if (saldoInicial == null) {
            saldoInicial = java.math.BigDecimal.ZERO;
        }
        saldoInicial = saldoInicial.add(saldoAberturaAplicavel(numeroBanco, inicioMesVespera));

        var movPorDia = new java.util.HashMap<java.time.LocalDate, java.math.BigDecimal>();
        var countPorDia = new java.util.HashMap<java.time.LocalDate, Long>();
        for (Object[] row : lancamentoRepository.sumMovimentoPorDiaNoPeriodo(numeroBanco, inicioMes, fimMes)) {
            var data = toLocalDate(row[0]);
            if (data == null) {
                continue;
            }
            movPorDia.put(data, row[1] != null ? new java.math.BigDecimal(row[1].toString()) : java.math.BigDecimal.ZERO);
            countPorDia.put(data, row[2] != null ? ((Number) row[2]).longValue() : 0L);
        }

        var acumulado = saldoInicial;
        var dias = new java.util.ArrayList<SaldoBancoDiaResponse>();
        for (int d = 1; d <= fimMes.getDayOfMonth(); d++) {
            var dia = inicioMes.withDayOfMonth(d);
            var mov = movPorDia.getOrDefault(dia, java.math.BigDecimal.ZERO);
            acumulado = acumulado.add(mov);
            var item = new SaldoBancoDiaResponse();
            item.setData(dia);
            item.setMovimento(mov);
            item.setSaldo(acumulado);
            item.setLancamentosNoDia(countPorDia.getOrDefault(dia, 0L));
            dias.add(item);
        }

        var resp = new SaldoBancoMensalResponse();
        resp.setNumeroBanco(numeroBanco);
        resp.setAno(ano);
        resp.setMes(mes);
        resp.setSaldoInicial(saldoInicial);
        resp.setDias(dias);
        return resp;
    }

    @Transactional(readOnly = true)
    public SaldoInicialBancoResponse obterSaldoInicial(Integer numeroBanco) {
        if (numeroBanco == null) {
            throw new BusinessRuleException("numeroBanco é obrigatório.");
        }
        return saldoInicialRepository.findById(numeroBanco)
                .map(this::toSaldoInicialResponse)
                .orElse(null);
    }

    @Transactional
    public SaldoInicialBancoResponse salvarSaldoInicial(SaldoInicialBancoWriteRequest req) {
        if (req == null || req.getNumeroBanco() == null) {
            throw new BusinessRuleException("numeroBanco é obrigatório.");
        }
        if (req.getDataReferencia() == null) {
            throw new BusinessRuleException("dataReferencia é obrigatória.");
        }
        if (req.getValor() == null) {
            throw new BusinessRuleException("valor é obrigatório.");
        }
        var entity = saldoInicialRepository.findById(req.getNumeroBanco())
                .orElseGet(SaldoInicialBancoEntity::new);
        entity.setNumeroBanco(req.getNumeroBanco());
        entity.setBancoNome(StringUtils.hasText(req.getBancoNome()) ? req.getBancoNome().trim() : null);
        entity.setDataReferencia(req.getDataReferencia());
        entity.setValor(req.getValor());
        var salvo = saldoInicialRepository.save(entity);
        invalidarCacheSaude();
        return toSaldoInicialResponse(salvo);
    }

    @Transactional
    public void removerSaldoInicial(Integer numeroBanco) {
        if (numeroBanco == null) {
            throw new BusinessRuleException("numeroBanco é obrigatório.");
        }
        saldoInicialRepository.findById(numeroBanco).ifPresent(s -> {
            saldoInicialRepository.delete(s);
            invalidarCacheSaude();
        });
    }

    private SaldoInicialBancoResponse toSaldoInicialResponse(SaldoInicialBancoEntity e) {
        var r = new SaldoInicialBancoResponse();
        r.setNumeroBanco(e.getNumeroBanco());
        r.setBancoNome(e.getBancoNome());
        r.setDataReferencia(e.getDataReferencia());
        r.setValor(e.getValor());
        return r;
    }

    private static java.time.LocalDate toLocalDate(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof java.time.LocalDate ld) {
            return ld;
        }
        if (raw instanceof java.sql.Date sd) {
            return sd.toLocalDate();
        }
        if (raw instanceof java.util.Date ud) {
            return new java.sql.Date(ud.getTime()).toLocalDate();
        }
        return java.time.LocalDate.parse(raw.toString().substring(0, 10));
    }

    @Transactional(readOnly = true)
    public ResumoConsolidadoContasResponse resumoConsolidadoUltimosMeses(int meses) {
        int qtdMeses = Math.max(1, Math.min(meses, 24));
        var fimExclusive = java.time.LocalDate.now().plusMonths(1).withDayOfMonth(1);
        var inicio = fimExclusive.minusMonths(qtdMeses);

        ResumoConsolidadoContasResponse out = new ResumoConsolidadoContasResponse();
        for (Object[] row : lancamentoRepository.countLancamentosPorContaCodigo()) {
            String cod = row[0] != null ? String.valueOf(row[0]).trim().toUpperCase() : "";
            if (!cod.isEmpty()) {
                out.getTotaisPorConta().put(cod, row[1] != null ? ((Number) row[1]).longValue() : 0L);
            }
        }

        for (Object[] row : lancamentoRepository.resumoMensalPorContaNoPeriodo(inicio, fimExclusive)) {
            ResumoMensalContaResponse item = new ResumoMensalContaResponse();
            item.setContaCodigo(row[0] != null ? String.valueOf(row[0]).trim().toUpperCase() : "");
            item.setContaNome(row[1] != null ? Utf8MojibakeUtil.corrigir(String.valueOf(row[1])) : "");
            item.setAno(row[2] != null ? ((Number) row[2]).intValue() : 0);
            item.setMes(row[3] != null ? ((Number) row[3]).intValue() : 0);
            item.setSaldoMes(
                    row[4] != null
                            ? new java.math.BigDecimal(row[4].toString())
                            : java.math.BigDecimal.ZERO);
            item.setQuantidadeLancamentos(row[5] != null ? ((Number) row[5]).longValue() : 0L);
            out.getMeses().add(item);
        }
        return out;
    }

    @Transactional(readOnly = true)
    public Map<String, Long> contarPorEtapa() {
        Map<String, Long> mapa = new LinkedHashMap<>();
        for (EtapaLancamento e : EtapaLancamento.values()) {
            mapa.put(e.name(), 0L);
        }
        for (Object[] row : lancamentoRepository.contarPorEtapa()) {
            EtapaLancamento etapa = (EtapaLancamento) row[0];
            Long total = (Long) row[1];
            mapa.put(etapa.name(), total);
        }
        return mapa;
    }

    @Transactional(readOnly = true)
    public LancamentoFinanceiroResponse buscarLancamento(Long id) {
        return toLancamentoResponse(lancamentoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Lançamento não encontrado: " + id)));
    }

    @Transactional(readOnly = true)
    public List<LancamentoFinanceiroResponse> listarLancamentosPorGrupoCompensacao(String grupoCompensacao) {
        if (grupoCompensacao == null || grupoCompensacao.isBlank()) {
            return List.of();
        }
        return lancamentoRepository.findAllByGrupoCompensacao(grupoCompensacao.trim()).stream()
                .map(this::toLancamentoResponse)
                .toList();
    }

    @Transactional
    public LancamentoFinanceiroResponse criarLancamento(LancamentoFinanceiroWriteRequest req) {
        LancamentoFinanceiroEntity e = new LancamentoFinanceiroEntity();
        aplicarLancamento(e, req, true);
        LancamentoFinanceiroResponse saved = toLancamentoResponse(lancamentoRepository.save(e));
        invalidarCacheSaude();
        return saved;
    }

    @Transactional
    public LancamentoFinanceiroResponse atualizarLancamento(Long id, LancamentoFinanceiroWriteRequest req) {
        LancamentoFinanceiroEntity e = lancamentoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Lançamento não encontrado: " + id));
        aplicarLancamento(e, req, false);
        LancamentoFinanceiroResponse saved = toLancamentoResponse(lancamentoRepository.save(e));
        invalidarCacheSaude();
        return saved;
    }

    @Transactional
    public void removerLancamento(Long id) {
        if (!lancamentoRepository.existsById(id)) {
            throw new ResourceNotFoundException("Lançamento não encontrado: " + id);
        }
        removerDependenciasLancamentos(List.of(id));
        lancamentoRepository.deleteById(id);
        invalidarCacheSaude();
    }

    /**
     * Soft-delete reversível: oculta lançamentos do extrato/consolidado sem apagar a linha (UK intacta).
     * Idempotente — ids já {@link StatusLancamento#APOSENTADO} são ignorados.
     */
    @Transactional
    public int aposentarLancamentos(Collection<Long> ids, String motivo) {
        if (ids == null || ids.isEmpty()) {
            return 0;
        }
        Set<Long> unicos = new HashSet<>();
        for (Long id : ids) {
            if (id != null) {
                unicos.add(id);
            }
        }
        if (unicos.isEmpty()) {
            return 0;
        }
        List<LancamentoFinanceiroEntity> lancamentos = lancamentoRepository.findAllByIdIn(unicos);
        int alterados = 0;
        for (LancamentoFinanceiroEntity l : lancamentos) {
            if (StatusLancamento.isAposentado(l.getStatus())) {
                continue;
            }
            l.setStatus(StatusLancamento.APOSENTADO);
            alterados++;
            log.info(
                    "Lancamento aposentado id={} numeroBanco={} numeroLancamento={} motivo={}",
                    l.getId(),
                    l.getNumeroBanco(),
                    l.getNumeroLancamento(),
                    StringUtils.hasText(motivo) ? motivo.trim() : "(sem motivo)");
        }
        if (alterados > 0) {
            lancamentoRepository.saveAll(lancamentos);
            invalidarCacheSaude();
        }
        return alterados;
    }

    /**
     * Reverte {@link #aposentarLancamentos} — restaura visibilidade operacional ({@link StatusLancamento#ATIVO}).
     * Idempotente — ids já ativos são ignorados.
     */
    @Transactional
    public int reativarLancamentos(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return 0;
        }
        Set<Long> unicos = new HashSet<>();
        for (Long id : ids) {
            if (id != null) {
                unicos.add(id);
            }
        }
        if (unicos.isEmpty()) {
            return 0;
        }
        List<LancamentoFinanceiroEntity> lancamentos = lancamentoRepository.findAllByIdIn(unicos);
        int alterados = 0;
        for (LancamentoFinanceiroEntity l : lancamentos) {
            if (StatusLancamento.isAtivo(l.getStatus())) {
                continue;
            }
            l.setStatus(StatusLancamento.ATIVO);
            alterados++;
            log.info(
                    "Lancamento reativado id={} numeroBanco={} numeroLancamento={}",
                    l.getId(),
                    l.getNumeroBanco(),
                    l.getNumeroLancamento());
        }
        if (alterados > 0) {
            lancamentoRepository.saveAll(lancamentos);
            invalidarCacheSaude();
        }
        return alterados;
    }

    /**
     * Apaga todos os lançamentos do extrato do banco indicado (nome normalizado e/ou {@code numero_banco}).
     * Colunas de elo/eq no servidor foram removidas (V34); não há mais desvinculação em outros bancos na API.
     *
     * @param numeroBanco opcional — quando informado, apaga todos os lançamentos com esse {@code numero_banco}
     *                    (Nº do consolidado na UI), além dos que batem pelo nome normalizado.
     */
    @Transactional
    public LimparExtratoResult limparExtratoBancoEElosRelacionados(String bancoRaw, Integer numeroBanco) {
        if (!StringUtils.hasText(bancoRaw)) {
            throw new BusinessRuleException("Nome do banco é obrigatório.");
        }
        final String bancoNorm = bancoRaw.trim().toUpperCase(Locale.ROOT);
        Map<Long, LancamentoFinanceiroEntity> porId = new LinkedHashMap<>();
        for (LancamentoFinanceiroEntity l : lancamentoRepository.findAllByBancoNormalizado(bancoNorm)) {
            porId.put(l.getId(), l);
        }
        if (numeroBanco != null) {
            for (LancamentoFinanceiroEntity l : lancamentoRepository.findAllByNumeroBanco(numeroBanco)) {
                porId.put(l.getId(), l);
            }
        }
        List<LancamentoFinanceiroEntity> toDelete = new ArrayList<>(porId.values());
        int removidos = toDelete.size();
        if (!toDelete.isEmpty()) {
            List<Long> ids = toDelete.stream().map(LancamentoFinanceiroEntity::getId).toList();
            removerDependenciasLancamentos(ids);
            lancamentoRepository.deleteAll(toDelete);
            invalidarCacheSaude();
        }
        LimparExtratoResult r = new LimparExtratoResult();
        r.setLancamentosRemovidos(removidos);
        r.setLancamentosDesvinculadosOutrosBancos(0);
        return r;
    }

    /** Compatível com clientes que só chamavam a limpeza do extrato CORA. */
    @Transactional
    public LimparExtratoResult limparExtratoCoraEElosRelacionados() {
        return limparExtratoBancoEElosRelacionados("CORA", null);
    }

    /**
     * Remove vínculos auxiliares que referenciam lançamentos do extrato antes do DELETE em
     * {@code financeiro_lancamento} (FKs sem ON DELETE CASCADE).
     */
    private void removerDependenciasLancamentos(Collection<Long> lancamentoIds) {
        if (lancamentoIds == null || lancamentoIds.isEmpty()) {
            return;
        }
        semelhanteEscritorioDescarteRepository.deleteByLancamentoIdIn(lancamentoIds);
        compensacaoParDescarteRepository.deleteByEnvolvendoLancamentos(lancamentoIds);
    }

    @Transactional(readOnly = true)
    public ResumoProcessoFinanceiroResponse resumoPorProcesso(Long processoId) {
        if (!processoRepository.existsById(processoId)) {
            throw new ResourceNotFoundException("Processo não encontrado: " + processoId);
        }
        var saldo = lancamentoRepository.sumSaldoAssinadoPorProcesso(processoId);
        long total = lancamentoRepository.countByProcesso_Id(processoId);
        ResumoProcessoFinanceiroResponse r = new ResumoProcessoFinanceiroResponse();
        r.setSaldo(saldo != null ? saldo : java.math.BigDecimal.ZERO);
        r.setTotalLancamentos(total);
        return r;
    }

    private void validarUnicidadeConta(String codigo, String nome, Long idExcluir) {
        if (idExcluir == null) {
            if (contaContabilRepository.existsByCodigoIgnoreCase(codigo)) {
                throw new BusinessRuleException("Já existe conta com este código.");
            }
            if (contaContabilRepository.existsByNome(nome)) {
                throw new BusinessRuleException("Já existe conta com este nome.");
            }
        } else {
            if (contaContabilRepository.existsByCodigoIgnoreCaseAndIdNot(codigo, idExcluir)) {
                throw new BusinessRuleException("Já existe conta com este código.");
            }
            if (contaContabilRepository.existsByNomeAndIdNot(nome, idExcluir)) {
                throw new BusinessRuleException("Já existe conta com este nome.");
            }
        }
    }

    private static String normalizarCodigo(String codigo) {
        String c = codigo != null ? codigo.trim().toUpperCase() : "";
        if (!StringUtils.hasText(c) || c.length() > 4) {
            throw new BusinessRuleException("Código da conta contábil inválido.");
        }
        return c;
    }

    private void aplicarLancamento(LancamentoFinanceiroEntity e, LancamentoFinanceiroWriteRequest req, boolean criacao) {
        ContaContabilEntity conta = contaContabilRepository.findById(req.getContaContabilId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Conta contábil não encontrada: " + req.getContaContabilId()));
        e.setContaContabil(conta);

        ProcessoEntity processo = null;
        if (req.getProcessoId() != null) {
            processo = processoRepository.findById(req.getProcessoId())
                    .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + req.getProcessoId()));
        }
        ClienteResolverService.VinculoClientePessoa vinculo =
                clienteResolverService.resolverVinculoOpcional(req.getClienteId(), processo);
        e.setClienteEntidade(vinculo.clienteEntidade());
        e.setProcesso(processo);

        e.setBancoNome(req.getBancoNome() != null && !req.getBancoNome().isBlank() ? req.getBancoNome().trim() : null);
        e.setNumeroBanco(req.getNumeroBanco());
        // B1: FK conta_bancaria sempre populada a partir do numero_banco (auto-provisiona se novo).
        // Não dirige comportamento ainda (B2/B3); só garante a FK.
        e.setContaBancaria(contaBancariaResolverService.resolver(req.getNumeroBanco(), e.getBancoNome()));
        e.setNumeroLancamento(req.getNumeroLancamento().trim());
        e.setDataLancamento(req.getDataLancamento());
        if (criacao) {
            e.setDataCompetencia(req.getDataCompetencia() != null ? req.getDataCompetencia() : req.getDataLancamento());
        } else if (req.getDataCompetencia() != null) {
            e.setDataCompetencia(req.getDataCompetencia());
        }
        e.setDescricao(req.getDescricao().trim());
        e.setDescricaoDetalhada(
                req.getDescricaoDetalhada() != null && StringUtils.hasText(req.getDescricaoDetalhada())
                        ? req.getDescricaoDetalhada().trim()
                        : null);
        e.setValor(req.getValor());
        e.setNatureza(req.getNatureza());
        String refTipoReq = req.getRefTipo() != null && StringUtils.hasText(req.getRefTipo())
                ? req.getRefTipo().trim().toUpperCase()
                : "";
        e.setRefTipo("R".equals(refTipoReq) ? "R" : "N");

        String origem = req.getOrigem() != null ? req.getOrigem().trim() : "";
        e.setOrigem(StringUtils.hasText(origem) ? origem : "MANUAL");

        String status = req.getStatus() != null ? req.getStatus().trim() : "";
        e.setStatus(StringUtils.hasText(status) ? status : StatusLancamento.ATIVO);

        if (req.getGrupoCompensacao() != null) {
            String g = req.getGrupoCompensacao().trim();
            e.setGrupoCompensacao(StringUtils.hasText(g) ? g : null);
        }

        aplicarEtapa(e, req, conta);
    }

    private void aplicarEtapa(
            LancamentoFinanceiroEntity e, LancamentoFinanceiroWriteRequest req, ContaContabilEntity conta) {
        if (req.getEtapa() != null && StringUtils.hasText(req.getEtapa())) {
            e.setEtapa(EtapaLancamento.valueOf(req.getEtapa().trim().toUpperCase(Locale.ROOT)));
            return;
        }
        Long clienteFkId = e.getClienteEntidade() != null ? e.getClienteEntidade().getId() : null;
        e.setEtapa(EtapaLancamento.calcular(conta.getCodigo(), e.getGrupoCompensacao(), clienteFkId));
    }

    private String codigoClienteExibicaoLancamento(LancamentoFinanceiroEntity e) {
        if (e.getClienteEntidade() != null) {
            return e.getClienteEntidade().getCodigoCliente();
        }
        if (e.getPessoaRef() != null) {
            return clienteCodigoPessoaResolver.codigoClienteExibicaoParaPessoaId(e.getPessoaRef().getId());
        }
        return null;
    }

    private Long resolverClientePkFiltro(Long clienteIdParam) {
        if (clienteIdParam == null) {
            return null;
        }
        return clienteResolverService.buscarPorId(clienteIdParam).getId();
    }

    /** Filtro Cod. Cliente + Proc. (colunas da Conta Corrente), alinhado ao frontend legado. */
    private Specification<LancamentoFinanceiroEntity> comChaveNaturalContaCorrente(
            String codigoCliente, Integer numeroInternoProcesso) {
        if (!StringUtils.hasText(codigoCliente) && numeroInternoProcesso == null) {
            return (root, query, cb) -> null;
        }
        Specification<LancamentoFinanceiroEntity> spec = Specification.where(null);
        if (StringUtils.hasText(codigoCliente)) {
            String norm = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente.trim());
            Long clientePk = clienteResolverService
                    .encontrarClientePorCodigo(codigoCliente)
                    .map(ClienteEntity::getId)
                    .orElse(null);
            Long pessoaId = clienteCodigoPessoaResolver
                    .resolverPessoaIdComFallbackCliente(codigoCliente)
                    .orElse(null);
            Specification<LancamentoFinanceiroEntity> codSpec =
                    LancamentoFinanceiroSpecifications.comCodigoClienteExibicao(norm, clientePk, pessoaId);
            spec = spec.and(codSpec != null ? codSpec : (root, query, cb) -> cb.disjunction());
        }
        if (numeroInternoProcesso != null) {
            spec = spec.and(LancamentoFinanceiroSpecifications.comProcExibicao(numeroInternoProcesso));
        }
        return spec;
    }

    private ContaContabilResponse toContaResponse(ContaContabilEntity e) {
        ContaContabilResponse r = new ContaContabilResponse();
        r.setId(e.getId());
        r.setCodigo(Utf8MojibakeUtil.corrigir(e.getCodigo()));
        r.setNome(Utf8MojibakeUtil.corrigir(e.getNome()));
        r.setAtivo(e.getAtivo());
        r.setOrdemExibicao(e.getOrdemExibicao());
        return r;
    }

    private LancamentoExtratoListItemResponse toExtratoListItem(LancamentoFinanceiroEntity e) {
        LancamentoExtratoListItemResponse r = new LancamentoExtratoListItemResponse();
        r.setId(e.getId());
        r.setContaContabilId(e.getContaContabil().getId());
        r.setContaContabilNome(e.getContaContabil().getNome());
        if (e.getClienteEntidade() != null) {
            r.setClienteId(e.getClienteEntidade().getId());
        }
        Long titularId =
                TitularPessoaRefHelper.titularPessoaId(e.getProcesso(), e.getPessoaRef(), e.getClienteEntidade());
        if (titularId != null) {
            r.setPessoaRefId(titularId);
        }
        r.setProcessoId(e.getProcesso() != null ? e.getProcesso().getId() : null);
        r.setCodigoCliente(codigoClienteExibicaoLancamento(e));
        if (e.getProcesso() != null && e.getProcesso().getNumeroInterno() != null) {
            r.setNumeroInternoProcesso(e.getProcesso().getNumeroInterno());
        }
        r.setBancoNome(e.getBancoNome());
        r.setNumeroBanco(e.getNumeroBanco());
        r.setNumeroLancamento(e.getNumeroLancamento());
        r.setDataLancamento(e.getDataLancamento());
        r.setDescricao(e.getDescricao());
        r.setDescricaoDetalhada(e.getDescricaoDetalhada());
        r.setValor(e.getValor());
        r.setNatureza(e.getNatureza());
        r.setRefTipo(e.getRefTipo());
        r.setOrigem(e.getOrigem());
        r.setEtapa(e.getEtapa() != null ? e.getEtapa().name() : EtapaLancamento.IMPORTADO.name());
        r.setGrupoCompensacao(e.getGrupoCompensacao());
        return r;
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
        r.setCodigoCliente(codigoClienteExibicaoLancamento(e));
        if (e.getProcesso() != null && e.getProcesso().getNumeroInterno() != null) {
            r.setNumeroInternoProcesso(e.getProcesso().getNumeroInterno());
        }
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

    /**
     * Atualiza {@code grupo_compensacao} em lote (backfill planilha col. M), por {@code numero_lancamento}.
     */
    @Transactional
    public GrupoCompensacaoLoteResult sincronizarGruposCompensacaoLote(List<GrupoCompensacaoLoteItemRequest> itens) {
        GrupoCompensacaoLoteResult result = new GrupoCompensacaoLoteResult();
        if (itens == null || itens.isEmpty()) {
            return result;
        }
        List<String> numeros = itens.stream()
                .filter(i -> i != null && StringUtils.hasText(i.getNumeroLancamento()))
                .map(i -> i.getNumeroLancamento().trim())
                .distinct()
                .toList();
        Map<String, LancamentoFinanceiroEntity> porNumero = lancamentoRepository.findByNumeroLancamentoIn(numeros)
                .stream()
                .collect(Collectors.toMap(LancamentoFinanceiroEntity::getNumeroLancamento, e -> e, (a, b) -> a));
        List<LancamentoFinanceiroEntity> toSave = new ArrayList<>();
        for (GrupoCompensacaoLoteItemRequest item : itens) {
            if (item == null || !StringUtils.hasText(item.getNumeroLancamento())) {
                result.setIgnorados(result.getIgnorados() + 1);
                continue;
            }
            String num = item.getNumeroLancamento().trim();
            LancamentoFinanceiroEntity e = porNumero.get(num);
            if (e == null) {
                result.setNaoEncontrados(result.getNaoEncontrados() + 1);
                continue;
            }
            String g = item.getGrupoCompensacao() != null ? item.getGrupoCompensacao().trim() : "";
            e.setGrupoCompensacao(StringUtils.hasText(g) ? g : null);
            toSave.add(e);
            result.setAtualizados(result.getAtualizados() + 1);
        }
        if (!toSave.isEmpty()) {
            lancamentoRepository.saveAll(toSave);
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<LancamentoNaoVinculadoPagamentoResponse> listarDebitosNaoVinculadosPagamento(
            LocalDate periodoInicio, LocalDate periodoFim, Integer numeroBanco) {
        if (periodoInicio == null || periodoFim == null) {
            throw new BusinessRuleException("Informe periodoInicio e periodoFim.");
        }
        return lancamentoRepository
                .findDebitosNaoVinculadosPagamento(NaturezaLancamento.DEBITO, periodoInicio, periodoFim, numeroBanco)
                .stream()
                .map(this::toNaoVinculadoPagamentoResponse)
                .collect(Collectors.toList());
    }

    private LancamentoNaoVinculadoPagamentoResponse toNaoVinculadoPagamentoResponse(LancamentoFinanceiroEntity e) {
        LancamentoNaoVinculadoPagamentoResponse r = new LancamentoNaoVinculadoPagamentoResponse();
        r.setId(e.getId());
        r.setDataLancamento(e.getDataLancamento());
        r.setDescricao(e.getDescricao());
        r.setDescricaoDetalhada(e.getDescricaoDetalhada());
        r.setValor(e.getValor());
        r.setBancoNome(e.getBancoNome());
        r.setNumeroBanco(e.getNumeroBanco());
        r.setContaContabilId(e.getContaContabil() != null ? e.getContaContabil().getId() : null);
        return r;
    }
}
