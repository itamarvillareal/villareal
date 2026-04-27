package br.com.vilareal.iptu.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.iptu.api.dto.*;
import br.com.vilareal.iptu.infrastructure.persistence.entity.IptuAnualEntity;
import br.com.vilareal.iptu.infrastructure.persistence.entity.IptuConsultaDebitoEntity;
import br.com.vilareal.iptu.infrastructure.persistence.entity.IptuParcelaEntity;
import br.com.vilareal.iptu.infrastructure.persistence.repository.IptuAnualRepository;
import br.com.vilareal.iptu.infrastructure.persistence.repository.IptuConsultaDebitoRepository;
import br.com.vilareal.iptu.infrastructure.persistence.repository.IptuParcelaRepository;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * IPTU service: persistence, instalment generation and contract integration.
 *
 * <p>City debt checks are stored in {@code iptu_consulta_debito} as a full history (auditable trail).</p>
 *
 * <p>Saving the annual amount regenerates open instalments to avoid manual monthly entry.</p>
 *
 * <p>{@link #recalcularPorContrato} only rebuilds {@code PENDENTE} and {@code ATRASADO}; {@code PAGO} and
 * {@code CANCELADO} rows are kept.</p>
 */
@Service
public class IptuApplicationService {

    public static final String ST_PENDENTE = "PENDENTE";
    public static final String ST_PAGO = "PAGO";
    public static final String ST_ATRASADO = "ATRASADO";
    public static final String ST_CANCELADO = "CANCELADO";

    private static final int VENCIMENTO_DIA_PADRAO = 10;

    private final IptuAnualRepository iptuAnualRepository;
    private final IptuParcelaRepository iptuParcelaRepository;
    private final IptuConsultaDebitoRepository iptuConsultaDebitoRepository;
    private final ImovelRepository imovelRepository;
    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final PagamentoRepository pagamentoRepository;
    private final UsuarioRepository usuarioRepository;

    public IptuApplicationService(
            IptuAnualRepository iptuAnualRepository,
            IptuParcelaRepository iptuParcelaRepository,
            IptuConsultaDebitoRepository iptuConsultaDebitoRepository,
            ImovelRepository imovelRepository,
            ContratoLocacaoRepository contratoLocacaoRepository,
            PagamentoRepository pagamentoRepository,
            UsuarioRepository usuarioRepository) {
        this.iptuAnualRepository = iptuAnualRepository;
        this.iptuParcelaRepository = iptuParcelaRepository;
        this.iptuConsultaDebitoRepository = iptuConsultaDebitoRepository;
        this.imovelRepository = imovelRepository;
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional
    public IptuAnualResponse upsertValorAnual(IptuAnualWriteRequest req) {
        validarAno(req.getAnoReferencia());
        if (req.getValorTotalAnual() == null || req.getValorTotalAnual().compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessRuleException("valorTotalAnual invalid");
        }
        ImovelEntity imovel = requireImovel(req.getImovelId());
        short ano = req.getAnoReferencia().shortValue();
        IptuAnualEntity e =
                iptuAnualRepository.findByImovel_IdAndAnoReferencia(imovel.getId(), ano).orElseGet(IptuAnualEntity::new);
        boolean valorMudou =
                e.getId() != null && e.getValorTotalAnual() != null && e.getValorTotalAnual().compareTo(req.getValorTotalAnual()) != 0;
        if (valorMudou && iptuParcelaRepository.findByIptuAnual_IdOrderByCompetenciaMesAsc(e.getId()).stream()
                .anyMatch(p -> ST_PAGO.equals(p.getStatus()))) {
            String aviso =
                    "[IPTU] Annual amount changed while some instalments were already paid; paid rows were kept. Please review.";
            e.setObservacoes(mergeObs(e.getObservacoes(), aviso));
        }
        e.setImovel(imovel);
        e.setAnoReferencia(ano);
        e.setValorTotalAnual(req.getValorTotalAnual());
        e.setDiasMesDivisor(
                req.getDiasMesDivisor() != null ? req.getDiasMesDivisor().byteValue() : (byte) 30);
        if (StringUtils.hasText(req.getObservacoes())) {
            e.setObservacoes(req.getObservacoes().trim());
        }
        if (StringUtils.hasText(req.getAnexoCarnePath())) {
            e.setAnexoCarnePath(req.getAnexoCarnePath().trim());
        }
        e = iptuAnualRepository.save(e);
        regenerarParcelasInterno(e);
        return toAnualResponse(e);
    }

    @Transactional(readOnly = true)
    public List<IptuAnualResponse> listarAnuais(Long imovelId, Integer ano) {
        requireImovel(imovelId);
        if (ano != null) {
            return iptuAnualRepository
                    .findByImovel_IdAndAnoReferencia(imovelId, ano.shortValue())
                    .map(this::toAnualResponse)
                    .map(Collections::singletonList)
                    .orElseGet(Collections::emptyList);
        }
        return iptuAnualRepository.findByImovel_IdOrderByAnoReferenciaDesc(imovelId).stream()
                .map(this::toAnualResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public IptuAnualResponse buscarAnual(Long id) {
        return toAnualResponse(requireAnual(id));
    }

    @Transactional
    public List<IptuParcelaResponse> gerarParcelas(Long iptuAnualId) {
        IptuAnualEntity anual = requireAnual(iptuAnualId);
        regenerarParcelasInterno(anual);
        return listarParcelasDoAnual(anual.getId());
    }

    @Transactional
    public IptuParcelaResponse marcarPaga(Long parcelaId, IptuParcelaMarcarPagaRequest req) {
        IptuParcelaEntity p = requireParcela(parcelaId);
        if (ST_CANCELADO.equals(p.getStatus())) {
            throw new BusinessRuleException("Cancelled instalment cannot be marked paid.");
        }
        p.setStatus(ST_PAGO);
        p.setDataPagamento(req.getDataPagamento());
        if (req.getPagamentoId() != null) {
            PagamentoEntity pg = pagamentoRepository
                    .findById(req.getPagamentoId())
                    .orElseThrow(() -> new ResourceNotFoundException("Pagamento not found: " + req.getPagamentoId()));
            p.setPagamento(pg);
        } else {
            p.setPagamento(null);
        }
        iptuParcelaRepository.save(p);
        return toParcelaResponse(requireParcela(parcelaId));
    }

    @Transactional
    public IptuParcelaResponse cancelar(Long parcelaId, IptuParcelaCancelarRequest req) {
        IptuParcelaEntity p = requireParcela(parcelaId);
        if (ST_PAGO.equals(p.getStatus())) {
            throw new BusinessRuleException("Paid instalment cannot be cancelled.");
        }
        p.setStatus(ST_CANCELADO);
        p.setObservacoes(mergeObs(p.getObservacoes(), "Cancelamento: " + req.getMotivo()));
        iptuParcelaRepository.save(p);
        return toParcelaResponse(requireParcela(parcelaId));
    }

    /**
     * Rebuilds {@code PENDENTE}/{@code ATRASADO} instalments after contract date changes.
     * Called from {@link IptuContratoRecalculoListener} after contract {@code COMMIT} (separate transaction).
     */
    @Transactional
    public void recalcularPorContrato(Long contratoId) {
        ContratoLocacaoEntity c = contratoLocacaoRepository
                .findById(contratoId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrato not found: " + contratoId));
        Long imovelId = c.getImovel().getId();
        List<IptuAnualEntity> anuais = iptuAnualRepository.findByImovel_IdOrderByAnoReferenciaDesc(imovelId);
        for (IptuAnualEntity a : anuais) {
            regenerarParcelasInterno(a);
        }
    }

    @Transactional
    public IptuConsultaDebitoResponse registrarConsulta(IptuConsultaDebitoWriteRequest req) {
        if (req.getDataConsulta().isAfter(LocalDate.now())) {
            throw new BusinessRuleException("data_consulta cannot be in the future.");
        }
        ImovelEntity im = requireImovel(req.getImovelId());
        IptuConsultaDebitoEntity e = new IptuConsultaDebitoEntity();
        e.setImovel(im);
        e.setDataConsulta(req.getDataConsulta());
        e.setExisteDebito(Boolean.TRUE.equals(req.getExisteDebito()));
        e.setValorDebito(req.getValorDebito());
        e.setObservacoes(trimToNull(req.getObservacoes()));
        e.setAnexoPath(trimToNull(req.getAnexoPath()));
        e.setCriadoPorUsuario(usuarioAtualOuNull());
        e = iptuConsultaDebitoRepository.save(e);
        return toConsultaResponse(e);
    }

    @Transactional(readOnly = true)
    public List<IptuConsultaDebitoResponse> historicoConsultas(Long imovelId, int limit) {
        requireImovel(imovelId);
        int lim = Math.min(Math.max(limit, 1), 500);
        return iptuConsultaDebitoRepository.findByImovel_IdOrderByDataConsultaDescIdDesc(imovelId).stream()
                .limit(lim)
                .map(this::toConsultaResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<IptuParcelaResponse> listarParcelas(
            Long imovelId,
            Short ano,
            Long contratoId,
            String status,
            String competenciaInicio,
            String competenciaFim,
            Pageable pageable) {
        Specification<IptuParcelaEntity> spec =
                IptuParcelaSpecifications.comFiltros(imovelId, ano, contratoId, status, competenciaInicio, competenciaFim);
        return iptuParcelaRepository.findAll(spec, pageable).map(this::toParcelaResponse);
    }

    @Transactional(readOnly = true)
    public List<IptuDashboardItemResponse> dashboard(Integer anoReferencia, String statusFiltro, Long imovelId) {
        validarAno(anoReferencia);
        short ano = anoReferencia.shortValue();
        List<IptuAnualEntity> anuais = iptuAnualRepository.findByAnoReferencia(ano).stream()
                .filter(a -> imovelId == null || a.getImovel().getId().equals(imovelId))
                .collect(Collectors.toList());
        List<IptuDashboardItemResponse> out = new ArrayList<>();
        for (IptuAnualEntity a : anuais) {
            IptuDashboardItemResponse row = buildDashboardRow(a);
            if (statusFiltro != null && !statusFiltro.isBlank()) {
                if (!rowMatchesStatusFilter(row, statusFiltro.trim().toUpperCase(Locale.ROOT))) {
                    continue;
                }
            }
            out.add(row);
        }
        return out;
    }

    /**
     * Daily job: sets {@code ATRASADO} when due date passed and status is still pending.
     * Idempotent for rows already overdue or paid.
     */
    @Transactional
    public int atualizarParcelasAtrasadas(LocalDate hoje) {
        Specification<IptuParcelaEntity> spec = (root, q, cb) -> cb.and(
                cb.equal(root.get("status"), ST_PENDENTE),
                cb.isNotNull(root.get("dataVencimento")),
                cb.lessThan(root.get("dataVencimento"), hoje));
        List<IptuParcelaEntity> pendentes = iptuParcelaRepository.findAll(spec);
        int n = 0;
        for (IptuParcelaEntity p : pendentes) {
            p.setStatus(ST_ATRASADO);
            iptuParcelaRepository.save(p);
            n++;
        }
        return n;
    }

    private boolean rowMatchesStatusFilter(IptuDashboardItemResponse row, String st) {
        if ("PENDENTE".equals(st)) {
            return row.getTotalPendente() != null && row.getTotalPendente().compareTo(BigDecimal.ZERO) > 0;
        }
        if ("ATRASADO".equals(st)) {
            return row.getTotalAtrasado() != null && row.getTotalAtrasado().compareTo(BigDecimal.ZERO) > 0;
        }
        if ("PAGO".equals(st)) {
            return row.getTotalPago() != null && row.getTotalPago().compareTo(BigDecimal.ZERO) > 0;
        }
        return true;
    }

    private IptuDashboardItemResponse buildDashboardRow(IptuAnualEntity a) {
        ImovelEntity im = a.getImovel();
        im.getId();
        List<IptuParcelaEntity> parcelas = iptuParcelaRepository.findByIptuAnual_IdOrderByCompetenciaMesAsc(a.getId());
        BigDecimal pago = sumStatus(parcelas, ST_PAGO);
        BigDecimal pend = sumStatus(parcelas, ST_PENDENTE);
        BigDecimal atr = sumStatus(parcelas, ST_ATRASADO);
        Optional<IptuParcelaEntity> prox = parcelas.stream()
                .filter(p -> ST_PENDENTE.equals(p.getStatus()) || ST_ATRASADO.equals(p.getStatus()))
                .min(Comparator.comparing(IptuParcelaEntity::getCompetenciaMes));
        List<IptuConsultaDebitoEntity> cons =
                iptuConsultaDebitoRepository.findByImovel_IdOrderByDataConsultaDescIdDesc(im.getId());
        Optional<IptuConsultaDebitoEntity> ult = cons.stream().findFirst();
        ContratoLocacaoEntity vig = selecionarContratoVigente(im.getId(), a.getAnoReferencia());

        IptuDashboardItemResponse r = new IptuDashboardItemResponse();
        r.setImovelId(im.getId());
        r.setNumeroPlanilha(im.getNumeroPlanilha());
        r.setTitulo(im.getTitulo());
        r.setCondominio(im.getCondominio());
        r.setUnidade(im.getUnidade());
        if (vig != null) {
            r.setContratoDataInicio(vig.getDataInicio());
            r.setContratoDataFim(vig.getDataFim());
            if (vig.getInquilinoPessoa() != null) {
                vig.getInquilinoPessoa().getId();
                r.setInquilinoNome(vig.getInquilinoPessoa().getNome());
            }
        }
        r.setIptuAnualId(a.getId());
        r.setAnoReferencia((int) a.getAnoReferencia());
        r.setValorAnual(a.getValorTotalAnual());
        r.setTotalPago(pago);
        r.setTotalPendente(pend);
        r.setTotalAtrasado(atr);
        prox.ifPresent(p -> {
            r.setProximaCompetencia(p.getCompetenciaMes());
            r.setProximaValor(p.getValorCalculado());
            r.setProximaVencimento(p.getDataVencimento());
        });
        ult.ifPresent(u -> {
            r.setUltimaConsultaData(u.getDataConsulta());
            r.setUltimaConsultaExisteDebito(u.isExisteDebito());
        });
        return r;
    }

    private static BigDecimal sumStatus(List<IptuParcelaEntity> parcelas, String st) {
        return parcelas.stream()
                .filter(p -> st.equals(p.getStatus()))
                .map(IptuParcelaEntity::getValorCalculado)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private ContratoLocacaoEntity selecionarContratoVigente(Long imovelId, short ano) {
        LocalDate ref = LocalDate.of(ano, 6, 15);
        List<ContratoLocacaoEntity> list = contratoLocacaoRepository.findByImovel_IdOrderByDataInicioDescIdDesc(imovelId);
        return list.stream()
                .filter(c -> intersectaAno(c, ano))
                .filter(c -> "VIGENTE".equalsIgnoreCase(String.valueOf(c.getStatus())))
                .filter(c -> !c.getDataInicio().isAfter(ref)
                        && (c.getDataFim() == null || !c.getDataFim().isBefore(ref)))
                .findFirst()
                .orElseGet(() -> list.stream().filter(c -> intersectaAno(c, ano)).findFirst().orElse(null));
    }

    private void regenerarParcelasInterno(IptuAnualEntity anual) {
        anual = iptuAnualRepository.findById(anual.getId()).orElseThrow();
        Long anualId = anual.getId();
        List<IptuParcelaEntity> existentes = iptuParcelaRepository.findByIptuAnual_IdOrderByCompetenciaMesAsc(anualId);
        Set<String> chavesProtegidas = existentes.stream()
                .filter(p -> ST_PAGO.equals(p.getStatus()) || ST_CANCELADO.equals(p.getStatus()))
                .map(this::chaveParcela)
                .collect(Collectors.toSet());
        iptuParcelaRepository.deleteByIptuAnual_IdAndStatusIn(anualId, List.of(ST_PENDENTE, ST_ATRASADO));
        int ano = anual.getAnoReferencia();
        LocalDate yearStart = LocalDate.of(ano, 1, 1);
        LocalDate yearEnd = LocalDate.of(ano, 12, 31);
        BigDecimal valor = anual.getValorTotalAnual();
        int div = anual.getDiasMesDivisor() != null ? anual.getDiasMesDivisor() : 30;
        Long imovelId = anual.getImovel().getId();
        List<ContratoLocacaoEntity> contratos = contratoLocacaoRepository.findByImovel_IdOrderByDataInicioDescIdDesc(imovelId).stream()
                .filter(c -> intersectaAno(c, (short) ano))
                .sorted(Comparator.comparing(ContratoLocacaoEntity::getDataInicio))
                .collect(Collectors.toList());
        List<IptuParcelaEntity> novas = new ArrayList<>();
        if (contratos.isEmpty()) {
            novas.addAll(
                    montarParcelasDeCalculo(
                            anual,
                            null,
                            IptuCalculadora.calcular(valor, ano, yearStart, yearEnd, div),
                            chavesProtegidas,
                            "Owner charge (no lease in period)"));
        } else {
            for (ContratoLocacaoEntity c : contratos) {
                IptuCalculadora.ResultadoCalculo res =
                        IptuCalculadora.calcular(valor, ano, c.getDataInicio(), c.getDataFim(), div);
                novas.addAll(montarParcelasDeCalculo(anual, c, res, chavesProtegidas, null));
            }
        }
        iptuParcelaRepository.saveAll(novas);
    }

    private List<IptuParcelaEntity> montarParcelasDeCalculo(
            IptuAnualEntity anual,
            ContratoLocacaoEntity contratoOuNull,
            IptuCalculadora.ResultadoCalculo res,
            Set<String> chavesProtegidas,
            String obsPadrao) {
        List<IptuParcelaEntity> out = new ArrayList<>();
        for (IptuCalculadora.ParcelaCalculada pc : res.parcelas()) {
            IptuParcelaEntity p = new IptuParcelaEntity();
            p.setIptuAnual(anual);
            p.setContratoLocacao(contratoOuNull);
            p.setCompetenciaMes(pc.competencia().toString());
            p.setDiasCobrados(pc.diasCobrados());
            p.setMesCompleto(pc.mesCompleto());
            p.setValorCalculado(pc.valor());
            p.setStatus(ST_PENDENTE);
            p.setDataVencimento(defaultVencimento(pc.competencia()));
            if (obsPadrao != null) {
                p.setObservacoes(obsPadrao);
            }
            String chave = chaveParcela(p);
            if (chavesProtegidas.contains(chave)) {
                continue;
            }
            out.add(p);
        }
        return out;
    }

    private String chaveParcela(IptuParcelaEntity p) {
        Long cid = p.getContratoLocacao() != null ? p.getContratoLocacao().getId() : null;
        return p.getCompetenciaMes() + "|" + cid;
    }

    private static LocalDate defaultVencimento(java.time.YearMonth ym) {
        int d = Math.min(VENCIMENTO_DIA_PADRAO, ym.lengthOfMonth());
        return ym.atDay(d);
    }

    private static boolean intersectaAno(ContratoLocacaoEntity c, short ano) {
        LocalDate y0 = LocalDate.of(ano, 1, 1);
        LocalDate y1 = LocalDate.of(ano, 12, 31);
        LocalDate fim = c.getDataFim() != null ? c.getDataFim() : y1;
        return !c.getDataInicio().isAfter(y1) && !fim.isBefore(y0);
    }

    private List<IptuParcelaResponse> listarParcelasDoAnual(Long anualId) {
        return iptuParcelaRepository.findByIptuAnual_IdOrderByCompetenciaMesAsc(anualId).stream()
                .map(this::toParcelaResponse)
                .collect(Collectors.toList());
    }

    private void validarAno(int ano) {
        if (ano < 2000 || ano > 2100) {
            throw new BusinessRuleException("anoReferencia must be between 2000 and 2100");
        }
    }

    private ImovelEntity requireImovel(Long id) {
        return imovelRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Imovel not found: " + id));
    }

    private IptuAnualEntity requireAnual(Long id) {
        return iptuAnualRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("IPTU annual not found: " + id));
    }

    private IptuParcelaEntity requireParcela(Long id) {
        return iptuParcelaRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("IPTU instalment not found: " + id));
    }

    private UsuarioEntity usuarioAtualOuNull() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated()) {
            return null;
        }
        return usuarioRepository.findWithPerfilByLoginIgnoreCase(a.getName()).orElse(null);
    }

    private static String mergeObs(String atual, String extra) {
        if (!StringUtils.hasText(atual)) {
            return extra;
        }
        return atual.trim() + "\n" + extra;
    }

    private static String trimToNull(String s) {
        if (!StringUtils.hasText(s)) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private IptuAnualResponse toAnualResponse(IptuAnualEntity e) {
        IptuAnualResponse r = new IptuAnualResponse();
        r.setId(e.getId());
        r.setImovelId(e.getImovel().getId());
        r.setAnoReferencia((int) e.getAnoReferencia());
        r.setValorTotalAnual(e.getValorTotalAnual());
        r.setDiasMesDivisor((int) e.getDiasMesDivisor());
        r.setObservacoes(e.getObservacoes());
        r.setAnexoCarnePath(e.getAnexoCarnePath());
        r.setCreatedAt(e.getCreatedAt());
        r.setUpdatedAt(e.getUpdatedAt());
        return r;
    }

    private IptuParcelaResponse toParcelaResponse(IptuParcelaEntity p) {
        IptuParcelaResponse r = new IptuParcelaResponse();
        r.setId(p.getId());
        r.setIptuAnualId(p.getIptuAnual().getId());
        r.setContratoLocacaoId(p.getContratoLocacao() != null ? p.getContratoLocacao().getId() : null);
        r.setCompetenciaMes(p.getCompetenciaMes());
        r.setDiasCobrados(p.getDiasCobrados());
        r.setMesCompleto(p.isMesCompleto());
        r.setValorCalculado(p.getValorCalculado());
        r.setStatus(p.getStatus());
        r.setDataVencimento(p.getDataVencimento());
        r.setDataPagamento(p.getDataPagamento());
        r.setPagamentoId(p.getPagamento() != null ? p.getPagamento().getId() : null);
        r.setObservacoes(p.getObservacoes());
        r.setCreatedAt(p.getCreatedAt());
        r.setUpdatedAt(p.getUpdatedAt());
        return r;
    }

    private IptuConsultaDebitoResponse toConsultaResponse(IptuConsultaDebitoEntity e) {
        IptuConsultaDebitoResponse r = new IptuConsultaDebitoResponse();
        r.setId(e.getId());
        r.setImovelId(e.getImovel().getId());
        r.setDataConsulta(e.getDataConsulta());
        r.setExisteDebito(e.isExisteDebito());
        r.setValorDebito(e.getValorDebito());
        r.setObservacoes(e.getObservacoes());
        r.setAnexoPath(e.getAnexoPath());
        r.setCriadoPorUsuarioId(e.getCriadoPorUsuario() != null ? e.getCriadoPorUsuario().getId() : null);
        r.setCreatedAt(e.getCreatedAt());
        return r;
    }
}
