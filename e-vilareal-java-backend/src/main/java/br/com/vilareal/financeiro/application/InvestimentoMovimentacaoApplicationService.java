package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.*;
import br.com.vilareal.financeiro.domain.*;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.*;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class InvestimentoMovimentacaoApplicationService {

    private static final List<Integer> CONTAS_CANDIDATAS = List.of(21, 27, 28);
    private static final BigDecimal TOLERANCIA_VALOR = new BigDecimal("0.005");
    private static final int TOLERANCIA_DIAS = 2;

    private final InvestimentoImportRepository importRepository;
    private final InvestimentoMovimentacaoRepository movimentacaoRepository;
    private final InvestimentoOperacaoRepository operacaoRepository;
    private final ContaBancariaRepository contaBancariaRepository;
    private final LancamentoFinanceiroRepository lancamentoRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public InvestimentoMovimentacaoApplicationService(
            InvestimentoImportRepository importRepository,
            InvestimentoMovimentacaoRepository movimentacaoRepository,
            InvestimentoOperacaoRepository operacaoRepository,
            ContaBancariaRepository contaBancariaRepository,
            LancamentoFinanceiroRepository lancamentoRepository) {
        this.importRepository = importRepository;
        this.movimentacaoRepository = movimentacaoRepository;
        this.operacaoRepository = operacaoRepository;
        this.contaBancariaRepository = contaBancariaRepository;
        this.lancamentoRepository = lancamentoRepository;
    }

    @Transactional
    public InvestimentoImportResponse importar(MultipartFile file, Integer numeroBancoInformado) throws IOException {
        byte[] bytes = file.getBytes();
        BtgMovimentacaoParser.ResultadoParse parse = BtgMovimentacaoParser.parse(new java.io.ByteArrayInputStream(bytes));
        if (parse.linhasCdb().isEmpty()) {
            throw new IllegalArgumentException("Nenhuma linha COMPRA/VENDA CDB/LCA encontrada no arquivo.");
        }

        String hash = sha256Hex(bytes);
        ContaBancariaEntity conta = resolverConta(numeroBancoInformado, parse.linhasCdb());

        Optional<InvestimentoImportEntity> existente =
                importRepository.findByContaBancaria_IdAndArquivoHash(conta.getId(), hash);
        if (existente.isPresent()) {
            vincularExtrato(conta.getId());
            recalcularOperacoes(conta.getId());
            return toImportResponse(existente.get());
        }

        LocalDate inicio = parse.linhasCdb().stream().map(BtgMovimentacaoParser.LinhaMovimentacao::dataMovimentacao).min(LocalDate::compareTo).orElse(null);
        LocalDate fim = parse.linhasCdb().stream().map(BtgMovimentacaoParser.LinhaMovimentacao::dataMovimentacao).max(LocalDate::compareTo).orElse(null);

        InvestimentoImportEntity batch = new InvestimentoImportEntity();
        batch.setContaBancaria(conta);
        batch.setArquivoNome(file.getOriginalFilename() != null ? file.getOriginalFilename() : "movimentacao.xlsx");
        batch.setArquivoHash(hash);
        batch.setPeriodoInicio(inicio);
        batch.setPeriodoFim(fim);
        batch.setTotalLinhas(parse.totalLinhas());
        batch.setLinhasCdb(parse.linhasCdb().size());
        batch.setStatus("OK");
        batch = importRepository.save(batch);

        int inseridas = 0;
        for (BtgMovimentacaoParser.LinhaMovimentacao linha : parse.linhasCdb()) {
            if (upsertMovimentacao(batch, conta, linha)) {
                inseridas++;
            }
        }
        batch.setLinhasCdb(inseridas);
        vincularExtrato(conta.getId());
        recalcularOperacoes(conta.getId());
        batch.setLinhasVinculadas((int) movimentacaoRepository.countByContaBancaria_IdAndLancamentoFinanceiroIsNotNull(conta.getId()));
        return toImportResponse(importRepository.save(batch));
    }

    @Transactional
    public void vincularExtrato(Long contaBancariaId) {
        ContaBancariaEntity conta = contaBancariaRepository.findById(contaBancariaId)
                .orElseThrow(() -> new IllegalArgumentException("Conta bancária não encontrada: " + contaBancariaId));
        List<InvestimentoMovimentacaoEntity> movs = movimentacaoRepository.findCdbPorConta(contaBancariaId);
        if (movs.isEmpty()) {
            return;
        }
        LocalDate inicio = movs.get(0).getDataMovimentacao().minusDays(TOLERANCIA_DIAS);
        LocalDate fim = movs.get(movs.size() - 1).getDataMovimentacao().plusDays(TOLERANCIA_DIAS);
        List<LancamentoFinanceiroEntity> lancamentos =
                lancamentoRepository.findCandidatosInvestimentoExtrato(conta.getNumeroBanco(), inicio, fim);
        Set<Long> usados = new HashSet<>();
        for (InvestimentoMovimentacaoEntity mov : movs) {
            if (mov.getLancamentoFinanceiro() != null) {
                usados.add(mov.getLancamentoFinanceiro().getId());
                continue;
            }
            LancamentoFinanceiroEntity match = melhorMatch(mov, lancamentos, usados);
            if (match != null) {
                mov.setLancamentoFinanceiro(match);
                mov.setVinculoConfianca(InvestimentoVinculoConfianca.ALTA);
                usados.add(match.getId());
            }
        }
    }

    @Transactional
    public void recalcularOperacoes(Long contaBancariaId) {
        ContaBancariaEntity conta = contaBancariaRepository.findById(contaBancariaId)
                .orElseThrow(() -> new IllegalArgumentException("Conta bancária não encontrada: " + contaBancariaId));
        operacaoRepository.deleteByContaBancariaId(contaBancariaId);
        entityManager.flush();

        List<InvestimentoMovimentacaoEntity> movs = movimentacaoRepository.findCdbPorConta(contaBancariaId);
        Map<String, Deque<InvestimentoMovimentacaoEntity>> comprasPorCodigo = new HashMap<>();
        List<ParCompraVenda> fechadasPendentes = new ArrayList<>();

        for (InvestimentoMovimentacaoEntity mov : movs) {
            if (!StringUtils.hasText(mov.getCodigoProduto())) {
                continue;
            }
            if ("C".equals(mov.getTipoExtrato())) {
                comprasPorCodigo.computeIfAbsent(mov.getCodigoProduto(), k -> new ArrayDeque<>()).addLast(mov);
            } else if ("V".equals(mov.getTipoExtrato())) {
                Deque<InvestimentoMovimentacaoEntity> fila = comprasPorCodigo.get(mov.getCodigoProduto());
                if (fila == null || fila.isEmpty()) {
                    operacaoRepository.save(criarOperacaoLegado(conta, mov));
                } else {
                    fechadasPendentes.add(new ParCompraVenda(fila.removeFirst(), mov));
                }
            }
        }

        fechadasPendentes.sort(Comparator.comparing(p -> valorCaixa(
                p.venda().getLancamentoFinanceiro(), p.venda().getValorOperacao())));

        List<InvestimentoOperacaoEntity> fechadasOps = new ArrayList<>();
        for (ParCompraVenda par : fechadasPendentes) {
            fechadasOps.add(criarOperacaoFechadaSemImpostos(conta, par.compra(), par.venda()));
        }

        fechadasOps.stream()
                .collect(Collectors.groupingBy(InvestimentoOperacaoEntity::getDataVenda))
                .forEach((dia, ops) -> alocarImpostosDoDia(conta.getNumeroBanco(), dia, ops));

        for (InvestimentoOperacaoEntity op : fechadasOps) {
            finalizarMetricasFechada(op);
            operacaoRepository.save(op);
        }

        for (Deque<InvestimentoMovimentacaoEntity> fila : comprasPorCodigo.values()) {
            for (InvestimentoMovimentacaoEntity compra : fila) {
                operacaoRepository.save(criarOperacaoAberta(conta, compra));
            }
        }
    }

    @Transactional(readOnly = true)
    public Page<InvestimentoOperacaoResponse> listarOperacoes(
            Long contaBancariaId,
            InvestimentoOperacaoStatus status,
            LocalDate dataCompraInicio,
            LocalDate dataCompraFim,
            LocalDate dataVendaInicio,
            LocalDate dataVendaFim,
            boolean somenteComTaxa,
            Pageable pageable) {
        return operacaoRepository
                .listarFiltrado(
                        contaBancariaId,
                        status,
                        dataCompraInicio,
                        dataCompraFim,
                        dataVendaInicio,
                        dataVendaFim,
                        somenteComTaxa,
                        pageable)
                .map(this::toOperacaoResponse);
    }

    @Transactional(readOnly = true)
    public InvestimentoResumoResponse obterResumo(Long contaBancariaId) {
        List<InvestimentoOperacaoEntity> fechadas = contaBancariaId != null
                ? operacaoRepository.findFechadasComTaxa(contaBancariaId)
                : operacaoRepository.findAll().stream()
                        .filter(o -> o.getStatus() == InvestimentoOperacaoStatus.FECHADA)
                        .filter(o -> o.getTaxaMensalLiquida() != null)
                        .toList();

        List<BigDecimal> taxas = fechadas.stream()
                .map(InvestimentoOperacaoEntity::getTaxaMensalLiquida)
                .filter(Objects::nonNull)
                .sorted()
                .toList();

        BigDecimal mediana = taxas.isEmpty() ? null : taxas.get(taxas.size() / 2);

        long abertas = contaBancariaId != null
                ? operacaoRepository.countByContaBancaria_IdAndStatus(contaBancariaId, InvestimentoOperacaoStatus.ABERTA)
                : operacaoRepository.findAll().stream()
                        .filter(o -> o.getStatus() == InvestimentoOperacaoStatus.ABERTA)
                        .count();

        BigDecimal volumeAberto = contaBancariaId != null
                ? operacaoRepository.sumVolumeAberto(contaBancariaId)
                : operacaoRepository.findAll().stream()
                        .filter(o -> o.getStatus() == InvestimentoOperacaoStatus.ABERTA)
                        .map(InvestimentoOperacaoEntity::getValorCompraCaixa)
                        .filter(Objects::nonNull)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);

        long vinculadas = contaBancariaId != null
                ? movimentacaoRepository.countByContaBancaria_IdAndLancamentoFinanceiroIsNotNull(contaBancariaId)
                : 0L;

        return new InvestimentoResumoResponse(fechadas.size(), (int) abertas, mediana, volumeAberto, vinculadas);
    }

    @Transactional(readOnly = true)
    public Long resolverContaBancariaId(Long contaBancariaId, Integer numeroBanco) {
        if (contaBancariaId != null) {
            return contaBancariaId;
        }
        if (numeroBanco == null) {
            return null;
        }
        return contaBancariaRepository.findByNumeroBanco(numeroBanco)
                .map(ContaBancariaEntity::getId)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<InvestimentoImportResponse> listarImports(Long contaBancariaId) {
        if (contaBancariaId == null) {
            return importRepository.findAll().stream().map(this::toImportResponse).toList();
        }
        return importRepository.findByContaBancaria_IdOrderByImportadoEmDesc(contaBancariaId).stream()
                .map(this::toImportResponse)
                .toList();
    }

    private ContaBancariaEntity resolverConta(Integer numeroBancoInformado, List<BtgMovimentacaoParser.LinhaMovimentacao> linhas) {
        if (numeroBancoInformado != null) {
            return contaBancariaRepository.findByNumeroBanco(numeroBancoInformado)
                    .orElseThrow(() -> new IllegalArgumentException("Conta bancária não cadastrada: " + numeroBancoInformado));
        }
        Map<Integer, Integer> scores = new HashMap<>();
        for (Integer nb : CONTAS_CANDIDATAS) {
            if (contaBancariaRepository.findByNumeroBanco(nb).isEmpty()) {
                continue;
            }
            LocalDate inicio = linhas.stream().map(BtgMovimentacaoParser.LinhaMovimentacao::dataMovimentacao).min(LocalDate::compareTo).orElse(LocalDate.now());
            LocalDate fim = linhas.stream().map(BtgMovimentacaoParser.LinhaMovimentacao::dataMovimentacao).max(LocalDate::compareTo).orElse(LocalDate.now());
            List<LancamentoFinanceiroEntity> lancamentos = lancamentoRepository.findCandidatosInvestimentoExtrato(nb, inicio.minusDays(TOLERANCIA_DIAS), fim.plusDays(TOLERANCIA_DIAS));
            int score = 0;
            for (BtgMovimentacaoParser.LinhaMovimentacao linha : linhas) {
                InvestimentoMovimentacaoEntity fake = new InvestimentoMovimentacaoEntity();
                fake.setDataMovimentacao(linha.dataMovimentacao());
                fake.setValorOperacao(linha.valorOperacao());
                fake.setTipoExtrato(linha.tipoExtrato());
                fake.setEmissor(linha.emissor());
                if (melhorMatch(fake, lancamentos, Set.of()) != null) {
                    score++;
                }
            }
            scores.put(nb, score);
        }
        Integer melhor = scores.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(21);
        return contaBancariaRepository.findByNumeroBanco(melhor)
                .orElseThrow(() -> new IllegalStateException("Nenhuma conta BTG candidata encontrada."));
    }

    private boolean upsertMovimentacao(
            InvestimentoImportEntity batch, ContaBancariaEntity conta, BtgMovimentacaoParser.LinhaMovimentacao linha) {
        Optional<InvestimentoMovimentacaoEntity> existente = movimentacaoRepository.findAll().stream()
                .filter(m -> conta.getId().equals(m.getContaBancaria().getId()))
                .filter(m -> linha.dataMovimentacao().equals(m.getDataMovimentacao()))
                .filter(m -> Objects.equals(linha.codigoProduto(), m.getCodigoProduto()))
                .filter(m -> linha.tipoMovimentacao().equals(m.getTipoMovimentacao()))
                .filter(m -> linha.naturezaMov().equals(m.getNaturezaMov()))
                .filter(m -> linha.valorOperacao().compareTo(m.getValorOperacao()) == 0)
                .findFirst();

        InvestimentoMovimentacaoEntity mov = existente.orElseGet(InvestimentoMovimentacaoEntity::new);
        boolean novo = mov.getId() == null;
        mov.setImportBatch(batch);
        mov.setContaBancaria(conta);
        mov.setNaturezaMov(linha.naturezaMov());
        mov.setDataMovimentacao(linha.dataMovimentacao());
        mov.setTipoMovimentacao(linha.tipoMovimentacao());
        mov.setProdutoRaw(linha.produtoRaw());
        mov.setCodigoProduto(linha.codigoProduto());
        mov.setTipoProduto(linha.tipoProduto());
        mov.setEmissor(linha.emissor());
        mov.setInstituicao(linha.instituicao());
        mov.setQuantidade(linha.quantidade());
        mov.setPrecoUnitario(linha.precoUnitario());
        mov.setValorOperacao(linha.valorOperacao());
        mov.setTipoExtrato(linha.tipoExtrato());
        movimentacaoRepository.save(mov);
        return novo;
    }

    private LancamentoFinanceiroEntity melhorMatch(
            InvestimentoMovimentacaoEntity mov,
            List<LancamentoFinanceiroEntity> lancamentos,
            Set<Long> usados) {
        LancamentoFinanceiroEntity best = null;
        BigDecimal bestDiff = null;
        for (LancamentoFinanceiroEntity l : lancamentos) {
            if (usados.contains(l.getId())) {
                continue;
            }
            if (!tipoCompativel(mov, l)) {
                continue;
            }
            if (Math.abs(l.getDataLancamento().toEpochDay() - mov.getDataMovimentacao().toEpochDay()) > TOLERANCIA_DIAS) {
                continue;
            }
            BigDecimal diff = l.getValor().subtract(mov.getValorOperacao()).abs();
            BigDecimal pct = diff.divide(mov.getValorOperacao(), 6, RoundingMode.HALF_UP);
            if (pct.compareTo(TOLERANCIA_VALOR) <= 0 && (bestDiff == null || pct.compareTo(bestDiff) < 0)) {
                best = l;
                bestDiff = pct;
            }
        }
        return best;
    }

    private boolean tipoCompativel(InvestimentoMovimentacaoEntity mov, LancamentoFinanceiroEntity l) {
        String desc = l.getDescricao() != null ? l.getDescricao().toUpperCase(Locale.ROOT) : "";
        if ("C".equals(mov.getTipoExtrato())) {
            return desc.startsWith("COMPRA");
        }
        if ("V".equals(mov.getTipoExtrato())) {
            return desc.startsWith("VENDA");
        }
        return false;
    }

    private InvestimentoOperacaoEntity criarOperacaoLegado(ContaBancariaEntity conta, InvestimentoMovimentacaoEntity venda) {
        InvestimentoOperacaoEntity op = baseOperacao(conta, venda.getCodigoProduto(), venda.getTipoProduto(), venda.getEmissor());
        op.setStatus(InvestimentoOperacaoStatus.LEGADO);
        op.setVendaMovimentacao(venda);
        op.setVendaLancamento(venda.getLancamentoFinanceiro());
        op.setDataVenda(venda.getDataMovimentacao());
        if (venda.getLancamentoFinanceiro() != null) {
            op.setValorVendaCaixa(venda.getLancamentoFinanceiro().getValor());
        }
        op.setVinculoConfianca(venda.getVinculoConfianca());
        return op;
    }

    private InvestimentoOperacaoEntity criarOperacaoAberta(ContaBancariaEntity conta, InvestimentoMovimentacaoEntity compra) {
        InvestimentoOperacaoEntity op = baseOperacao(conta, compra.getCodigoProduto(), compra.getTipoProduto(), compra.getEmissor());
        op.setStatus(InvestimentoOperacaoStatus.ABERTA);
        op.setCompraMovimentacao(compra);
        op.setCompraLancamento(compra.getLancamentoFinanceiro());
        op.setDataCompra(compra.getDataMovimentacao());
        if (compra.getLancamentoFinanceiro() != null) {
            op.setValorCompraCaixa(compra.getLancamentoFinanceiro().getValor());
        }
        op.setVinculoConfianca(compra.getVinculoConfianca());
        return op;
    }

    private InvestimentoOperacaoEntity criarOperacaoFechadaSemImpostos(
            ContaBancariaEntity conta,
            InvestimentoMovimentacaoEntity compra,
            InvestimentoMovimentacaoEntity venda) {
        String emissor = resolverEmissorInvestimento(compra, venda);
        InvestimentoOperacaoEntity op = baseOperacao(conta, compra.getCodigoProduto(), compra.getTipoProduto(), emissor);
        op.setStatus(InvestimentoOperacaoStatus.FECHADA);
        op.setCompraMovimentacao(compra);
        op.setVendaMovimentacao(venda);
        op.setCompraLancamento(compra.getLancamentoFinanceiro());
        op.setVendaLancamento(venda.getLancamentoFinanceiro());
        op.setDataCompra(compra.getDataMovimentacao());
        op.setDataVenda(venda.getDataMovimentacao());
        op.setDiasCarteira((int) (venda.getDataMovimentacao().toEpochDay() - compra.getDataMovimentacao().toEpochDay()));

        BigDecimal vi = valorCaixa(compra.getLancamentoFinanceiro(), compra.getValorOperacao());
        BigDecimal vf = valorCaixa(venda.getLancamentoFinanceiro(), venda.getValorOperacao());
        op.setValorCompraCaixa(vi);
        op.setValorVendaCaixa(vf);
        op.setValorIrrf(BigDecimal.ZERO);
        op.setValorIof(BigDecimal.ZERO);
        op.setValorCustos(BigDecimal.ZERO);

        InvestimentoVinculoConfianca conf = menorConfianca(compra.getVinculoConfianca(), venda.getVinculoConfianca());
        if (compra.getLancamentoFinanceiro() == null || venda.getLancamentoFinanceiro() == null) {
            conf = InvestimentoVinculoConfianca.BAIXA;
        }
        op.setVinculoConfianca(conf);
        return op;
    }

    private void finalizarMetricasFechada(InvestimentoOperacaoEntity op) {
        BigDecimal vi = op.getValorCompraCaixa() != null ? op.getValorCompraCaixa() : BigDecimal.ZERO;
        BigDecimal vf = op.getValorVendaCaixa() != null ? op.getValorVendaCaixa() : BigDecimal.ZERO;
        BigDecimal vfLiq = vf.subtract(op.getValorIrrf()).subtract(op.getValorIof()).subtract(op.getValorCustos());
        op.setValorLiquidoEntrada(vfLiq);
        op.setLucroLiquido(vfLiq.subtract(vi));

        if (op.getDiasCarteira() != null && op.getDiasCarteira() > 0 && vi.compareTo(BigDecimal.ZERO) > 0) {
            op.setTaxaMensalLiquida(InvestimentoTaxaUtil.taxaMensalLiquida(vfLiq, vi, op.getDiasCarteira()));
            op.setTaxaAnualLiquida(InvestimentoTaxaUtil.taxaAnualLiquida(vfLiq, vi, op.getDiasCarteira()));
        }
    }

    private void alocarImpostosDoDia(Integer numeroBanco, LocalDate dia, List<InvestimentoOperacaoEntity> ops) {
        if (ops == null || ops.isEmpty()) {
            return;
        }
        List<LancamentoFinanceiroEntity> lancamentosDia =
                lancamentoRepository.findCandidatosInvestimentoExtrato(numeroBanco, dia, dia);
        Set<Long> impostosUsados = new HashSet<>();

        ops.sort(Comparator.comparing(op -> op.getValorVendaCaixa() != null ? op.getValorVendaCaixa() : BigDecimal.ZERO));

        for (InvestimentoOperacaoEntity op : ops) {
            ImpostosCustos especificos = calcularImpostosEspecificos(
                    lancamentosDia, op.getEmissor(), op.getDiasCarteira(), impostosUsados);
            op.setValorIrrf(especificos.irrf());
            op.setValorIof(especificos.iof());
        }

        BigDecimal genericIrrf = BigDecimal.ZERO;
        BigDecimal genericIof = BigDecimal.ZERO;
        for (LancamentoFinanceiroEntity l : lancamentosDia) {
            if (impostosUsados.contains(l.getId())) {
                continue;
            }
            String desc = l.getDescricao() != null ? l.getDescricao().trim() : "";
            if (!BtgMovimentacaoParser.isImpostoGenericoSemProduto(desc)) {
                continue;
            }
            String upper = desc.toUpperCase(Locale.ROOT);
            if (upper.startsWith("IRRF")) {
                genericIrrf = genericIrrf.add(l.getValor());
                impostosUsados.add(l.getId());
            } else if (upper.startsWith("IOF")) {
                genericIof = genericIof.add(l.getValor());
                impostosUsados.add(l.getId());
            }
        }

        if (genericIrrf.compareTo(BigDecimal.ZERO) <= 0 && genericIof.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        BigDecimal baseVendas = somaVendasExtratoDia(lancamentosDia);
        if (baseVendas.compareTo(BigDecimal.ZERO) <= 0) {
            baseVendas = ops.stream()
                    .map(op -> op.getValorVendaCaixa() != null ? op.getValorVendaCaixa() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }
        if (baseVendas.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        for (InvestimentoOperacaoEntity op : ops) {
            BigDecimal vf = op.getValorVendaCaixa() != null ? op.getValorVendaCaixa() : BigDecimal.ZERO;
            if (vf.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            if (genericIrrf.compareTo(BigDecimal.ZERO) > 0) {
                op.setValorIrrf(op.getValorIrrf().add(parcelaProporcional(genericIrrf, vf, baseVendas)));
            }
            if (genericIof.compareTo(BigDecimal.ZERO) > 0) {
                op.setValorIof(op.getValorIof().add(parcelaProporcional(genericIof, vf, baseVendas)));
            }
        }
    }

    private BigDecimal somaVendasExtratoDia(List<LancamentoFinanceiroEntity> lancamentosDia) {
        BigDecimal total = BigDecimal.ZERO;
        for (LancamentoFinanceiroEntity l : lancamentosDia) {
            String desc = l.getDescricao() != null ? l.getDescricao().toUpperCase(Locale.ROOT) : "";
            if (desc.startsWith("VENDA")) {
                total = total.add(l.getValor());
            }
        }
        return total;
    }

    static BigDecimal parcelaProporcional(BigDecimal total, BigDecimal parte, BigDecimal baseTotal) {
        if (total == null || parte == null || baseTotal == null || baseTotal.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        return total.multiply(parte).divide(baseTotal, 2, RoundingMode.HALF_UP);
    }

    private ImpostosCustos calcularImpostosEspecificos(
            List<LancamentoFinanceiroEntity> lancamentosDia,
            String emissor,
            Integer diasCarteira,
            Set<Long> impostosUsados) {
        if (!StringUtils.hasText(emissor)) {
            return new ImpostosCustos(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        }

        List<LancamentoFinanceiroEntity> candidatos = new ArrayList<>();
        for (LancamentoFinanceiroEntity l : lancamentosDia) {
            if (impostosUsados.contains(l.getId())) {
                continue;
            }
            String desc = l.getDescricao() != null ? l.getDescricao().trim() : "";
            if (BtgMovimentacaoParser.isImpostoGenericoSemProduto(desc)) {
                continue;
            }
            String upper = desc.toUpperCase(Locale.ROOT);
            if (!upper.startsWith("IRRF") && !upper.startsWith("IOF")) {
                continue;
            }
            String emLanc = BtgMovimentacaoParser.extrairEmissorFin(desc);
            if (!BtgMovimentacaoParser.emissoresInvestimentoCompat(emissor, emLanc)) {
                continue;
            }
            candidatos.add(l);
        }

        if (candidatos.isEmpty()) {
            return new ImpostosCustos(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        }

        Map<String, List<LancamentoFinanceiroEntity>> porVencimento = new LinkedHashMap<>();
        for (LancamentoFinanceiroEntity l : candidatos) {
            String venc = BtgMovimentacaoParser.extrairVencimentoExtrato(l.getDescricao());
            String chave = venc != null ? venc : "#sem-venc";
            porVencimento.computeIfAbsent(chave, k -> new ArrayList<>()).add(l);
        }

        List<LancamentoFinanceiroEntity> escolhidos = selecionarGrupoImpostos(porVencimento, diasCarteira);
        BigDecimal irrf = BigDecimal.ZERO;
        BigDecimal iof = BigDecimal.ZERO;
        for (LancamentoFinanceiroEntity l : escolhidos) {
            String upper = l.getDescricao().toUpperCase(Locale.ROOT);
            if (upper.startsWith("IRRF")) {
                irrf = irrf.add(l.getValor());
            } else if (upper.startsWith("IOF")) {
                iof = iof.add(l.getValor());
            }
            impostosUsados.add(l.getId());
        }
        return new ImpostosCustos(irrf, iof, BigDecimal.ZERO);
    }

    private record ImpostosCustos(BigDecimal irrf, BigDecimal iof, BigDecimal custos) {}

    private record ParCompraVenda(InvestimentoMovimentacaoEntity compra, InvestimentoMovimentacaoEntity venda) {}

    private String resolverEmissorInvestimento(
            InvestimentoMovimentacaoEntity compra, InvestimentoMovimentacaoEntity venda) {
        if (StringUtils.hasText(compra.getEmissor()) && !isEmissorInstituicaoBtg(compra.getEmissor())) {
            return compra.getEmissor().trim().toUpperCase(Locale.ROOT);
        }
        if (compra.getLancamentoFinanceiro() != null) {
            String e = BtgMovimentacaoParser.extrairEmissorFin(compra.getLancamentoFinanceiro().getDescricao());
            if (StringUtils.hasText(e)) {
                return e;
            }
        }
        if (venda.getLancamentoFinanceiro() != null) {
            String e = BtgMovimentacaoParser.extrairEmissorFin(venda.getLancamentoFinanceiro().getDescricao());
            if (StringUtils.hasText(e)) {
                return e;
            }
        }
        if (StringUtils.hasText(venda.getEmissor()) && !isEmissorInstituicaoBtg(venda.getEmissor())) {
            return venda.getEmissor().trim().toUpperCase(Locale.ROOT);
        }
        return StringUtils.hasText(compra.getEmissor()) ? compra.getEmissor().trim().toUpperCase(Locale.ROOT) : null;
    }

    private static boolean isEmissorInstituicaoBtg(String emissor) {
        if (!StringUtils.hasText(emissor)) {
            return false;
        }
        return emissor.toUpperCase(Locale.ROOT).contains("BTG PACTUAL");
    }

    private List<LancamentoFinanceiroEntity> selecionarGrupoImpostos(
            Map<String, List<LancamentoFinanceiroEntity>> porVencimento, Integer diasCarteira) {
        List<List<LancamentoFinanceiroEntity>> grupos = new ArrayList<>(porVencimento.values());
        if (grupos.isEmpty()) {
            return List.of();
        }

        boolean curtoPrazo = diasCarteira != null && diasCarteira <= 30;
        List<List<LancamentoFinanceiroEntity>> preferidos = grupos.stream()
                .filter(g -> curtoPrazo == grupoTemIof(g))
                .toList();
        if (preferidos.isEmpty()) {
            preferidos = grupos;
        }

        return preferidos.stream()
                .min(Comparator.comparing(this::somaValorLancamentos))
                .orElse(List.of());
    }

    private boolean grupoTemIof(List<LancamentoFinanceiroEntity> grupo) {
        return grupo.stream()
                .anyMatch(l -> l.getDescricao() != null
                        && l.getDescricao().toUpperCase(Locale.ROOT).startsWith("IOF"));
    }

    private BigDecimal somaValorLancamentos(List<LancamentoFinanceiroEntity> grupo) {
        return grupo.stream().map(LancamentoFinanceiroEntity::getValor).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal valorCaixa(LancamentoFinanceiroEntity lanc, BigDecimal fallback) {
        return lanc != null ? lanc.getValor() : fallback;
    }

    private InvestimentoOperacaoEntity baseOperacao(
            ContaBancariaEntity conta, String codigo, String tipoProduto, String emissor) {
        InvestimentoOperacaoEntity op = new InvestimentoOperacaoEntity();
        op.setContaBancaria(conta);
        op.setCodigoProduto(codigo);
        op.setTipoProduto(tipoProduto);
        op.setEmissor(emissor);
        op.setValorIrrf(BigDecimal.ZERO);
        op.setValorIof(BigDecimal.ZERO);
        op.setValorCustos(BigDecimal.ZERO);
        return op;
    }

    private InvestimentoVinculoConfianca menorConfianca(InvestimentoVinculoConfianca a, InvestimentoVinculoConfianca b) {
        if (a == InvestimentoVinculoConfianca.BAIXA || b == InvestimentoVinculoConfianca.BAIXA) {
            return InvestimentoVinculoConfianca.BAIXA;
        }
        if (a == InvestimentoVinculoConfianca.MEDIA || b == InvestimentoVinculoConfianca.MEDIA) {
            return InvestimentoVinculoConfianca.MEDIA;
        }
        return InvestimentoVinculoConfianca.ALTA;
    }

    private InvestimentoImportResponse toImportResponse(InvestimentoImportEntity e) {
        return new InvestimentoImportResponse(
                e.getId(),
                e.getContaBancaria().getId(),
                e.getContaBancaria().getNumeroBanco(),
                e.getContaBancaria().getBancoNome(),
                e.getArquivoNome(),
                e.getPeriodoInicio(),
                e.getPeriodoFim(),
                e.getTotalLinhas(),
                e.getLinhasCdb(),
                e.getLinhasVinculadas(),
                e.getStatus(),
                e.getImportadoEm());
    }

    private InvestimentoOperacaoResponse toOperacaoResponse(InvestimentoOperacaoEntity o) {
        return new InvestimentoOperacaoResponse(
                o.getId(),
                o.getContaBancaria().getNumeroBanco(),
                o.getContaBancaria().getBancoNome(),
                o.getCodigoProduto(),
                o.getTipoProduto(),
                o.getEmissor(),
                o.getStatus(),
                o.getDataCompra(),
                o.getDataVenda(),
                o.getValorCompraCaixa(),
                o.getValorVendaCaixa(),
                o.getValorIrrf(),
                o.getValorIof(),
                o.getValorCustos(),
                o.getValorLiquidoEntrada(),
                o.getLucroLiquido(),
                o.getDiasCarteira(),
                o.getTaxaMensalLiquida(),
                o.getTaxaAnualLiquida(),
                o.getVinculoConfianca(),
                o.getCompraLancamento() != null ? o.getCompraLancamento().getId() : null,
                o.getVendaLancamento() != null ? o.getVendaLancamento().getId() : null);
    }

    private static String sha256Hex(byte[] bytes) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(bytes);
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
