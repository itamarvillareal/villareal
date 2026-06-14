package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.DescartarRecorrenciaRequest;
import br.com.vilareal.financeiro.api.dto.AplicarRecorrenciaRequest;
import br.com.vilareal.financeiro.api.dto.AplicarRecorrenciaResponse;
import br.com.vilareal.financeiro.api.dto.AplicarSugestaoLoteItemRequest;
import br.com.vilareal.financeiro.api.dto.AplicarSugestaoLoteRequest;
import br.com.vilareal.financeiro.api.dto.AplicarSugestaoLoteResult;
import br.com.vilareal.financeiro.api.dto.RecorrenciaDetectadaResponse;
import br.com.vilareal.financeiro.api.dto.RecorrenciaLancamentoPreviewItem;
import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.financeiro.domain.EscopoAplicarRecorrencia;
import br.com.vilareal.financeiro.domain.PrecisaoValorRecorrencia;
import br.com.vilareal.financeiro.domain.RecorrenciaValorPerfilUtil;
import br.com.vilareal.financeiro.domain.RecorrenciaValorPerfilUtil.ClassePrecisao;
import br.com.vilareal.financeiro.domain.RecorrenciaValorPerfilUtil.ContagensPrecisao;
import br.com.vilareal.financeiro.domain.RecorrenciaValorPerfilUtil.PerfilValor;
import br.com.vilareal.financeiro.domain.TipoMatch;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.RegraClassificacaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.FinanceiroAnaliseRecorrenciaRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.FinanceiroAnaliseRecorrenciaRepository.PadraoRecorrenciaRow;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.FinanceiroAnaliseRecorrenciaRepository.VinculoDominanteRow;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.RegraClassificacaoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.RecorrenciaPadraoDescarteEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.RecorrenciaPadraoDescarteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.api.dto.ProcessoPartesVinculoTexto;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Locale;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class FinanceiroAnaliseService {

    private static final int CHUNK_APLICAR = 1000;

    private final FinanceiroAnaliseRecorrenciaRepository recorrenciaRepository;
    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final ContaContabilRepository contaContabilRepository;
    private final ClienteRepository clienteRepository;
    private final ProcessoRepository processoRepository;
    private final ProcessoApplicationService processoApplicationService;
    private final RegraClassificacaoRepository regraRepository;
    private final RecorrenciaPadraoDescarteRepository descarteRepository;
    private final FinanceiroSugestaoService sugestaoService;

    public FinanceiroAnaliseService(
            FinanceiroAnaliseRecorrenciaRepository recorrenciaRepository,
            LancamentoFinanceiroRepository lancamentoRepository,
            ContaContabilRepository contaContabilRepository,
            ClienteRepository clienteRepository,
            ProcessoRepository processoRepository,
            ProcessoApplicationService processoApplicationService,
            RegraClassificacaoRepository regraRepository,
            RecorrenciaPadraoDescarteRepository descarteRepository,
            FinanceiroSugestaoService sugestaoService) {
        this.recorrenciaRepository = recorrenciaRepository;
        this.lancamentoRepository = lancamentoRepository;
        this.contaContabilRepository = contaContabilRepository;
        this.clienteRepository = clienteRepository;
        this.processoRepository = processoRepository;
        this.processoApplicationService = processoApplicationService;
        this.regraRepository = regraRepository;
        this.descarteRepository = descarteRepository;
        this.sugestaoService = sugestaoService;
    }

    /** Limiar para considerar consistência histórica ou de vínculo como 100%. */
    private static final double LIMIAR_CONSISTENCIA_PERFEITA = 0.9995;

    @Transactional(readOnly = true)
    public Page<RecorrenciaDetectadaResponse> listarRecorrencias(
            ConfiancaSugestao confiancaMinima,
            Integer numeroBanco,
            boolean apenasAcionaveis,
            Long contaContabilId,
            PrecisaoValorRecorrencia precisaoValor,
            boolean somenteConfiancaPerfeita,
            Pageable pageable) {
        ConfiancaSugestao minimo = confiancaMinima != null ? confiancaMinima : ConfiancaSugestao.MEDIA;
        PrecisaoValorRecorrencia filtroValor =
                precisaoValor != null ? precisaoValor : PrecisaoValorRecorrencia.EXATO;
        if (filtroValor == PrecisaoValorRecorrencia.APROXIMADO) {
            filtroValor = PrecisaoValorRecorrencia.EXATO;
        }

        List<PadraoRecorrenciaRow> padroes =
                recorrenciaRepository.listarPadroesAgregados(numeroBanco, contaContabilId);

        DescartesRecorrencia descartes = carregarDescartes(numeroBanco);

        List<RecorrenciaDetectadaResponse> filtrados = new ArrayList<>();
        for (PadraoRecorrenciaRow p : padroes) {
            if (descartes.padraoCompletoDescartado(p.descricaoNorm, p.numeroBanco)) {
                continue;
            }
            RecorrenciaDetectadaResponse item = mapearPadrao(p, filtroValor);
            if (descartes.vinculoDescartado(
                    p.descricaoNorm, p.numeroBanco, item.getClienteId(), item.getProcessoId())) {
                limparVinculoSugerido(item);
            }
            long acionaveis = item.getQtdAcionaveis();
            if (apenasAcionaveis && acionaveis <= 0) {
                continue;
            }
            if (filtroValor == PrecisaoValorRecorrencia.EXATO && !item.isValorFixo()) {
                continue;
            }
            if (!item.getConfianca().atendeMinimo(minimo)) {
                continue;
            }
            if (somenteConfiancaPerfeita && !confiancaPerfeita(item)) {
                continue;
            }
            filtrados.add(item);
        }

        enriquecerPartesProcesso(filtrados);

        filtrados.sort(Comparator.comparingLong(RecorrenciaDetectadaResponse::getQtdAcionaveis)
                .reversed()
                .thenComparingLong((RecorrenciaDetectadaResponse r) -> r.getQtdPendentesExato()
                        + r.getQtdCompletarExato())
                .reversed());

        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtrados.size());
        List<RecorrenciaDetectadaResponse> pagina =
                start >= filtrados.size() ? List.of() : filtrados.subList(start, end);
        return new PageImpl<>(pagina, pageable, filtrados.size());
    }

    @Transactional
    public void descartarRecorrencia(DescartarRecorrenciaRequest req) {
        validarDescartar(req);
        boolean somenteVinculo = req.getClienteId() != null && req.getProcessoId() != null;
        String descricaoNorm = req.getDescricaoNorm().trim();
        RecorrenciaPadraoDescarteEntity e = new RecorrenciaPadraoDescarteEntity();
        e.setDescricaoNorm(descricaoNorm);
        e.setNumeroBanco(req.getNumeroBanco());
        e.setSomenteVinculo(somenteVinculo);
        e.setClienteId(somenteVinculo ? req.getClienteId() : 0L);
        e.setProcessoId(somenteVinculo ? req.getProcessoId() : 0L);
        try {
            descarteRepository.save(e);
        } catch (DataIntegrityViolationException ignored) {
            // já descartado
        }
    }

    private static void validarDescartar(DescartarRecorrenciaRequest req) {
        if (req == null || !StringUtils.hasText(req.getDescricaoNorm())) {
            throw new BusinessRuleException("descricaoNorm é obrigatório.");
        }
        if (req.getNumeroBanco() == null) {
            throw new BusinessRuleException("numeroBanco é obrigatório.");
        }
        boolean temCliente = req.getClienteId() != null;
        boolean temProcesso = req.getProcessoId() != null;
        if (temCliente != temProcesso) {
            throw new BusinessRuleException("clienteId e processoId devem ser informados juntos para descartar vínculo.");
        }
    }

    private DescartesRecorrencia carregarDescartes(Integer numeroBanco) {
        List<RecorrenciaPadraoDescarteEntity> rows =
                numeroBanco != null ? descarteRepository.findByNumeroBanco(numeroBanco) : descarteRepository.findAll();
        return DescartesRecorrencia.from(rows);
    }

    private static void limparVinculoSugerido(RecorrenciaDetectadaResponse r) {
        r.setClienteId(null);
        r.setClienteNome(null);
        r.setProcessoId(null);
        r.setProcessoNumero(null);
        r.setParteCliente(null);
        r.setParteOposta(null);
        r.setConsistenciaVinculo(null);
    }

    private static String chavePadrao(String descricaoNorm, Integer numeroBanco) {
        return descricaoNorm.trim().toUpperCase(Locale.ROOT) + "|" + numeroBanco;
    }

    private record DescartesRecorrencia(Set<String> padroesCompletos, Set<String> vinculos) {
        static DescartesRecorrencia from(List<RecorrenciaPadraoDescarteEntity> rows) {
            Set<String> completos = new HashSet<>();
            Set<String> vinculos = new HashSet<>();
            for (RecorrenciaPadraoDescarteEntity d : rows) {
                String base = chavePadrao(d.getDescricaoNorm(), d.getNumeroBanco());
                if (d.isSomenteVinculo()) {
                    vinculos.add(base + "|" + d.getClienteId() + "|" + d.getProcessoId());
                } else {
                    completos.add(base);
                }
            }
            return new DescartesRecorrencia(completos, vinculos);
        }

        boolean padraoCompletoDescartado(String descricaoNorm, Integer numeroBanco) {
            return padroesCompletos.contains(chavePadrao(descricaoNorm, numeroBanco));
        }

        boolean vinculoDescartado(String descricaoNorm, Integer numeroBanco, Long clienteId, Long processoId) {
            if (clienteId == null || processoId == null) {
                return false;
            }
            return vinculos.contains(chavePadrao(descricaoNorm, numeroBanco) + "|" + clienteId + "|" + processoId);
        }
    }

    @Transactional
    public AplicarRecorrenciaResponse aplicarRecorrencia(AplicarRecorrenciaRequest req) {
        validarAplicar(req);
        EscopoAplicarRecorrencia escopo =
                req.getEscopo() != null ? req.getEscopo() : EscopoAplicarRecorrencia.TODOS;
        PrecisaoValorRecorrencia precisao =
                req.getPrecisaoValor() != null ? req.getPrecisaoValor() : PrecisaoValorRecorrencia.EXATO;
        String descricaoNorm = req.getDescricaoNorm().trim();

        PerfilValor perfil = carregarPerfil(descricaoNorm, req.getNumeroBanco());

        List<LancamentoFinanceiroEntity> novos = List.of();
        List<LancamentoFinanceiroEntity> parciais = List.of();
        if (escopo == EscopoAplicarRecorrencia.TODOS || escopo == EscopoAplicarRecorrencia.NOVOS) {
            novos = filtrarPorPrecisao(
                    lancamentoRepository.findPendentesPorPadrao(descricaoNorm, req.getNumeroBanco()),
                    perfil,
                    precisao);
        }
        if (escopo == EscopoAplicarRecorrencia.TODOS || escopo == EscopoAplicarRecorrencia.COMPLETAR) {
            parciais = filtrarPorPrecisao(
                    lancamentoRepository.findParciaisParaCompletarPorPadrao(
                            descricaoNorm, req.getNumeroBanco(), req.getContaContabilId()),
                    perfil,
                    precisao);
        }

        AplicarRecorrenciaResponse resp = new AplicarRecorrenciaResponse();
        resp.setAplicadosNovos(novos.size());
        resp.setAplicadosCompletados(parciais.size());
        preencherPreviewLancamentos(resp, novos, parciais, escopo);

        if (req.isDryRun() || (novos.isEmpty() && parciais.isEmpty())) {
            if (req.isCriarRegra() && !req.isDryRun()) {
                resp.setJaExistiaRegra(true);
            }
            return resp;
        }

        aplicarLote(novos, req, resp);
        aplicarLote(parciais, req, resp);

        if (req.isCriarRegra()) {
            Optional<RegraClassificacaoEntity> existente = buscarRegraIdentica(req);
            if (existente.isPresent()) {
                resp.setJaExistiaRegra(true);
                resp.setRegraCriadaId(existente.get().getId());
            } else {
                RegraClassificacaoEntity nova = criarRegraDePadrao(req);
                resp.setRegraCriadaId(regraRepository.save(nova).getId());
                resp.setJaExistiaRegra(false);
            }
        }

        return resp;
    }

    private void enriquecerPartesProcesso(List<RecorrenciaDetectadaResponse> itens) {
        Set<Long> processoIds = itens.stream()
                .map(RecorrenciaDetectadaResponse::getProcessoId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (processoIds.isEmpty()) {
            return;
        }
        Map<Long, ProcessoPartesVinculoTexto> partes =
                processoApplicationService.resolverTextosPartesVinculoEmLote(processoIds);
        if (partes == null || partes.isEmpty()) {
            return;
        }
        for (RecorrenciaDetectadaResponse r : itens) {
            if (r.getProcessoId() == null) {
                continue;
            }
            ProcessoPartesVinculoTexto pt = partes.get(r.getProcessoId());
            if (pt == null) {
                continue;
            }
            if (StringUtils.hasText(pt.getParteCliente())) {
                r.setParteCliente(Utf8MojibakeUtil.corrigir(pt.getParteCliente().trim()));
            }
            if (StringUtils.hasText(pt.getParteOposta())) {
                r.setParteOposta(Utf8MojibakeUtil.corrigir(pt.getParteOposta().trim()));
            }
        }
    }

    private List<LancamentoFinanceiroEntity> filtrarPorPrecisao(
            List<LancamentoFinanceiroEntity> candidatos, PerfilValor perfil, PrecisaoValorRecorrencia precisao) {
        if (precisao.ignoraValor()) {
            return candidatos;
        }
        return candidatos.stream()
                .filter(l -> RecorrenciaValorPerfilUtil.aceita(
                        RecorrenciaValorPerfilUtil.classificar(l.getValor(), perfil.valorModal()), precisao))
                .toList();
    }

    private PerfilValor carregarPerfil(String descricaoNorm, Integer numeroBanco) {
        return RecorrenciaValorPerfilUtil.calcularPerfil(
                lancamentoRepository.listarValoresHistoricoPorPadrao(descricaoNorm, numeroBanco));
    }

    private ContagensPrecisao contarCandidatosPorPrecisao(PadraoRecorrenciaRow p, PerfilValor perfil) {
        long pExato = 0;
        long pAprox = 0;
        long pDivergente = 0;
        for (LancamentoFinanceiroEntity l :
                lancamentoRepository.findPendentesPorPadrao(p.descricaoNorm, p.numeroBanco)) {
            ClassePrecisao c = RecorrenciaValorPerfilUtil.classificar(l.getValor(), perfil.valorModal());
            switch (c) {
                case EXATO -> pExato++;
                case APROXIMADO -> pAprox++;
                case DIVERGENTE -> pDivergente++;
            }
        }

        long cExato = 0;
        long cAprox = 0;
        long cDivergente = 0;
        if ("A".equalsIgnoreCase(p.contaCodigo) && p.contaContabilId != null && p.numeroBanco != null) {
            for (LancamentoFinanceiroEntity l : lancamentoRepository.findParciaisParaCompletarPorPadrao(
                    p.descricaoNorm, p.numeroBanco, p.contaContabilId)) {
                ClassePrecisao c = RecorrenciaValorPerfilUtil.classificar(l.getValor(), perfil.valorModal());
                switch (c) {
                    case EXATO -> cExato++;
                    case APROXIMADO -> cAprox++;
                    case DIVERGENTE -> cDivergente++;
                }
            }
        }
        return new ContagensPrecisao(pExato, pAprox, pDivergente, cExato, cAprox, cDivergente);
    }

    private void aplicarLote(
            List<LancamentoFinanceiroEntity> lancamentos,
            AplicarRecorrenciaRequest req,
            AplicarRecorrenciaResponse resp) {
        for (int i = 0; i < lancamentos.size(); i += CHUNK_APLICAR) {
            List<LancamentoFinanceiroEntity> chunk =
                    lancamentos.subList(i, Math.min(i + CHUNK_APLICAR, lancamentos.size()));
            AplicarSugestaoLoteRequest lote = new AplicarSugestaoLoteRequest();
            List<AplicarSugestaoLoteItemRequest> itens = new ArrayList<>(chunk.size());
            for (LancamentoFinanceiroEntity l : chunk) {
                AplicarSugestaoLoteItemRequest item = new AplicarSugestaoLoteItemRequest();
                item.setLancamentoId(l.getId());
                item.setContaContabilId(req.getContaContabilId());
                item.setClienteId(req.getClienteId());
                item.setProcessoId(req.getProcessoId());
                itens.add(item);
            }
            lote.setAplicacoes(itens);
            AplicarSugestaoLoteResult parcial = sugestaoService.aplicarSugestoesLote(lote);
            resp.getErros().addAll(parcial.getErros());
        }
    }

    private RecorrenciaDetectadaResponse mapearPadrao(PadraoRecorrenciaRow p, PrecisaoValorRecorrencia filtroValor) {
        RecorrenciaDetectadaResponse r = new RecorrenciaDetectadaResponse();
        r.setDescricaoNorm(Utf8MojibakeUtil.corrigir(p.descricaoNorm));
        r.setDescricaoExemplo(Utf8MojibakeUtil.corrigir(p.descricaoExemplo));
        r.setDataExemplo(p.dataExemplo);
        r.setNumeroBanco(p.numeroBanco);
        r.setBancoNome(Utf8MojibakeUtil.corrigir(p.bancoNome));
        r.setValorTipico(
                p.valorMedio != null
                        ? p.valorMedio.setScale(2, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO);
        r.setContaContabilId(p.contaContabilId);
        r.setContaCodigo(p.contaCodigo);
        r.setContaNome(Utf8MojibakeUtil.corrigir(p.contaNome));
        r.setOcorrenciasHistorico(p.ocorrenciasHistorico);
        r.setMesesCobertos(p.mesesCobertos);

        PerfilValor perfil = carregarPerfil(p.descricaoNorm, p.numeroBanco);
        r.setValorModal(perfil.valorModal());
        r.setDispersao(perfil.dispersao());
        r.setValorFixo(perfil.valorFixo());

        ContagensPrecisao contagens = contarCandidatosPorPrecisao(p, perfil);
        r.setQtdPendentesExato(contagens.pendentesExato());
        r.setQtdPendentesAprox(contagens.pendentesAprox());
        r.setQtdCompletarExato(contagens.completarExato());
        r.setQtdCompletarAprox(contagens.completarAprox());
        r.setQtdDivergentes(contagens.totalDivergente());

        if (filtroValor.ignoraValor()) {
            r.setQtdPendentes(contagens.pendentesExato() + contagens.pendentesAprox() + contagens.pendentesDivergente());
            r.setQtdParaCompletar(contagens.completarExato() + contagens.completarAprox() + contagens.completarDivergente());
        } else {
            if (filtroValor.incluiExatos()) {
                r.setQtdPendentes(contagens.pendentesExato());
                r.setQtdParaCompletar(contagens.completarExato());
            } else {
                r.setQtdPendentes(0);
                r.setQtdParaCompletar(0);
            }
            if (filtroValor.incluiAproximados()) {
                r.setQtdPendentes(r.getQtdPendentes() + contagens.pendentesAprox());
                r.setQtdParaCompletar(r.getQtdParaCompletar() + contagens.completarAprox());
            }
        }
        r.setQtdAcionaveis(contagens.totalAcionavel(filtroValor));

        double consistenciaConta =
                p.ocorrenciasHistorico > 0 ? (double) p.cntContaDominante / p.ocorrenciasHistorico : 0.0;
        r.setConsistenciaConta(consistenciaConta);

        Double consistenciaVinculo = null;
        if ("A".equalsIgnoreCase(p.contaCodigo) && p.contaContabilId != null && p.numeroBanco != null) {
            VinculoDominanteRow vinculo = recorrenciaRepository.buscarVinculoDominanteContaA(
                    p.descricaoNorm, p.numeroBanco, p.contaContabilId);
            long comVinculoCompleto = recorrenciaRepository.contarComVinculoCompletoContaA(
                    p.descricaoNorm, p.numeroBanco, p.contaContabilId);
            if (vinculo != null && comVinculoCompleto > 0) {
                consistenciaVinculo = (double) vinculo.cnt / comVinculoCompleto;
                r.setConsistenciaVinculo(consistenciaVinculo);
                if (vinculo.clienteId != null) {
                    r.setClienteId(vinculo.clienteId);
                    clienteRepository.findById(vinculo.clienteId).ifPresent(c -> r.setClienteNome(nomeCliente(c)));
                }
                if (vinculo.processoId != null) {
                    r.setProcessoId(vinculo.processoId);
                    processoRepository.findById(vinculo.processoId).ifPresent(pr -> r.setProcessoNumero(numeroProcesso(pr)));
                }
            }
        }

        r.setConfianca(calcularConfianca(consistenciaConta, p.ocorrenciasHistorico, p.contaCodigo, consistenciaVinculo));
        return r;
    }

    private static void preencherPreviewLancamentos(
            AplicarRecorrenciaResponse resp,
            List<LancamentoFinanceiroEntity> novos,
            List<LancamentoFinanceiroEntity> parciais,
            EscopoAplicarRecorrencia escopo) {
        List<RecorrenciaLancamentoPreviewItem> itens = new ArrayList<>();
        if (escopo == EscopoAplicarRecorrencia.TODOS || escopo == EscopoAplicarRecorrencia.NOVOS) {
            for (LancamentoFinanceiroEntity l : novos) {
                itens.add(toPreviewItem(l, "NOVO"));
            }
        }
        if (escopo == EscopoAplicarRecorrencia.TODOS || escopo == EscopoAplicarRecorrencia.COMPLETAR) {
            for (LancamentoFinanceiroEntity l : parciais) {
                itens.add(toPreviewItem(l, "COMPLETAR"));
            }
        }
        itens.sort(Comparator.comparing(RecorrenciaLancamentoPreviewItem::getDataLancamento, Comparator.nullsLast(Comparator.naturalOrder()))
                .reversed()
                .thenComparing(i -> i.getDescricao() != null ? i.getDescricao() : ""));
        resp.setLancamentos(itens);
    }

    private static RecorrenciaLancamentoPreviewItem toPreviewItem(LancamentoFinanceiroEntity l, String acao) {
        RecorrenciaLancamentoPreviewItem item = new RecorrenciaLancamentoPreviewItem();
        item.setDataLancamento(l.getDataLancamento());
        item.setDescricao(Utf8MojibakeUtil.corrigir(l.getDescricao()));
        item.setValor(l.getValor() != null ? l.getValor().setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO);
        item.setAcao(acao);
        return item;
    }

    static boolean confiancaPerfeita(RecorrenciaDetectadaResponse r) {
        if (r == null || r.getConfianca() != ConfiancaSugestao.ALTA) {
            return false;
        }
        if (r.getConsistenciaConta() < LIMIAR_CONSISTENCIA_PERFEITA) {
            return false;
        }
        Double vinculo = r.getConsistenciaVinculo();
        return vinculo == null || vinculo >= LIMIAR_CONSISTENCIA_PERFEITA;
    }

    private static ConfiancaSugestao calcularConfianca(
            double consistenciaConta, long ocorrencias, String contaCodigo, Double consistenciaVinculo) {
        if (consistenciaConta >= 0.95 && ocorrencias >= 5) {
            if ("A".equalsIgnoreCase(contaCodigo)
                    && (consistenciaVinculo == null || consistenciaVinculo < 0.90)) {
                return ConfiancaSugestao.MEDIA;
            }
            return ConfiancaSugestao.ALTA;
        }
        if (consistenciaConta >= 0.80 && ocorrencias >= 3) {
            return ConfiancaSugestao.MEDIA;
        }
        return ConfiancaSugestao.BAIXA;
    }

    private static String nomeCliente(ClienteEntity c) {
        if (StringUtils.hasText(c.getNomeReferencia())) {
            return Utf8MojibakeUtil.corrigir(c.getNomeReferencia());
        }
        if (c.getPessoa() != null && StringUtils.hasText(c.getPessoa().getNome())) {
            return Utf8MojibakeUtil.corrigir(c.getPessoa().getNome());
        }
        return null;
    }

    private static String numeroProcesso(ProcessoEntity p) {
        if (StringUtils.hasText(p.getNumeroCnj())) {
            return Utf8MojibakeUtil.corrigir(p.getNumeroCnj());
        }
        if (p.getNumeroInterno() != null) {
            return String.valueOf(p.getNumeroInterno());
        }
        return null;
    }

    private Optional<RegraClassificacaoEntity> buscarRegraIdentica(AplicarRecorrenciaRequest req) {
        return regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc().stream()
                .filter(r -> r.getTipoMatch() == TipoMatch.CONTAINS)
                .filter(r -> Objects.equals(r.getNumeroBanco(), req.getNumeroBanco()))
                .filter(r -> r.getContaContabil().getId().equals(req.getContaContabilId()))
                .filter(r -> req.getDescricaoNorm().equalsIgnoreCase(r.getPadraoDescricao()))
                .findFirst();
    }

    private RegraClassificacaoEntity criarRegraDePadrao(AplicarRecorrenciaRequest req) {
        ContaContabilEntity conta = contaContabilRepository
                .findById(req.getContaContabilId())
                .orElseThrow(() -> new BusinessRuleException("Conta contábil não encontrada."));
        RegraClassificacaoEntity e = new RegraClassificacaoEntity();
        e.setPadraoDescricao(req.getDescricaoNorm().trim());
        e.setTipoMatch(TipoMatch.CONTAINS);
        e.setContaContabil(conta);
        e.setLetraDestino(conta.getCodigo());
        e.setNumeroBanco(req.getNumeroBanco());
        e.setPrioridade(20);
        e.setConfianca(new BigDecimal("0.9000"));
        e.setAtivo(true);
        if (req.getClienteId() != null) {
            clienteRepository.findById(req.getClienteId()).ifPresent(e::setClienteEntidade);
        }
        if (req.getProcessoId() != null) {
            processoRepository.findById(req.getProcessoId()).ifPresent(e::setProcesso);
        }
        return e;
    }

    private static void validarAplicar(AplicarRecorrenciaRequest req) {
        if (req == null || !StringUtils.hasText(req.getDescricaoNorm())) {
            throw new BusinessRuleException("descricaoNorm é obrigatório.");
        }
        if (req.getNumeroBanco() == null) {
            throw new BusinessRuleException("numeroBanco é obrigatório.");
        }
        if (req.getContaContabilId() == null) {
            throw new BusinessRuleException("contaContabilId é obrigatório.");
        }
    }
}
