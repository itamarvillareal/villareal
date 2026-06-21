package br.com.vilareal.documento.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.AlvaraDepositoJudicialDetector;
import br.com.vilareal.documento.ContratoHonorariosClausula3TextoBuilder;
import br.com.vilareal.documento.api.dto.*;
import br.com.vilareal.documento.domain.PapelHonorarioRepasse;
import br.com.vilareal.documento.domain.StatusRepasseHonorario;
import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosEntity;
import br.com.vilareal.documento.infrastructure.persistence.entity.HonorarioRepasseLancamentoEntity;
import br.com.vilareal.documento.infrastructure.persistence.repository.ContratoHonorariosRepository;
import br.com.vilareal.documento.infrastructure.persistence.repository.HonorarioRepasseLancamentoRepository;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.domain.StatusLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.imovel.domain.PapelReconciliacao;
import br.com.vilareal.imovel.infrastructure.persistence.repository.LocacaoRepasseLancamentoRepository;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.processo.application.ProcessoPartesVinculoTextoResolver;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Repasse de honorários sobre alvará — espelha {@code LocacaoReconciliacaoService} (imóveis),
 * sem alterar o motor de locação.
 */
@Service
public class HonorarioRepasseService {

    private static final BigDecimal CEM = new BigDecimal("100");
    private static final BigDecimal TOLERANCIA_REPASSE = new BigDecimal("1.00");

    private final HonorarioRepasseLancamentoRepository vinculoRepository;
    private final ContratoHonorariosRepository contratoRepository;
    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final ProcessoParteRepository processoParteRepository;
    private final PagamentoRepository pagamentoRepository;
    private final LocacaoRepasseLancamentoRepository locacaoVinculoRepository;

    public HonorarioRepasseService(
            HonorarioRepasseLancamentoRepository vinculoRepository,
            ContratoHonorariosRepository contratoRepository,
            LancamentoFinanceiroRepository lancamentoRepository,
            ProcessoParteRepository processoParteRepository,
            PagamentoRepository pagamentoRepository,
            LocacaoRepasseLancamentoRepository locacaoVinculoRepository) {
        this.vinculoRepository = vinculoRepository;
        this.contratoRepository = contratoRepository;
        this.lancamentoRepository = lancamentoRepository;
        this.processoParteRepository = processoParteRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.locacaoVinculoRepository = locacaoVinculoRepository;
    }

    /** Repasse ao contratante = valor × (1 − percentual/100). Retenção = valor − repasse (derivada). */
    public BigDecimal repasseEsperado(BigDecimal valorAlvara, BigDecimal percentualProveito) {
        BigDecimal pct = percentualProveito != null ? percentualProveito : BigDecimal.ZERO;
        BigDecimal fatorRepasse = BigDecimal.ONE.subtract(pct.divide(CEM, 6, RoundingMode.HALF_UP));
        return escala(valorAlvara.multiply(fatorRepasse));
    }

    public BigDecimal retencao(BigDecimal valorAlvara, BigDecimal repasseEsperado) {
        return escala(valorAlvara.subtract(repasseEsperado));
    }

    public StatusRepasseHonorario statusRepasse(
            BigDecimal valorAlvara, BigDecimal repassado, BigDecimal percentualProveito) {
        if (repassado == null || repassado.compareTo(BigDecimal.ZERO) <= 0) {
            return StatusRepasseHonorario.PENDENTE;
        }
        BigDecimal esperado = repasseEsperado(valorAlvara, percentualProveito);
        BigDecimal diff = repassado.subtract(esperado).abs();
        return diff.compareTo(TOLERANCIA_REPASSE) <= 0
                ? StatusRepasseHonorario.FEITO
                : StatusRepasseHonorario.DIVERGENTE;
    }

    /**
     * Créditos prováveis de alvará ainda não classificados (read-only). Espelha
     * {@code LocacaoReconciliacaoService#creditosCandidatosAluguelSemClassificar}.
     */
    @Transactional(readOnly = true)
    public List<CandidatoAlvaraProcessoResponse> candidatosAlvara() {
        List<CandidatoAlvaraProcessoResponse> grupos = new ArrayList<>();
        for (ContratoHonorariosEntity contrato : contratoRepository.findAllPercentualProveitoComProcesso()) {
            ProcessoEntity processo = contrato.getProcesso();
            if (processo == null || processo.getId() == null) {
                continue;
            }
            Long processoId = processo.getId();
            List<ProcessoParteEntity> partes =
                    processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(processoId);
            ContratanteInfo contratante = resolverContratante(contrato, partes);
            BigDecimal pct = contrato.getPercentualProveito();

            List<CandidatoAlvaraCreditoResponse> candidatos = new ArrayList<>();
            for (LancamentoFinanceiroEntity lanc : lancamentoRepository.findCreditosPorProcesso(processoId)) {
                if (!elegivelCandidatoAlvara(lanc)) {
                    continue;
                }
                BigDecimal valor = valorAbsoluto(lanc);
                BigDecimal repasseEsp = repasseEsperado(valor, pct);
                candidatos.add(new CandidatoAlvaraCreditoResponse(
                        lanc.getId(),
                        lanc.getDataLancamento(),
                        valor,
                        descricaoLancamento(lanc),
                        pct,
                        retencao(valor, repasseEsp),
                        repasseEsp));
            }
            if (candidatos.isEmpty()) {
                continue;
            }
            candidatos.sort(Comparator.comparing(CandidatoAlvaraCreditoResponse::data, Comparator.nullsLast(LocalDate::compareTo))
                    .reversed());
            String codigoCliente =
                    processo.getCliente() != null ? processo.getCliente().getCodigoCliente() : null;
            grupos.add(new CandidatoAlvaraProcessoResponse(
                    contrato.getId(),
                    processoId,
                    codigoCliente,
                    processo.getNumeroInterno(),
                    contratante.nome(),
                    pct,
                    candidatos));
        }
        grupos.sort(Comparator.comparing(
                        (CandidatoAlvaraProcessoResponse g) -> g.candidatos().stream()
                                .map(CandidatoAlvaraCreditoResponse::data)
                                .filter(Objects::nonNull)
                                .max(LocalDate::compareTo)
                                .orElse(null),
                        Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(CandidatoAlvaraProcessoResponse::numeroInterno, Comparator.nullsLast(Integer::compareTo)));
        return grupos;
    }

    private boolean elegivelCandidatoAlvara(LancamentoFinanceiroEntity lanc) {
        if (lanc == null || lanc.getId() == null) {
            return false;
        }
        if (!StatusLancamento.ATIVO.equals(lanc.getStatus())) {
            return false;
        }
        if (lanc.getNatureza() != NaturezaLancamento.CREDITO) {
            return false;
        }
        if (!AlvaraDepositoJudicialDetector.pareceDepositoJudicialOuAlvara(lanc)) {
            return false;
        }
        if (vinculoRepository.existsByLancamentoFinanceiro_IdAndPapel(lanc.getId(), PapelHonorarioRepasse.ALVARA)) {
            return false;
        }
        if (pagamentoRepository.existsByFinanceiroLancamento_Id(lanc.getId())) {
            return false;
        }
        if (locacaoVinculoRepository.existsByLancamentoFinanceiro_IdAndPapel(lanc.getId(), PapelReconciliacao.ALUGUEL)) {
            return false;
        }
        return true;
    }

    private static String descricaoLancamento(LancamentoFinanceiroEntity l) {
        if (StringUtils.hasText(l.getDescricaoNorm())) {
            return l.getDescricaoNorm().trim();
        }
        if (StringUtils.hasText(l.getDescricao())) {
            return l.getDescricao().trim();
        }
        return null;
    }

    @Transactional
    public HonorarioRepasseVinculoResponse classificarAlvara(Long lancamentoId) {
        LancamentoFinanceiroEntity lanc = carregarLancamentoAtivo(lancamentoId);
        if (lanc.getNatureza() != NaturezaLancamento.CREDITO) {
            throw new BusinessRuleException("Somente créditos podem ser classificados como alvará.");
        }
        ProcessoEntity processo = exigirProcesso(lanc);
        ContratoHonorariosEntity contrato = contratoRepository
                .findByProcessoIdWithDetalhes(processo.getId())
                .orElseThrow(() -> new BusinessRuleException(
                        "Processo não possui contrato de honorários. Cadastre o contrato antes de classificar alvará."));
        exigirPercentualProveito(contrato);

        Optional<HonorarioRepasseLancamentoEntity> existente =
                vinculoRepository.findByContratoHonorarios_IdAndLancamentoFinanceiro_IdAndPapel(
                        contrato.getId(), lanc.getId(), PapelHonorarioRepasse.ALVARA);
        if (existente.isPresent()) {
            return toVinculoResponse(existente.get());
        }

        HonorarioRepasseLancamentoEntity vinculo = new HonorarioRepasseLancamentoEntity();
        vinculo.setContratoHonorarios(contrato);
        vinculo.setLancamentoFinanceiro(lanc);
        vinculo.setPapel(PapelHonorarioRepasse.ALVARA);
        vinculo.setDataReferencia(lanc.getDataLancamento());
        vinculo.setValor(valorAbsoluto(lanc));
        vinculo = vinculoRepository.save(vinculo);
        return toVinculoResponse(vinculo);
    }

    @Transactional
    public HonorarioRepasseVinculoResponse vincularRepasse(Long lancamentoDebitoId, Long alvaraLancamentoId) {
        LancamentoFinanceiroEntity debito = carregarLancamentoAtivo(lancamentoDebitoId);
        if (debito.getNatureza() != NaturezaLancamento.DEBITO) {
            throw new BusinessRuleException("Somente débitos podem ser vinculados como repasse ao contratante.");
        }
        ProcessoEntity processo = exigirProcesso(debito);
        ContratoHonorariosEntity contrato = contratoRepository
                .findByProcessoIdWithDetalhes(processo.getId())
                .orElseThrow(() -> new BusinessRuleException("Processo não possui contrato de honorários."));
        exigirPercentualProveito(contrato);

        HonorarioRepasseLancamentoEntity alvaraVinculo =
                resolverAlvaraVinculo(contrato, alvaraLancamentoId, processo.getId());

        Optional<HonorarioRepasseLancamentoEntity> existente =
                vinculoRepository.findByContratoHonorarios_IdAndLancamentoFinanceiro_IdAndPapel(
                        contrato.getId(), debito.getId(), PapelHonorarioRepasse.REPASSE);
        if (existente.isPresent()) {
            return toVinculoResponse(existente.get());
        }

        HonorarioRepasseLancamentoEntity vinculo = new HonorarioRepasseLancamentoEntity();
        vinculo.setContratoHonorarios(contrato);
        vinculo.setLancamentoFinanceiro(debito);
        vinculo.setPapel(PapelHonorarioRepasse.REPASSE);
        vinculo.setDataReferencia(debito.getDataLancamento());
        vinculo.setValor(valorAbsoluto(debito));
        vinculo.setAlvaraVinculo(alvaraVinculo);
        vinculo = vinculoRepository.save(vinculo);
        return toVinculoResponse(vinculo);
    }

    @Transactional(readOnly = true)
    public RepassePendenteHonorarioCarteiraResponse repassesPendentesHonorario() {
        List<RepassePendenteHonorarioItemResponse> itens = new ArrayList<>();
        for (HonorarioRepasseLancamentoEntity alvaraVinculo : vinculoRepository.findAllAlvarasParaCarteira()) {
            RepassePendenteHonorarioItemResponse item = montarItemSePendente(alvaraVinculo);
            if (item != null) {
                itens.add(item);
            }
        }
        itens.sort(Comparator.comparing(
                        RepassePendenteHonorarioItemResponse::dataReferencia, Comparator.nullsLast(LocalDate::compareTo))
                .reversed()
                .thenComparing(RepassePendenteHonorarioItemResponse::valorEmAberto, Comparator.reverseOrder()));

        BigDecimal totalEmAberto = itens.stream()
                .map(RepassePendenteHonorarioItemResponse::valorEmAberto)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new RepassePendenteHonorarioCarteiraResponse(escala(totalEmAberto), itens);
    }

    private RepassePendenteHonorarioItemResponse montarItemSePendente(HonorarioRepasseLancamentoEntity alvaraVinculo) {
        if (alvaraVinculo == null || alvaraVinculo.getPapel() != PapelHonorarioRepasse.ALVARA) {
            return null;
        }
        ContratoHonorariosEntity contrato = alvaraVinculo.getContratoHonorarios();
        if (contrato == null || contrato.getId() == null) {
            return null;
        }
        String tipo = normalizarTipo(contrato.getTipoRemuneracao());
        boolean requerRevisao = !ContratoHonorariosClausula3TextoBuilder.TIPO_PERCENTUAL_PROVEITO.equals(tipo);
        if (requerRevisao) {
            return null;
        }

        BigDecimal valorAlvara = valorAbsoluto(alvaraVinculo);
        if (valorAlvara.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }

        BigDecimal pct = contrato.getPercentualProveito();
        BigDecimal esperado = repasseEsperado(valorAlvara, pct);
        BigDecimal repassado = somarRepasses(alvaraVinculo.getId());
        StatusRepasseHonorario status = statusRepasse(valorAlvara, repassado, pct);
        if (status == StatusRepasseHonorario.FEITO) {
            return null;
        }

        BigDecimal valorEmAberto = escala(esperado.subtract(repassado));
        if (valorEmAberto.compareTo(BigDecimal.ZERO) < 0) {
            valorEmAberto = BigDecimal.ZERO;
        }

        ProcessoEntity processo = contrato.getProcesso();
        Long processoId = processo != null ? processo.getId() : null;
        List<ProcessoParteEntity> partes = processoId != null
                ? processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(processoId)
                : List.of();
        ContratanteInfo contratante = resolverContratante(contrato, partes);

        String codigoCliente = null;
        Integer numeroInterno = null;
        if (processo != null) {
            numeroInterno = processo.getNumeroInterno();
            if (processo.getCliente() != null) {
                codigoCliente = processo.getCliente().getCodigoCliente();
            }
        }

        LancamentoFinanceiroEntity lancAlvara = alvaraVinculo.getLancamentoFinanceiro();
        return new RepassePendenteHonorarioItemResponse(
                alvaraVinculo.getId(),
                contrato.getId(),
                processoId,
                codigoCliente,
                numeroInterno,
                lancAlvara != null ? lancAlvara.getId() : null,
                alvaraVinculo.getDataReferencia(),
                contratante.pessoaId(),
                contratante.nome(),
                valorAlvara,
                pct,
                retencao(valorAlvara, esperado),
                esperado,
                escala(repassado),
                valorEmAberto,
                status,
                false);
    }

    private HonorarioRepasseLancamentoEntity resolverAlvaraVinculo(
            ContratoHonorariosEntity contrato, Long alvaraLancamentoId, Long processoId) {
        if (alvaraLancamentoId != null) {
            HonorarioRepasseLancamentoEntity v = vinculoRepository
                    .findByContratoHonorarios_IdAndLancamentoFinanceiro_IdAndPapel(
                            contrato.getId(), alvaraLancamentoId, PapelHonorarioRepasse.ALVARA)
                    .orElseThrow(() -> new BusinessRuleException(
                            "Alvará não classificado para este contrato (lançamento " + alvaraLancamentoId + ")."));
            if (statusRepasse(
                            valorAbsoluto(v),
                            somarRepasses(v.getId()),
                            contrato.getPercentualProveito())
                    == StatusRepasseHonorario.FEITO) {
                throw new BusinessRuleException("Repasse deste alvará já está concluído.");
            }
            return v;
        }

        List<HonorarioRepasseLancamentoEntity> pendentes = new ArrayList<>();
        for (HonorarioRepasseLancamentoEntity alvara : vinculoRepository.findAllAlvarasParaCarteira()) {
            if (alvara.getContratoHonorarios() == null
                    || !Objects.equals(alvara.getContratoHonorarios().getId(), contrato.getId())) {
                continue;
            }
            if (alvara.getLancamentoFinanceiro() != null
                    && alvara.getLancamentoFinanceiro().getProcesso() != null
                    && !Objects.equals(alvara.getLancamentoFinanceiro().getProcesso().getId(), processoId)) {
                continue;
            }
            BigDecimal valorAlvara = valorAbsoluto(alvara);
            StatusRepasseHonorario st =
                    statusRepasse(valorAlvara, somarRepasses(alvara.getId()), contrato.getPercentualProveito());
            if (st != StatusRepasseHonorario.FEITO) {
                pendentes.add(alvara);
            }
        }
        if (pendentes.isEmpty()) {
            throw new BusinessRuleException("Não há alvará pendente de repasse neste processo.");
        }
        if (pendentes.size() > 1) {
            throw new BusinessRuleException(
                    "Há mais de um alvará pendente — informe alvaraLancamentoId no corpo da requisição.");
        }
        return pendentes.get(0);
    }

    private BigDecimal somarRepasses(Long alvaraVinculoId) {
        BigDecimal total = BigDecimal.ZERO;
        for (HonorarioRepasseLancamentoEntity rep :
                vinculoRepository.findByAlvaraVinculo_IdOrderByIdAsc(alvaraVinculoId)) {
            total = total.add(valorAbsoluto(rep));
        }
        return total;
    }

    private void exigirPercentualProveito(ContratoHonorariosEntity contrato) {
        String tipo = normalizarTipo(contrato.getTipoRemuneracao());
        if (!ContratoHonorariosClausula3TextoBuilder.TIPO_PERCENTUAL_PROVEITO.equals(tipo)) {
            throw new BusinessRuleException(
                    "Contrato com remuneração "
                            + tipo
                            + " — classifique manualmente (revisar). Por ora só PERCENTUAL_PROVEITO é automático.");
        }
        if (contrato.getPercentualProveito() == null) {
            throw new BusinessRuleException("Contrato percentual sem percentual_proveito informado.");
        }
    }

    private static String normalizarTipo(String tipo) {
        if (!StringUtils.hasText(tipo)) {
            return ContratoHonorariosClausula3TextoBuilder.TIPO_PERCENTUAL_PROVEITO;
        }
        return tipo.trim().toUpperCase();
    }

    private LancamentoFinanceiroEntity carregarLancamentoAtivo(Long id) {
        LancamentoFinanceiroEntity lanc = lancamentoRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Lançamento financeiro não encontrado: " + id));
        if (!StatusLancamento.ATIVO.equals(lanc.getStatus())) {
            throw new BusinessRuleException("Lançamento não está ativo.");
        }
        return lanc;
    }

    private static ProcessoEntity exigirProcesso(LancamentoFinanceiroEntity lanc) {
        if (lanc.getProcesso() == null || lanc.getProcesso().getId() == null) {
            throw new BusinessRuleException("Lançamento sem processo vinculado (Cod. cliente + Proc. no Financeiro).");
        }
        return lanc.getProcesso();
    }

    private record ContratanteInfo(Long pessoaId, String nome) {}

    private ContratanteInfo resolverContratante(
            ContratoHonorariosEntity contrato, List<ProcessoParteEntity> partes) {
        ProcessoEntity processo = contrato.getProcesso();
        Long pessoaId = contrato.getPessoa() != null ? contrato.getPessoa().getId() : null;
        String nome = contrato.getPessoa() != null ? contrato.getPessoa().getNome() : null;
        if (processo != null && partes != null && !partes.isEmpty()) {
            String parteCliente = ProcessoPartesVinculoTextoResolver.parteCliente(processo, partes);
            if (StringUtils.hasText(parteCliente)) {
                nome = parteCliente;
            }
            Long pessoaParte =
                    ProcessoPartesVinculoTextoResolver.primeiraPessoaIdParteCliente(processo, partes);
            if (pessoaParte != null) {
                pessoaId = pessoaParte;
            }
        }
        return new ContratanteInfo(pessoaId, nome);
    }

    private HonorarioRepasseVinculoResponse toVinculoResponse(HonorarioRepasseLancamentoEntity v) {
        ContratoHonorariosEntity c = v.getContratoHonorarios();
        ProcessoEntity p = c != null ? c.getProcesso() : null;
        BigDecimal pct = c != null ? c.getPercentualProveito() : null;
        BigDecimal valorAlvara = valorAbsoluto(v);
        BigDecimal repasseEsp = null;
        BigDecimal ret = null;
        if (v.getPapel() == PapelHonorarioRepasse.ALVARA && pct != null && valorAlvara.compareTo(BigDecimal.ZERO) > 0) {
            repasseEsp = repasseEsperado(valorAlvara, pct);
            ret = retencao(valorAlvara, repasseEsp);
        }
        return new HonorarioRepasseVinculoResponse(
                v.getId(),
                c != null ? c.getId() : null,
                p != null ? p.getId() : null,
                v.getLancamentoFinanceiro() != null ? v.getLancamentoFinanceiro().getId() : null,
                v.getPapel(),
                v.getDataReferencia(),
                v.getValor(),
                v.getAlvaraVinculo() != null ? v.getAlvaraVinculo().getId() : null,
                pct,
                ret,
                repasseEsp);
    }

    private static BigDecimal valorAbsoluto(HonorarioRepasseLancamentoEntity v) {
        return v.getValor() != null ? v.getValor().abs() : BigDecimal.ZERO;
    }

    private static BigDecimal valorAbsoluto(LancamentoFinanceiroEntity l) {
        return l.getValor() != null ? l.getValor().abs() : BigDecimal.ZERO;
    }

    private static BigDecimal escala(BigDecimal v) {
        if (v == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return v.setScale(2, RoundingMode.HALF_UP);
    }
}
