package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.financeiro.domain.DescricaoNormalizer;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.domain.RecorrenciaValorPerfilUtil;
import br.com.vilareal.financeiro.domain.RecorrenciaValorPerfilUtil.ClassePrecisao;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaBancariaEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaBancariaRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.imovel.api.dto.ConciliarAlugueisAutomaticoResponse;
import br.com.vilareal.imovel.api.dto.GerarRepassesInternosResponse;
import br.com.vilareal.imovel.api.dto.MatrizCompetenciasResponse;
import br.com.vilareal.imovel.api.dto.MatrizCompetenciasResponse.MatrizCompetenciaAluguelVinculadoResponse;
import br.com.vilareal.imovel.api.dto.MatrizCompetenciasResponse.MatrizCompetenciaCandidatoResponse;
import br.com.vilareal.imovel.api.dto.MatrizCompetenciasResponse.MatrizCompetenciaItemResponse;
import br.com.vilareal.imovel.api.dto.CreditoCandidatoAluguelItem;
import br.com.vilareal.imovel.api.dto.ReconciliacaoResultadoResponse;
import br.com.vilareal.imovel.api.dto.ReconciliacaoResultadoResponse.ReconciliacaoResultadoCompetenciaResponse;
import br.com.vilareal.imovel.api.dto.RepassePendenteCarteiraResponse;
import br.com.vilareal.imovel.api.dto.RepassePendenteItemResponse;
import br.com.vilareal.imovel.api.dto.ReconciliacaoSugestaoItemResponse;
import br.com.vilareal.imovel.api.dto.ReconciliacaoVincularRequest;
import br.com.vilareal.imovel.api.dto.ReconciliacaoVinculoResponse;
import br.com.vilareal.imovel.domain.PapelReconciliacao;
import br.com.vilareal.imovel.domain.StatusRepasse;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.LocacaoRepasseLancamentoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelProcessoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.LocacaoRepasseLancamentoRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Backbone de reconciliação do financeiro de imóveis: liga o ciclo de locação ao caixa real
 * ({@code financeiro_lancamento}) e calcula o resultado SOMENTE a partir dos vínculos confirmados.
 */
@Service
public class LocacaoReconciliacaoService {

    /** Tolerância em reais para considerar repasse "batido" com o esperado. */
    private static final BigDecimal TOLERANCIA_REPASSE = new BigDecimal("0.01");
    private static final BigDecimal CEM = new BigDecimal("100");
    /** Proximidade (em dias) entre a data do lançamento e o dia esperado no contrato. */
    private static final int TOLERANCIA_DIAS = 3;

    /** Tolerância relativa (±5%) entre o valor do lançamento órfão e o valor esperado (aluguel/repasse). */
    private static final BigDecimal TOLERANCIA_VALOR_ORFAO = new BigDecimal("0.05");
    /** Conta contábil "A" (Escritório) — toda administração de imóvel flui aqui. */
    private static final String CODIGO_CONTA_ADMINISTRACAO = "A";

    /** Banco virtual dos lançamentos automáticos de repasse interno (extrato no Financeiro). */
    private static final String TIPO_CONTA_REPASSE_INTERNO = "VIRTUAL";
    /** Origem dos lançamentos gerados automaticamente. */
    private static final String ORIGEM_AUTO = "AUTO";
    /** Origem do vínculo locacao_repasse_lancamento criado pela conciliação automática. */
    public static final String ORIGEM_VINCULO_AUTO = "AUTO";
    public static final int NUMERO_BANCO_CORA = 26;
    /** Prefixo do {@code numero_lancamento} do débito interno; embute o id do vínculo de ALUGUEL (idempotência). */
    private static final String PREFIXO_GRUPO_REPASSE_INTERNO = "AUTO-REP-";

    private static final Logger log = LoggerFactory.getLogger(LocacaoReconciliacaoService.class);

    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final LocacaoRepasseLancamentoRepository vinculoRepository;
    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final ContaContabilRepository contaContabilRepository;
    private final ContaBancariaRepository contaBancariaRepository;
    private final ImovelProcessoRepository imovelProcessoRepository;

    public LocacaoReconciliacaoService(
            ContratoLocacaoRepository contratoLocacaoRepository,
            LocacaoRepasseLancamentoRepository vinculoRepository,
            LancamentoFinanceiroRepository lancamentoRepository,
            ContaContabilRepository contaContabilRepository,
            ContaBancariaRepository contaBancariaRepository,
            ImovelProcessoRepository imovelProcessoRepository) {
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.vinculoRepository = vinculoRepository;
        this.lancamentoRepository = lancamentoRepository;
        this.contaContabilRepository = contaContabilRepository;
        this.contaBancariaRepository = contaBancariaRepository;
        this.imovelProcessoRepository = imovelProcessoRepository;
    }

    // ----------------------------------------------------------------------------------------- (B)

    /** Sugestões de papel para os lançamentos do imóvel (por processo), opcionalmente filtradas pela competência. */
    @Transactional(readOnly = true)
    public List<ReconciliacaoSugestaoItemResponse> sugerir(Long contratoId, String competencia) {
        ContratoLocacaoEntity contrato = requireContrato(contratoId);
        YearMonth competenciaFiltro = parseCompetenciaOpcional(competencia);

        Long processoId = processoIdDoContrato(contrato);
        if (processoId == null) {
            return List.of();
        }

        List<LancamentoFinanceiroEntity> candidatos = lancamentoRepository.findByProcessoId(processoId);
        Map<String, PapelReconciliacao> historico = historicoPapelPorDescricao(contratoId);
        Map<Long, LocacaoRepasseLancamentoEntity> jaVinculados = vinculoPorLancamento(contratoId, candidatos);

        List<ReconciliacaoSugestaoItemResponse> saida = new ArrayList<>();
        for (LancamentoFinanceiroEntity l : candidatos) {
            if (competenciaFiltro != null && !mesmaCompetencia(l.getDataLancamento(), competenciaFiltro)) {
                continue;
            }
            YearMonth competenciaLanc = competenciaFiltro != null
                    ? competenciaFiltro
                    : (l.getDataLancamento() != null ? YearMonth.from(l.getDataLancamento()) : null);
            SugestaoPapel s = sugerirPapel(l, contrato, historico, competenciaLanc);
            String competenciaSugerida = competenciaLanc != null ? competenciaLanc.toString() : null;
            LocacaoRepasseLancamentoEntity vinculo = jaVinculados.get(l.getId());
            saida.add(new ReconciliacaoSugestaoItemResponse(
                    l.getId(),
                    l.getDataLancamento(),
                    l.getDescricao(),
                    descricaoNorm(l),
                    l.getValor(),
                    l.getNatureza() != null ? l.getNatureza().name() : null,
                    s.papel(),
                    s.confianca(),
                    competenciaSugerida,
                    vinculo != null,
                    vinculo != null ? vinculo.getPapel() : null,
                    vinculo != null ? vinculo.getId() : null,
                    "PROCESSO",
                    false,
                    null,
                    null));
        }

        // (B.1) Candidatos ÓRFÃOS (sem processo) que casam com o imóvel — serão adotados ao confirmar.
        if (competenciaFiltro != null) {
            saida.addAll(sugerirOrfaos(contrato, competenciaFiltro));
        }
        return saida;
    }

    /**
     * Busca lançamentos sem processo na janela da competência e propõe adoção quando casam com o
     * imóvel por nome (inquilino/locador) ou por valor próximo do aluguel/repasse esperado.
     */
    private List<ReconciliacaoSugestaoItemResponse> sugerirOrfaos(
            ContratoLocacaoEntity contrato, YearMonth competencia) {
        LocalDate inicio = competencia.atDay(1);
        LocalDate fim = competencia.atEndOfMonth();
        List<LancamentoFinanceiroEntity> orfaos =
                lancamentoRepository.findOrfaosNoIntervalo(inicio, fim);
        if (orfaos.isEmpty()) {
            return List.of();
        }

        Set<String> tokensInquilino = tokensNome(nomePessoa(contrato.getInquilinoPessoa()));
        Set<String> tokensLocador = tokensNome(nomePessoa(contrato.getLocadorPessoa()));
        ClienteEntity cliente = clienteDoImovel(contrato);
        String codigoCliente = cliente != null ? cliente.getCodigoCliente() : null;
        Long processoAlvoId = processoIdDoContrato(contrato);

        List<ReconciliacaoSugestaoItemResponse> saida = new ArrayList<>();
        for (LancamentoFinanceiroEntity l : orfaos) {
            SugestaoPapel s = avaliarOrfao(l, contrato, tokensInquilino, tokensLocador, competencia);
            if (s == null) {
                continue;
            }
            saida.add(new ReconciliacaoSugestaoItemResponse(
                    l.getId(),
                    l.getDataLancamento(),
                    l.getDescricao(),
                    descricaoNorm(l),
                    l.getValor(),
                    l.getNatureza() != null ? l.getNatureza().name() : null,
                    s.papel(),
                    s.confianca(),
                    competencia.toString(),
                    false,
                    null,
                    null,
                    "ORFAO",
                    true,
                    codigoCliente,
                    processoAlvoId));
        }
        return saida;
    }

    /**
     * Avalia um lançamento órfão como candidato do imóvel. Retorna {@code null} quando não casa
     * (nem por nome, nem por valor) — nunca classifica algo que não pertence ao imóvel.
     */
    private SugestaoPapel avaliarOrfao(
            LancamentoFinanceiroEntity l, ContratoLocacaoEntity contrato,
            Set<String> tokensInquilino, Set<String> tokensLocador, YearMonth competencia) {
        if (l.getNatureza() == null || l.getValor() == null) {
            return null;
        }
        BigDecimal valor = l.getValor().abs();
        int dia = l.getDataLancamento() != null ? l.getDataLancamento().getDayOfMonth() : -1;
        Set<String> tokensDescricao = tokensNome(descricaoNorm(l));

        if (l.getNatureza() == NaturezaLancamento.CREDITO) {
            boolean nomeOk = nomeCasa(tokensDescricao, tokensInquilino);
            boolean valorOk = valorProximo(valor, contrato.getValorAluguel());
            if (!nomeOk && !valorOk) {
                return null;
            }
            boolean diaOk = diaProximo(dia, contrato.getDiaVencimentoAluguel());
            return new SugestaoPapel(PapelReconciliacao.ALUGUEL, confiancaOrfao(nomeOk, valorOk, diaOk));
        }

        // DÉBITO → repasse ao locador, ANCORADO EM VALOR (próprio nunca sugere; fora da banda → null).
        boolean nomeOk = nomeCasa(tokensDescricao, tokensLocador);
        boolean diaOk = diaProximo(dia, contrato.getDiaRepasse());
        return sugerirRepasseDebito(valor, contrato, nomeOk, diaOk, competencia);
    }

    private static ConfiancaSugestao confiancaOrfao(boolean nomeOk, boolean valorOk, boolean diaOk) {
        if (nomeOk && valorOk) {
            return ConfiancaSugestao.ALTA;
        }
        if (nomeOk) {
            return diaOk ? ConfiancaSugestao.ALTA : ConfiancaSugestao.MEDIA;
        }
        // só valor
        return diaOk ? ConfiancaSugestao.MEDIA : ConfiancaSugestao.BAIXA;
    }

    private SugestaoPapel sugerirPapel(
            LancamentoFinanceiroEntity l, ContratoLocacaoEntity contrato,
            Map<String, PapelReconciliacao> historico, YearMonth competencia) {
        // 1) Aprende com o que já foi confirmado neste imóvel (descrição normalizada → papel dominante).
        PapelReconciliacao porHistorico = historico.get(descricaoNorm(l));
        if (porHistorico != null) {
            return new SugestaoPapel(porHistorico, ConfiancaSugestao.ALTA);
        }

        BigDecimal valor = l.getValor() == null ? BigDecimal.ZERO : l.getValor().abs();
        int dia = l.getDataLancamento() != null ? l.getDataLancamento().getDayOfMonth() : -1;

        // 2) Crédito ancorado no aluguel esperado + dia de vencimento.
        if (l.getNatureza() == NaturezaLancamento.CREDITO) {
            ClassePrecisao precisao = RecorrenciaValorPerfilUtil.classificar(valor, contrato.getValorAluguel());
            boolean diaOk = diaProximo(dia, contrato.getDiaVencimentoAluguel());
            ConfiancaSugestao confianca = switch (precisao) {
                case EXATO -> ConfiancaSugestao.ALTA;
                case APROXIMADO -> diaOk ? ConfiancaSugestao.ALTA : ConfiancaSugestao.MEDIA;
                case DIVERGENTE -> diaOk ? ConfiancaSugestao.MEDIA : ConfiancaSugestao.BAIXA;
            };
            return new SugestaoPapel(PapelReconciliacao.ALUGUEL, confianca);
        }

        // 3) Débito: repasse ANCORADO EM VALOR (próprio nunca sugere; fora da banda → despesa).
        boolean nomeLocadorOk =
                nomeCasa(tokensNome(descricaoNorm(l)), tokensNome(nomePessoa(contrato.getLocadorPessoa())));
        boolean diaOk = diaProximo(dia, contrato.getDiaRepasse());
        SugestaoPapel repasse = sugerirRepasseDebito(valor, contrato, nomeLocadorOk, diaOk, competencia);
        if (repasse != null) {
            return repasse;
        }
        return new SugestaoPapel(PapelReconciliacao.DESPESA, ConfiancaSugestao.BAIXA);
    }

    /**
     * Sugestão de REPASSE para um DÉBITO (saída), ANCORADA EM VALOR. Regras:
     * <ol>
     *   <li>Imóvel PRÓPRIO ({@code cliente.proprio = true}): nunca sugere — o repasse é
     *       gerado pelo par virtual automático.</li>
     *   <li>Terceiros: só sugere se {@code |valor| ∈ [repasseEsperado×0,85 ; repasseEsperado×1,05]}.
     *       Fora da banda → {@code null} (não sugere, nem MÉDIA/BAIXA).</li>
     *   <li>Confiança = proximidade de valor (principal); nome do locador e dia de repasse apenas
     *       elevam a confiança (desempate), nunca filtram.</li>
     * </ol>
     * {@code repasseEsperado = aluguel − aluguel×taxa − despesasVinculadas(competência)} (sem
     * despesa vinculada → {@code aluguel×(1−taxa)}).
     */
    private SugestaoPapel sugerirRepasseDebito(
            BigDecimal valor, ContratoLocacaoEntity contrato, boolean nomeLocadorOk, boolean diaRepasseOk,
            YearMonth competencia) {
        if (isImovelProprio(contrato)) {
            return null; // (1) próprio: repasse é virtual/automático
        }
        BigDecimal esperado = repasseEsperadoComDespesas(contrato, competencia);
        if (esperado == null || esperado.signum() <= 0 || valor == null) {
            return null;
        }
        BigDecimal v = valor.abs();
        BigDecimal piso = esperado.multiply(new BigDecimal("0.85"));
        BigDecimal teto = esperado.multiply(new BigDecimal("1.05"));
        if (v.compareTo(piso) < 0 || v.compareTo(teto) > 0) {
            return null; // (2) fora da banda → não sugere
        }
        double proximidade = 1.0
                - v.subtract(esperado).abs().divide(esperado, 6, RoundingMode.HALF_UP).doubleValue();
        return new SugestaoPapel(
                PapelReconciliacao.REPASSE, confiancaRepasse(proximidade, nomeLocadorOk, diaRepasseOk));
    }

    /** {@code aluguel×(1−taxa) − despesasVinculadas(competência)}; sem competência, ignora despesas. */
    private BigDecimal repasseEsperadoComDespesas(ContratoLocacaoEntity contrato, YearMonth competencia) {
        BigDecimal base = repasseEsperadoPorTaxa(contrato.getValorAluguel(), contrato.getTaxaAdministracaoPercent());
        if (base == null) {
            return null;
        }
        BigDecimal despesas = competencia != null
                ? despesasDaCompetencia(contrato.getId(), competencia.toString())
                : BigDecimal.ZERO;
        return base.subtract(despesas).setScale(2, RoundingMode.HALF_UP);
    }

    /** Principal = proximidade de valor; nome/dia só elevam a confiança (desempate). */
    private static ConfiancaSugestao confiancaRepasse(double proximidade, boolean nomeOk, boolean diaOk) {
        ConfiancaSugestao base;
        if (proximidade >= 0.95) {
            base = ConfiancaSugestao.ALTA;
        } else if (proximidade >= 0.90) {
            base = ConfiancaSugestao.MEDIA;
        } else {
            base = ConfiancaSugestao.BAIXA;
        }
        if ((nomeOk || diaOk) && base != ConfiancaSugestao.ALTA) {
            base = base == ConfiancaSugestao.BAIXA ? ConfiancaSugestao.MEDIA : ConfiancaSugestao.ALTA;
        }
        return base;
    }

    private record SugestaoPapel(PapelReconciliacao papel, ConfiancaSugestao confianca) {}

    // ----------------------------------------------------------------------------------------- (C)

    /**
     * Confirma vínculos (caso a caso ou em lote). Idempotente por (contrato, lançamento, papel).
     * Quando o lançamento é órfão (sem processo), ADOTA: classifica em conta A + cliente + processo
     * do imóvel e recalcula a etapa. Recusa lançamentos que já pertençam a OUTRO processo.
     */
    @Transactional
    public List<ReconciliacaoVinculoResponse> vincular(Long contratoId, ReconciliacaoVincularRequest request) {
        ContratoLocacaoEntity contrato = requireContrato(contratoId);
        Long processoImovelId = processoIdDoContrato(contrato);

        // Pré-validação atômica: nenhuma escrita antes de garantir que todos os itens são aceitáveis.
        List<LancamentoFinanceiroEntity> lancamentos = new ArrayList<>();
        for (ReconciliacaoVincularRequest.Item item : request.vinculos()) {
            LancamentoFinanceiroEntity lancamento = lancamentoRepository
                    .findById(item.lancamentoFinanceiroId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Lançamento financeiro não encontrado: " + item.lancamentoFinanceiroId()));
            Long processoLanc = lancamento.getProcesso() != null ? lancamento.getProcesso().getId() : null;
            if (processoLanc != null && !processoLanc.equals(processoImovelId)) {
                throw new BusinessRuleException(
                        "Lançamento " + lancamento.getId() + " já pertence ao processo " + processoLanc
                                + " — não será reclassificado para o imóvel automaticamente.");
            }
            if (processoLanc == null && processoImovelId == null) {
                throw new BusinessRuleException(
                        "Imóvel sem processo vinculado: não é possível adotar o lançamento "
                                + lancamento.getId() + ".");
            }
            lancamentos.add(lancamento);
        }

        List<ReconciliacaoVinculoResponse> saida = new ArrayList<>();
        for (int i = 0; i < request.vinculos().size(); i++) {
            ReconciliacaoVincularRequest.Item item = request.vinculos().get(i);
            LancamentoFinanceiroEntity lancamento = lancamentos.get(i);

            boolean adotado = lancamento.getProcesso() == null;
            if (adotado) {
                adotarLancamento(lancamento, contrato);
            }

            LocacaoRepasseLancamentoEntity entity =
                    criarVinculoComGatilho(contrato, lancamento, item.papel(), item.competenciaMes(), null);
            saida.add(toVinculoResponse(entity, adotado));
        }
        return saida;
    }

    /**
     * Ponto ÚNICO de criação de vínculo: upsert por (contrato, lançamento, papel). Usado por
     * {@link #vincular} e pela convergência do "Aprovar" ({@link #registrarAluguelClassificado}).
     * O repasse interno (imóvel próprio) NÃO é gerado aqui — use {@link #gerarRepassesInternosContrato}.
     */
    private LocacaoRepasseLancamentoEntity criarVinculoComGatilho(
            ContratoLocacaoEntity contrato, LancamentoFinanceiroEntity lancamento,
            PapelReconciliacao papel, String competenciaMes) {
        return criarVinculoComGatilho(contrato, lancamento, papel, competenciaMes, null);
    }

    private LocacaoRepasseLancamentoEntity criarVinculoComGatilho(
            ContratoLocacaoEntity contrato, LancamentoFinanceiroEntity lancamento,
            PapelReconciliacao papel, String competenciaMes, String origemVinculo) {
        Optional<LocacaoRepasseLancamentoEntity> existente = vinculoRepository
                .findByContratoLocacao_IdAndLancamentoFinanceiro_IdAndPapel(
                        contrato.getId(), lancamento.getId(), papel);
        if (existente.isPresent()) {
            return existente.get();
        }

        LocacaoRepasseLancamentoEntity entity = new LocacaoRepasseLancamentoEntity();
        entity.setContratoLocacao(contrato);
        entity.setLancamentoFinanceiro(lancamento);
        entity.setPapel(papel);
        entity.setCompetenciaMes(trimToNull(competenciaMes));
        // valor do vínculo é sempre não-nulo: financeiro_lancamento.valor é NOT NULL (DB + entity), e
        // o repasse interno só grava após repasse.signum() > 0. Invariante garantido pelo app (V119).
        if (lancamento.getValor() == null) {
            throw new BusinessRuleException("Lançamento sem valor não pode ser vinculado.");
        }
        entity.setValor(lancamento.getValor().abs());
        if (StringUtils.hasText(origemVinculo)) {
            entity.setOrigem(origemVinculo.trim());
        }

        entity = vinculoRepository.save(entity);
        return entity;
    }

    /**
     * Convergência do "Aprovar" (sugestão geral) para o MESMO motor da reconciliação. Quando o
     * "Aprovar" classifica um CRÉDITO num processo com contrato de locação VIGENTE e |valor| ≈
     * aluguel (±10% ou ±R$50) e ainda NÃO há vínculo para o lançamento, cria idempotentemente o
     * vínculo {@code papel=ALUGUEL} (competência = ano-mês do {@code data_lancamento}) e dispara o
     * repasse interno. Fora desses casos, não faz nada (comporta-se como hoje).
     *
     * <p>A competência é apenas o palpite pelo mês do pagamento; a tela de reconciliação continua
     * sendo a superfície de correção (reatribuir competência / desvincular).
     */
    @Transactional
    public void registrarAluguelClassificado(LancamentoFinanceiroEntity lancamento) {
        if (lancamento == null || lancamento.getNatureza() != NaturezaLancamento.CREDITO) {
            return; // (a) só crédito
        }
        ProcessoEntity processo = lancamento.getProcesso();
        if (processo == null) {
            return;
        }
        ContratoLocacaoEntity contrato = contratoVigenteDoProcesso(processo.getId());
        if (contrato == null) {
            return; // (b) processo precisa de contrato de locação VIGENTE
        }
        if (!valorNaFaixaDoAluguel(lancamento.getValor(), contrato.getValorAluguel())) {
            return; // (c) valor fora da faixa do aluguel
        }
        if (jaExisteVinculo(contrato.getId(), lancamento.getId())) {
            return; // (d) idempotência: já existe vínculo para este lançamento
        }
        String competencia = lancamento.getDataLancamento() != null
                ? YearMonth.from(lancamento.getDataLancamento()).toString()
                : null;
        criarVinculoComGatilho(contrato, lancamento, PapelReconciliacao.ALUGUEL, competencia);
        log.info("[reconciliacao-imovel] APROVAR->ALUGUEL lancamento={} contrato={} competencia={}",
                lancamento.getId(), contrato.getId(), competencia);
    }

    private ContratoLocacaoEntity contratoVigenteDoProcesso(Long processoId) {
        for (ContratoLocacaoEntity c : contratoLocacaoRepository.findByImovelProcessoId(processoId)) {
            if ("VIGENTE".equalsIgnoreCase(c.getStatus())) {
                return c;
            }
        }
        return null;
    }

    private boolean jaExisteVinculo(Long contratoId, Long lancamentoId) {
        return !vinculoRepository
                .findByContratoLocacao_IdAndLancamentoFinanceiro_IdIn(contratoId, List.of(lancamentoId))
                .isEmpty();
    }

    /** Faixa do aluguel para reconhecimento automático: dentro de ±10% OU ±R$50 (o maior). */
    private static boolean valorNaFaixaDoAluguel(BigDecimal valor, BigDecimal aluguel) {
        if (valor == null || aluguel == null || aluguel.signum() == 0) {
            return false;
        }
        BigDecimal diff = valor.abs().subtract(aluguel.abs()).abs();
        BigDecimal limite = aluguel.abs().multiply(new BigDecimal("0.10")).max(new BigDecimal("50"));
        return diff.compareTo(limite) <= 0;
    }

    /**
     * Créditos Cora candidatos na faixa do aluguel, sem classificar (read-only).
     * Fonte do grupo CONCILIAR em Ações do Dia e da auto-conciliação inequívoca.
     */
    @Transactional(readOnly = true)
    public List<CreditoCandidatoAluguelItem> creditosCandidatosAluguelSemClassificar(
            Long contratoId, String competenciaParam) {
        ContratoLocacaoEntity contrato = requireContrato(contratoId);
        YearMonth ym = StringUtils.hasText(competenciaParam)
                ? parseCompetencia(competenciaParam.trim())
                : YearMonth.now();
        Long processoId = processoIdDoContrato(contrato);
        if (processoId == null) {
            return List.of();
        }
        LocalDate inicio = ym.atDay(1);
        LocalDate fim = ym.atEndOfMonth();
        return creditosNaFaixaDoAluguel(contrato, processoId, inicio, fim).stream()
                .map(this::toCreditoCandidatoItem)
                .toList();
    }

    private List<LancamentoFinanceiroEntity> creditosNaFaixaDoAluguel(
            ContratoLocacaoEntity contrato, Long processoId, LocalDate inicio, LocalDate fim) {
        return creditosCandidatos(contrato, processoId, inicio, fim).stream()
                .filter(l -> valorNaFaixaDoAluguel(l.getValor(), contrato.getValorAluguel()))
                .toList();
    }

    private CreditoCandidatoAluguelItem toCreditoCandidatoItem(LancamentoFinanceiroEntity l) {
        String descricao = null;
        if (StringUtils.hasText(l.getDescricaoNorm())) {
            descricao = l.getDescricaoNorm().trim();
        } else if (StringUtils.hasText(l.getDescricao())) {
            descricao = l.getDescricao().trim();
        }
        return new CreditoCandidatoAluguelItem(
                l.getId(), l.getDataLancamento(), l.getValor() != null ? l.getValor().abs() : null, descricao);
    }

    /**
     * Auto-concilia créditos Cora inequívocos como {@code papel=ALUGUEL} ({@code origem=AUTO}).
     * Idempotente: não duplica vínculos existentes nem altera vínculos manuais.
     */
    @Transactional
    public ConciliarAlugueisAutomaticoResponse conciliarAlugueisAutomatico(String competenciaParam) {
        YearMonth ym = StringUtils.hasText(competenciaParam)
                ? parseCompetencia(competenciaParam.trim())
                : YearMonth.now();
        String competencia = ym.toString();
        LocalDate inicio = ym.atDay(1);
        LocalDate fim = ym.atEndOfMonth();

        ConciliarAlugueisAutomaticoResponse resp = new ConciliarAlugueisAutomaticoResponse();
        resp.setCompetencia(competencia);

        List<ContratoLocacaoEntity> pendentes =
                contratoLocacaoRepository.findVigentesSemAluguelNaCompetencia(competencia, inicio, fim);

        Map<Long, List<ContratoLocacaoEntity>> porProcesso = new HashMap<>();
        for (ContratoLocacaoEntity contrato : pendentes) {
            Long processoId = processoIdDoContrato(contrato);
            if (processoId == null) {
                resp.getSemCredito()
                        .add(semCreditoItem(contrato));
                continue;
            }
            porProcesso.computeIfAbsent(processoId, k -> new ArrayList<>()).add(contrato);
        }

        Set<Long> processosMultiContrato = new HashSet<>();
        for (Map.Entry<Long, List<ContratoLocacaoEntity>> e : porProcesso.entrySet()) {
            if (e.getValue().size() > 1) {
                processosMultiContrato.add(e.getKey());
                for (ContratoLocacaoEntity c : e.getValue()) {
                    resp.getParaRevisao()
                            .add(paraRevisaoItem(c, "MULTIPLOS_CONTRATOS_VIGENTES", creditosCandidatos(c, e.getKey(), inicio, fim).size()));
                }
            }
        }

        for (ContratoLocacaoEntity contrato : pendentes) {
            Long processoId = processoIdDoContrato(contrato);
            if (processoId == null || processosMultiContrato.contains(processoId)) {
                continue;
            }

            List<LancamentoFinanceiroEntity> creditos =
                    creditosCandidatos(contrato, processoId, inicio, fim);
            List<LancamentoFinanceiroEntity> naFaixa = creditosNaFaixaDoAluguel(contrato, processoId, inicio, fim);

            if (naFaixa.size() == 1) {
                LancamentoFinanceiroEntity credito = naFaixa.get(0);
                LocacaoRepasseLancamentoEntity vinculo = criarVinculoComGatilho(
                        contrato, credito, PapelReconciliacao.ALUGUEL, competencia, ORIGEM_VINCULO_AUTO);
                resp.setAutoVinculados(resp.getAutoVinculados() + 1);
                resp.getAutoVinculadosDetalhes()
                        .add(new ConciliarAlugueisAutomaticoResponse.AutoVinculadoItem(
                                contrato.getId(),
                                vinculo.getId(),
                                credito.getId(),
                                numeroPlanilha(contrato),
                                contrato.getValorAluguel(),
                                credito.getDataLancamento(),
                                credito.getValor()));
                log.info(
                        "[reconciliacao-imovel] AUTO-ALUGUEL contrato={} lancamento={} competencia={} vinculo={}",
                        contrato.getId(),
                        credito.getId(),
                        competencia,
                        vinculo.getId());
            } else if (creditos.isEmpty()) {
                resp.getSemCredito().add(semCreditoItem(contrato));
            } else if (naFaixa.isEmpty()) {
                resp.getParaRevisao()
                        .add(paraRevisaoItem(contrato, "VALOR_FORA_FAIXA", creditos.size()));
            } else {
                resp.getParaRevisao()
                        .add(paraRevisaoItem(contrato, "MULTIPLOS_CREDITOS_NA_FAIXA", naFaixa.size()));
            }
        }

        return resp;
    }

    private List<LancamentoFinanceiroEntity> creditosCandidatos(
            ContratoLocacaoEntity contrato, Long processoId, LocalDate inicio, LocalDate fim) {
        return lancamentoRepository.findCreditosCoraSemVinculoAluguelNoContrato(
                NUMERO_BANCO_CORA, processoId, contrato.getId(), inicio, fim);
    }

    private static ConciliarAlugueisAutomaticoResponse.SemCreditoItem semCreditoItem(ContratoLocacaoEntity contrato) {
        return new ConciliarAlugueisAutomaticoResponse.SemCreditoItem(
                contrato.getId(), numeroPlanilha(contrato), contrato.getValorAluguel());
    }

    private static ConciliarAlugueisAutomaticoResponse.ParaRevisaoItem paraRevisaoItem(
            ContratoLocacaoEntity contrato, String motivo, int quantidadeCreditosCandidatos) {
        return new ConciliarAlugueisAutomaticoResponse.ParaRevisaoItem(
                contrato.getId(),
                numeroPlanilha(contrato),
                contrato.getValorAluguel(),
                motivo,
                quantidadeCreditosCandidatos);
    }

    private static Integer numeroPlanilha(ContratoLocacaoEntity contrato) {
        ImovelEntity imovel = contrato != null ? contrato.getImovel() : null;
        return imovel != null ? imovel.getNumeroPlanilha() : null;
    }

    /**
     * Backfill: para um contrato de imóvel próprio, vincula como ALUGUEL os créditos do processo que
     * batem com o valor do aluguel e dispara a geração do par de repasse interno — pelo MESMO caminho
     * de produção ({@link #vincular}). Idempotente: re-rodar não duplica vínculos nem lançamentos.
     *
     * @return número de créditos vinculados como ALUGUEL (e portanto com par de repasse gerado).
     */
    @Transactional
    public int backfillRepasseInternoContrato(Long contratoId) {
        ContratoLocacaoEntity contrato = requireContrato(contratoId);
        if (!isImovelProprio(contrato)) {
            log.info("[reconciliacao-imovel] backfill ignorado: contrato={} não é imóvel próprio.", contratoId);
            return 0;
        }
        Long processoId = processoIdDoContrato(contrato);
        if (processoId == null) {
            log.info("[reconciliacao-imovel] backfill ignorado: contrato={} sem processo.", contratoId);
            return 0;
        }

        List<ReconciliacaoVincularRequest.Item> itens = new ArrayList<>();
        for (LancamentoFinanceiroEntity l : lancamentoRepository.findByProcessoId(processoId)) {
            if (l.getNatureza() != NaturezaLancamento.CREDITO || l.getValor() == null) {
                continue;
            }
            if (!valorProximo(l.getValor().abs(), contrato.getValorAluguel())) {
                continue; // só os créditos que correspondem ao aluguel
            }
            String competencia = l.getDataLancamento() != null
                    ? YearMonth.from(l.getDataLancamento()).toString()
                    : null;
            itens.add(new ReconciliacaoVincularRequest.Item(
                    l.getId(), PapelReconciliacao.ALUGUEL, competencia));
        }
        if (itens.isEmpty()) {
            log.info("[reconciliacao-imovel] backfill: contrato={} sem créditos de aluguel a vincular.", contratoId);
            return 0;
        }
        vincular(contratoId, new ReconciliacaoVincularRequest(itens));
        log.info("[reconciliacao-imovel] backfill concluído: contrato={} aluguéis vinculados={}", contratoId, itens.size());
        return itens.size();
    }

    /**
     * Corrige dados de repasse interno já gravados pelo modelo antigo (par débito/crédito, datado em
     * 01/MM), de forma IDEMPOTENTE: só remove/regenera o débito de repasse de um vínculo de ALUGUEL
     * quando está ERRADO ou AUSENTE. Errado = qualquer um de: tem crédito na conta I, {@code data_lancamento}
     * ≠ data do aluguel, {@code grupo_compensacao} preenchido, {@code etapa} ≠ VINCULADO,
     * {@code valor} ≠ repasseEsperado. Se já está correto (só débito conta A, data = data do aluguel,
     * vínculo REPASSE, sem crédito, sem grupo) → NO-OP: não toca, não troca id.
     *
     * @return número de débitos de repasse criados/regenerados (NO-OP não conta).
     */
    @Transactional
    public int corrigirRepasseInternoContrato(Long contratoId) {
        ContratoLocacaoEntity contrato = requireContrato(contratoId);
        if (!isImovelProprio(contrato)) {
            log.info("[reconciliacao-imovel] correção ignorada: contrato={} não é imóvel próprio.", contratoId);
            return 0;
        }
        Long processoId = processoIdDoContrato(contrato);
        if (processoId == null) {
            return 0;
        }

        List<LocacaoRepasseLancamentoEntity> alugueis =
                vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(contratoId).stream()
                        .filter(v -> v.getPapel() == PapelReconciliacao.ALUGUEL)
                        .toList();
        // Débitos esperados = lançamento de cada vínculo REPASSE ligado por FK real (V115) a um
        // ALUGUEL deste contrato. Créditos de contrapartida têm numero_lancamento AUTO-REP-{id}-C.
        Set<Long> lancamentosEsperados = new java.util.HashSet<>();
        for (LocacaoRepasseLancamentoEntity a : alugueis) {
            vinculoRepository.findByOrigemAluguelVinculo_IdAndPapel(a.getId(), PapelReconciliacao.REPASSE)
                    .map(LocacaoRepasseLancamentoEntity::getLancamentoFinanceiro)
                    .ifPresent(debito -> {
                        lancamentosEsperados.add(debito.getId());
                        lancamentoRepository
                                .findByNumeroLancamento(numeroCreditoRepasseInterno(a.getId()))
                                .ifPresent(c -> lancamentosEsperados.add(c.getId()));
                    });
        }

        // 1) Remove APENAS lançamentos AUTO (banco virtual) indesejados: órfãos ou modelo antigo
        //    (só débito sem crédito / sem grupo). Os pares esperados são tratados no passo 2.
        Integer numeroBancoVirtual = contaRepasseInterno().getNumeroBanco();
        List<LancamentoFinanceiroEntity> autosIndesejados =
                lancamentoRepository.findByProcessoId(processoId).stream()
                        .filter(l -> ORIGEM_AUTO.equals(l.getOrigem())
                                && numeroBancoVirtual.equals(l.getNumeroBanco()))
                        .filter(l -> !lancamentosEsperados.contains(l.getId()))
                        .toList();
        int removidosIndesejados = removerLancamentosComVinculos(contratoId, autosIndesejados);

        // 2) Garante o débito correto de cada ALUGUEL: NO-OP se já está certo (mantém o id);
        //    remove+regenera só quando errado; gera quando ausente.
        int corrigidos = 0;
        for (LocacaoRepasseLancamentoEntity aluguel : alugueis) {
            if (garantirDebitoRepasseCorreto(contrato, contratoId, aluguel)) {
                corrigidos++;
            }
        }
        log.info("[reconciliacao-imovel] correção concluída: contrato={} AUTO indesejados removidos={} débitos corrigidos/criados={}",
                contratoId, removidosIndesejados, corrigidos);
        return corrigidos;
    }

    /**
     * Gera repasses internos (par débito + crédito na conta virtual 900) para vínculos de ALUGUEL
     * ainda sem REPASSE. Disparo manual (botão na tela). Idempotente por vínculo de ALUGUEL.
     *
     * @param competencia opcional (AAAA-MM); {@code null} = todas as competências com ALUGUEL pendente
     */
    @Transactional
    public GerarRepassesInternosResponse gerarRepassesInternosContrato(Long contratoId, String competencia) {
        ContratoLocacaoEntity contrato = requireContrato(contratoId);
        if (!isImovelProprio(contrato)) {
            throw new BusinessRuleException(
                    "Repasse interno só se aplica a imóveis de clientes próprios (cliente.proprio).");
        }
        String competenciaFiltro = StringUtils.hasText(competencia) ? parseCompetencia(competencia).toString() : null;

        List<LocacaoRepasseLancamentoEntity> alugueis =
                vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(contratoId).stream()
                        .filter(v -> v.getPapel() == PapelReconciliacao.ALUGUEL)
                        .filter(v -> competenciaFiltro == null
                                || competenciaFiltro.equals(chaveCompetencia(v.getCompetenciaMes())))
                        .toList();

        int gerados = 0;
        int jaExistentes = 0;
        int semRepasse = 0;
        for (LocacaoRepasseLancamentoEntity aluguel : alugueis) {
            Optional<LocacaoRepasseLancamentoEntity> repasseOpt =
                    vinculoRepository.findByOrigemAluguelVinculo_IdAndPapel(aluguel.getId(), PapelReconciliacao.REPASSE);
            if (repasseOpt.isPresent()) {
                jaExistentes++;
                sincronizarCompetenciaParRepasseInterno(aluguel, repasseOpt.get().getLancamentoFinanceiro());
                continue;
            }
            BigDecimal repasse = repasseEsperadoDoAluguel(contrato, aluguel);
            if (repasse.signum() <= 0) {
                continue;
            }
            semRepasse++;
            gerarParRepasseInterno(aluguel, contrato);
            gerados++;
        }

        log.info("[reconciliacao-imovel] gerar-repasses-internos contrato={} competencia={} gerados={} jaExistentes={}",
                contratoId, competenciaFiltro, gerados, jaExistentes);
        return new GerarRepassesInternosResponse(contratoId, competenciaFiltro, gerados, jaExistentes, semRepasse);
    }

    /**
     * Checklist mês a mês: aluguel já vinculado ou créditos candidatos na competência.
     * Usado pela tela de classificação de aluguéis (substitui navegação competência a competência).
     */
    @Transactional(readOnly = true)
    public MatrizCompetenciasResponse matrizCompetencias(Long contratoId, Integer mesesParam) {
        ContratoLocacaoEntity contrato = requireContrato(contratoId);
        int meses = mesesParam != null && mesesParam > 0 ? Math.min(mesesParam, 36) : 18;

        YearMonth ate = YearMonth.now();
        YearMonth de = ate.minusMonths(meses - 1L);
        if (contrato.getDataInicio() != null) {
            YearMonth ci = YearMonth.from(contrato.getDataInicio());
            if (ci.isAfter(de)) {
                de = ci;
            }
        }
        if (contrato.getDataFim() != null) {
            YearMonth cf = YearMonth.from(contrato.getDataFim());
            if (cf.isBefore(ate)) {
                ate = cf;
            }
        }

        BigDecimal taxaEsperada = taxaEsperadaPercent(contrato);
        List<LocacaoRepasseLancamentoEntity> todosVinculos =
                vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(contratoId);

        Map<String, List<LocacaoRepasseLancamentoEntity>> porCompetencia = new HashMap<>();
        for (LocacaoRepasseLancamentoEntity v : todosVinculos) {
            porCompetencia.computeIfAbsent(chaveCompetencia(v.getCompetenciaMes()), k -> new ArrayList<>()).add(v);
        }

        List<MatrizCompetenciaItemResponse> itens = new ArrayList<>();
        for (YearMonth ym = ate; !ym.isBefore(de); ym = ym.minusMonths(1)) {
            String comp = ym.toString();
            List<LocacaoRepasseLancamentoEntity> vincComp = porCompetencia.getOrDefault(comp, List.of());

            Optional<LocacaoRepasseLancamentoEntity> aluguelV = vincComp.stream()
                    .filter(v -> v.getPapel() == PapelReconciliacao.ALUGUEL)
                    .findFirst();

            ReconciliacaoResultadoCompetenciaResponse resComp = calcularCompetencia(comp, vincComp, taxaEsperada);

            if (aluguelV.isPresent()) {
                LancamentoFinanceiroEntity l = aluguelV.get().getLancamentoFinanceiro();
                itens.add(new MatrizCompetenciaItemResponse(
                        comp,
                        "VINCULADO",
                        toAluguelVinculadoMatriz(aluguelV.get(), l),
                        List.of(),
                        resComp.aluguelRecebido(),
                        resComp.statusRepasse()));
            } else {
                List<MatrizCompetenciaCandidatoResponse> candidatos =
                        sugerir(contratoId, comp).stream()
                                .filter(s -> !s.jaVinculado())
                                .filter(s -> s.natureza() != null
                                        && NaturezaLancamento.CREDITO.name().equalsIgnoreCase(s.natureza()))
                                .filter(s -> s.papelSugerido() == PapelReconciliacao.ALUGUEL)
                                .map(this::toCandidatoMatriz)
                                .toList();
                String estado = candidatos.isEmpty()
                        ? "SEM_CANDIDATO"
                        : candidatos.size() == 1 ? "CANDIDATO_UNICO" : "CANDIDATOS_MULTIPLOS";
                itens.add(new MatrizCompetenciaItemResponse(
                        comp,
                        estado,
                        null,
                        candidatos,
                        BigDecimal.ZERO,
                        StatusRepasse.PENDENTE));
            }
        }

        return new MatrizCompetenciasResponse(
                contratoId,
                contrato.getValorAluguel(),
                contrato.getDiaVencimentoAluguel(),
                isImovelProprio(contrato),
                de.toString(),
                ate.toString(),
                itens);
    }

    /** Todos os vínculos do contrato (para extrato: ref. mês por lançamento). */
    @Transactional(readOnly = true)
    public List<ReconciliacaoVinculoResponse> listarVinculosContrato(Long contratoId) {
        requireContrato(contratoId);
        return vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(contratoId).stream()
                .map(v -> toVinculoResponse(v, false))
                .toList();
    }

    private MatrizCompetenciaAluguelVinculadoResponse toAluguelVinculadoMatriz(
            LocacaoRepasseLancamentoEntity vinculo, LancamentoFinanceiroEntity lancamento) {
        return new MatrizCompetenciaAluguelVinculadoResponse(
                vinculo.getId(),
                lancamento != null ? lancamento.getId() : null,
                lancamento != null ? lancamento.getDataLancamento() : null,
                lancamento != null ? lancamento.getDescricao() : null,
                lancamento != null && lancamento.getValor() != null ? lancamento.getValor().abs() : null);
    }

    private MatrizCompetenciaCandidatoResponse toCandidatoMatriz(ReconciliacaoSugestaoItemResponse s) {
        return new MatrizCompetenciaCandidatoResponse(
                s.lancamentoFinanceiroId(),
                s.data(),
                s.descricao(),
                s.valor() != null ? s.valor().abs() : null,
                s.confianca(),
                s.origem(),
                s.classificaAoConfirmar());
    }

    /**
     * Garante o débito de repasse correto para um vínculo de ALUGUEL. NO-OP (retorna {@code false}) se o
     * débito já está correto — preserva o id. Remove+regenera se errado; gera se ausente (retorna {@code true}).
     */
    private boolean garantirDebitoRepasseCorreto(
            ContratoLocacaoEntity contrato, Long contratoId, LocacaoRepasseLancamentoEntity aluguel) {
        // Acha o REPASSE pela FK real (V115), não pela string numero_lancamento.
        Optional<LocacaoRepasseLancamentoEntity> repasseOpt =
                vinculoRepository.findByOrigemAluguelVinculo_IdAndPapel(aluguel.getId(), PapelReconciliacao.REPASSE);
        BigDecimal repasseEsperado = repasseEsperadoDoAluguel(contrato, aluguel);
        LocalDate dataEsperada = dataLancamentoDoAluguel(aluguel);

        if (repasseOpt.isPresent()) {
            LancamentoFinanceiroEntity debito = repasseOpt.get().getLancamentoFinanceiro();
            if (parRepasseInternoCorreto(debito, aluguel.getId(), repasseEsperado, dataEsperada)) {
                return false; // já correto → NO-OP, não troca id
            }
            // errado → remove o par (vínculo REPASSE + débito) para regenerar
            removerRepasseInterno(contratoId, aluguel.getId());
        }
        gerarParRepasseInterno(aluguel, contrato); // ausente/removido → gera o par correto
        return true;
    }

    /** Par de repasse correto: débito + crédito na conta virtual, mesmo grupo, data = data do aluguel. */
    private boolean parRepasseInternoCorreto(
            LancamentoFinanceiroEntity debito,
            Long aluguelVinculoId,
            BigDecimal repasseEsperado,
            LocalDate dataEsperada) {
        if (debito == null || !debitoRepasseCorreto(debito, aluguelVinculoId, repasseEsperado, dataEsperada)) {
            return false;
        }
        Optional<LancamentoFinanceiroEntity> creditoOpt =
                lancamentoRepository.findByNumeroLancamento(numeroCreditoRepasseInterno(aluguelVinculoId));
        if (creditoOpt.isEmpty()) {
            return false;
        }
        LancamentoFinanceiroEntity credito = creditoOpt.get();
        return credito.getNatureza() == NaturezaLancamento.CREDITO
                && credito.getValor() != null
                && credito.getValor().compareTo(repasseEsperado) == 0
                && dataEsperada != null
                && dataEsperada.equals(credito.getDataLancamento())
                && grupoRepasseInterno(aluguelVinculoId).equals(credito.getGrupoCompensacao());
    }

    /** Um débito de repasse está correto se: DEBITO conta A, banco virtual, data = aluguel, grupo pareado, valor ok. */
    private boolean debitoRepasseCorreto(
            LancamentoFinanceiroEntity debito,
            Long aluguelVinculoId,
            BigDecimal repasseEsperado,
            LocalDate dataEsperada) {
        return debito.getNatureza() == NaturezaLancamento.DEBITO
                && debito.getContaContabil() != null
                && CODIGO_CONTA_ADMINISTRACAO.equalsIgnoreCase(debito.getContaContabil().getCodigo())
                && dataEsperada != null && dataEsperada.equals(debito.getDataLancamento())
                && grupoRepasseInterno(aluguelVinculoId).equals(debito.getGrupoCompensacao())
                && debito.getEtapa() == EtapaLancamento.VINCULADO
                && debito.getValor() != null && debito.getValor().compareTo(repasseEsperado) == 0;
    }

    /** Remove lançamentos e seus vínculos no contrato; retorna a quantidade removida. */
    private int removerLancamentosComVinculos(Long contratoId, List<LancamentoFinanceiroEntity> lancamentos) {
        if (lancamentos.isEmpty()) {
            return 0;
        }
        List<Long> ids = lancamentos.stream().map(LancamentoFinanceiroEntity::getId).toList();
        List<LocacaoRepasseLancamentoEntity> vinc =
                vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdIn(contratoId, ids);
        if (!vinc.isEmpty()) {
            vinculoRepository.deleteAll(vinc);
            vinculoRepository.flush();
        }
        lancamentoRepository.deleteAll(lancamentos);
        lancamentoRepository.flush();
        log.info("[reconciliacao-imovel] correção: contrato={} lançamentos AUTO removidos={}", contratoId, ids);
        return ids.size();
    }

    /** repasseEsperado = aluguel − aluguel×taxa − despesas da competência (o mesmo do /resultado). */
    private BigDecimal repasseEsperadoDoAluguel(
            ContratoLocacaoEntity contrato, LocacaoRepasseLancamentoEntity aluguelVinculo) {
        BigDecimal aluguel = aluguelVinculo.getValor() != null ? aluguelVinculo.getValor().abs() : null;
        if (aluguel == null || aluguel.signum() <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal taxa = taxaEsperadaPercent(contrato);
        BigDecimal despesas = despesasDaCompetencia(contrato.getId(), aluguelVinculo.getCompetenciaMes());
        return repasseEsperadoPorTaxa(aluguel, taxa).subtract(despesas).setScale(2, RoundingMode.HALF_UP);
    }

    /** data_lancamento do repasse = data real do recebimento do aluguel (nunca 01/MM). */
    private LocalDate dataLancamentoDoAluguel(LocacaoRepasseLancamentoEntity aluguelVinculo) {
        LancamentoFinanceiroEntity aluguelLanc = aluguelVinculo.getLancamentoFinanceiro();
        return aluguelLanc != null && aluguelLanc.getDataLancamento() != null
                ? aluguelLanc.getDataLancamento()
                : competenciaParaData(aluguelVinculo.getCompetenciaMes(), null);
    }

    /** Adota um lançamento órfão: conta A + cliente + processo do imóvel, recalculando a etapa. Auditado. */
    private void adotarLancamento(LancamentoFinanceiroEntity lancamento, ContratoLocacaoEntity contrato) {
        ContaContabilEntity contaA = contaAdministracao();
        ClienteEntity cliente = clienteDoImovel(contrato);
        ProcessoEntity processo = processoAtivoDoContrato(contrato);
        if (cliente == null || processo == null) {
            throw new BusinessRuleException(
                    "Imóvel sem cliente/processo definidos: não é possível adotar o lançamento "
                            + lancamento.getId() + ".");
        }

        Long contaAntiga = lancamento.getContaContabil() != null ? lancamento.getContaContabil().getId() : null;
        lancamento.setContaContabil(contaA);
        lancamento.setClienteEntidade(cliente);
        lancamento.setProcesso(processo);
        lancamento.setEtapa(EtapaLancamento.calcular(
                contaA.getCodigo(), lancamento.getGrupoCompensacao(), cliente.getId()));
        lancamentoRepository.save(lancamento);

        log.info("[reconciliacao-imovel] ADOCAO lancamento={} contaContabil {}->{} (A) cliente_id={} processo_id={} etapa={}",
                lancamento.getId(), contaAntiga, contaA.getId(), cliente.getId(), processo.getId(), lancamento.getEtapa());
    }

    private ContaContabilEntity contaAdministracao() {
        return contaContabilRepository.findFirstByCodigoIgnoreCase(CODIGO_CONTA_ADMINISTRACAO)
                .or(() -> contaContabilRepository.findById(1L))
                .orElseThrow(() -> new BusinessRuleException(
                        "Conta contábil de administração (A) não encontrada."));
    }

    /** Desfaz um vínculo específico do contrato. */
    @Transactional
    public void desvincular(Long contratoId, Long vinculoId) {
        LocacaoRepasseLancamentoEntity entity = vinculoRepository
                .findById(vinculoId)
                .orElseThrow(() -> new ResourceNotFoundException("Vínculo não encontrado: " + vinculoId));
        if (!entity.getContratoLocacao().getId().equals(contratoId)) {
            throw new BusinessRuleException("Vínculo não pertence ao contrato informado.");
        }
        // Reversibilidade: ao desvincular o ALUGUEL, remove o par de repasse interno gerado por ele.
        if (entity.getPapel() == PapelReconciliacao.ALUGUEL) {
            removerRepasseInterno(contratoId, entity.getId());
        }
        vinculoRepository.delete(entity);
    }

    // --------------------------------------------------------------------- repasse interno (imóvel próprio)

    /**
     * Gera o par de repasse interno (débito + crédito na conta virtual 900) para um vínculo de
     * ALUGUEL em imóvel próprio (idempotente).
     *
     * <p>O débito é vinculado como {@code papel=REPASSE}. O crédito é a contrapartida no extrato
     * virtual (mesmo {@code grupo_compensacao}, soma zero na conta 900).
     */
    private void gerarParRepasseInterno(LocacaoRepasseLancamentoEntity aluguelVinculo, ContratoLocacaoEntity contrato) {
        if (!isImovelProprio(contrato)) {
            return;
        }
        Optional<LocacaoRepasseLancamentoEntity> repasseExistente =
                vinculoRepository.findByOrigemAluguelVinculo_IdAndPapel(aluguelVinculo.getId(), PapelReconciliacao.REPASSE);
        if (repasseExistente.isPresent()) {
            sincronizarCompetenciaParRepasseInterno(aluguelVinculo, repasseExistente.get().getLancamentoFinanceiro());
            return;
        }

        BigDecimal repasse = repasseEsperadoDoAluguel(contrato, aluguelVinculo);
        if (repasse.signum() <= 0) {
            return;
        }

        ClienteEntity cliente = clienteDoImovel(contrato);
        ProcessoEntity processo = processoAtivoDoContrato(contrato);
        LocalDate dataLancamento = dataLancamentoDoAluguel(aluguelVinculo);
        LocalDate dataCompetencia = competenciaParaData(aluguelVinculo.getCompetenciaMes(), dataLancamento);
        String compLabel = StringUtils.hasText(aluguelVinculo.getCompetenciaMes()) ? aluguelVinculo.getCompetenciaMes() : "";
        String grupo = grupoRepasseInterno(aluguelVinculo.getId());
        Long clienteId = cliente != null ? cliente.getId() : null;

        LancamentoFinanceiroEntity debito = novoLancamentoRepasseInterno(
                NaturezaLancamento.DEBITO,
                repasse, cliente, processo, dataLancamento, dataCompetencia,
                ("Repasse interno (imóvel próprio) " + compLabel).trim(),
                numeroDebitoRepasseInterno(aluguelVinculo.getId()),
                grupo,
                EtapaLancamento.VINCULADO);
        lancamentoRepository.save(debito);

        LancamentoFinanceiroEntity credito = novoLancamentoRepasseInterno(
                NaturezaLancamento.CREDITO,
                repasse, cliente, processo, dataLancamento, dataCompetencia,
                ("Contrapartida repasse interno " + compLabel).trim(),
                numeroCreditoRepasseInterno(aluguelVinculo.getId()),
                grupo,
                EtapaLancamento.calcular(CODIGO_CONTA_ADMINISTRACAO, grupo, clienteId));
        lancamentoRepository.save(credito);

        LocacaoRepasseLancamentoEntity repasseVinculo = new LocacaoRepasseLancamentoEntity();
        repasseVinculo.setContratoLocacao(contrato);
        repasseVinculo.setLancamentoFinanceiro(debito);
        repasseVinculo.setPapel(PapelReconciliacao.REPASSE);
        repasseVinculo.setCompetenciaMes(aluguelVinculo.getCompetenciaMes());
        repasseVinculo.setValor(repasse);
        repasseVinculo.setOrigemAluguelVinculo(aluguelVinculo);
        vinculoRepository.save(repasseVinculo);

        log.info("[reconciliacao-imovel] REPASSE-INTERNO (par D/C) contrato={} aluguelVinculo={} repasse={} debito={} credito={} data={}",
                contrato.getId(), aluguelVinculo.getId(), repasse, debito.getId(), credito.getId(), dataLancamento);
    }

    /**
     * Remove o par de repasse interno (débito + crédito + vínculo REPASSE) gerado por um vínculo de
     * ALUGUEL.
     */
    private void removerRepasseInterno(Long contratoId, Long aluguelVinculoId) {
        Optional<LocacaoRepasseLancamentoEntity> repasseOpt =
                vinculoRepository.findByOrigemAluguelVinculo_IdAndPapel(aluguelVinculoId, PapelReconciliacao.REPASSE);
        if (repasseOpt.isEmpty()) {
            return;
        }
        LocacaoRepasseLancamentoEntity repasse = repasseOpt.get();
        LancamentoFinanceiroEntity debito = repasse.getLancamentoFinanceiro();
        vinculoRepository.delete(repasse);
        vinculoRepository.flush();
        if (debito != null) {
            lancamentoRepository.delete(debito);
        }
        lancamentoRepository.findByNumeroLancamento(numeroCreditoRepasseInterno(aluguelVinculoId))
                .ifPresent(lancamentoRepository::delete);
        log.info("[reconciliacao-imovel] REPASSE-INTERNO removido contrato={} aluguelVinculo={} debito={}",
                contratoId, aluguelVinculoId, debito != null ? debito.getId() : null);
    }

    /**
     * Mantém débito e crédito de repasse interno na mesma competência do ALUGUEL após reatribuição.
     */
    private void sincronizarCompetenciaParRepasseInterno(
            LocacaoRepasseLancamentoEntity aluguelVinculo, LancamentoFinanceiroEntity debito) {
        if (debito == null) {
            return;
        }
        String competencia = aluguelVinculo.getCompetenciaMes();
        if (!StringUtils.hasText(competencia)) {
            return;
        }
        LocalDate dataComp = competenciaParaData(competencia, null);
        String descDebito = ("Repasse interno (imóvel próprio) " + competencia).trim();
        String descCredito = ("Contrapartida repasse interno " + competencia).trim();
        boolean mudou = false;
        if (dataComp != null && !dataComp.equals(debito.getDataCompetencia())) {
            debito.setDataCompetencia(dataComp);
            debito.setDescricao(descDebito);
            lancamentoRepository.save(debito);
            mudou = true;
        }
        Optional<LancamentoFinanceiroEntity> creditoOpt =
                lancamentoRepository.findByNumeroLancamento(numeroCreditoRepasseInterno(aluguelVinculo.getId()));
        if (creditoOpt.isPresent()) {
            LancamentoFinanceiroEntity credito = creditoOpt.get();
            if (dataComp != null && !dataComp.equals(credito.getDataCompetencia())) {
                credito.setDataCompetencia(dataComp);
                credito.setDescricao(descCredito);
                lancamentoRepository.save(credito);
                mudou = true;
            }
        }
        for (LocacaoRepasseLancamentoEntity v : vinculoRepository
                .findByContratoLocacao_IdAndLancamentoFinanceiro_IdIn(
                        aluguelVinculo.getContratoLocacao().getId(), List.of(debito.getId()))) {
            if (v.getPapel() == PapelReconciliacao.REPASSE
                    && !java.util.Objects.equals(v.getCompetenciaMes(), competencia)) {
                v.setCompetenciaMes(competencia);
                vinculoRepository.save(v);
                mudou = true;
            }
        }
        if (mudou) {
            log.info("[reconciliacao-imovel] REPASSE-INTERNO competência sincronizada aluguelVinculo={} -> {}",
                    aluguelVinculo.getId(), competencia);
        }
    }

    /** "Imóvel próprio" (repasse gerado internamente): fonte da verdade é o flag {@code cliente.proprio} (V114). */
    private boolean isImovelProprio(ContratoLocacaoEntity contrato) {
        ClienteEntity cliente = clienteDoImovel(contrato);
        return cliente != null && Boolean.TRUE.equals(cliente.getProprio());
    }

    private BigDecimal despesasDaCompetencia(Long contratoId, String competenciaMes) {
        if (!StringUtils.hasText(competenciaMes)) {
            return BigDecimal.ZERO;
        }
        BigDecimal total = BigDecimal.ZERO;
        for (LocacaoRepasseLancamentoEntity v :
                vinculoRepository.findByContratoLocacao_IdAndCompetenciaMesOrderByIdAsc(contratoId, competenciaMes)) {
            if (v.getPapel() == PapelReconciliacao.DESPESA && v.getValor() != null) {
                total = total.add(v.getValor().abs());
            }
        }
        return total;
    }

    /**
     * Cria um lançamento AUTO na conta virtual de repasse interno (par débito/crédito no extrato 900).
     */
    private LancamentoFinanceiroEntity novoLancamentoRepasseInterno(
            NaturezaLancamento natureza,
            BigDecimal valor, ClienteEntity cliente, ProcessoEntity processo,
            LocalDate dataLancamento, LocalDate dataCompetencia,
            String descricao, String numeroLancamento, String grupoCompensacao,
            EtapaLancamento etapa) {
        ContaBancariaEntity contaVirtual = contaRepasseInterno();
        LancamentoFinanceiroEntity l = new LancamentoFinanceiroEntity();
        l.setContaContabil(contaAdministracao());
        l.setClienteEntidade(cliente);
        l.setProcesso(processo);
        l.setNumeroBanco(contaVirtual.getNumeroBanco());
        l.setBancoNome(contaVirtual.getBancoNome());
        l.setContaBancaria(contaVirtual);
        l.setNumeroLancamento(numeroLancamento);
        l.setDataLancamento(dataLancamento);
        l.setDataCompetencia(dataCompetencia);
        l.setDescricao(descricao);
        l.setValor(valor);
        l.setNatureza(natureza);
        l.setOrigem(ORIGEM_AUTO);
        l.setStatus("ATIVO");
        l.setGrupoCompensacao(grupoCompensacao);
        l.setEtapa(etapa);
        return l;
    }

    /**
     * Conta bancária VIRTUAL do repasse interno (extrato no Financeiro, banco 900).
     */
    private ContaBancariaEntity contaRepasseInterno() {
        List<ContaBancariaEntity> virtuais = contaBancariaRepository.findByTipo(TIPO_CONTA_REPASSE_INTERNO);
        if (virtuais.size() != 1) {
            throw new IllegalStateException(
                    "Esperada exatamente 1 conta bancária tipo VIRTUAL (repasse interno); encontradas: "
                            + virtuais.size() + ". Verifique o seed/config de conta_bancaria.");
        }
        return virtuais.get(0);
    }

    private static LocalDate competenciaParaData(String competenciaMes, LocalDate fallback) {
        if (StringUtils.hasText(competenciaMes)) {
            try {
                return YearMonth.parse(competenciaMes.trim()).atDay(1);
            } catch (DateTimeParseException ignored) {
                // usa o fallback
            }
        }
        return fallback != null ? fallback : LocalDate.now();
    }

    /** Chave determinística do grupo de compensação do par de repasse interno. */
    private static String grupoRepasseInterno(Long aluguelVinculoId) {
        return PREFIXO_GRUPO_REPASSE_INTERNO + aluguelVinculoId;
    }

    /** Chave determinística do débito de repasse interno (idempotência/reversão por vínculo de ALUGUEL). */
    private static String numeroDebitoRepasseInterno(Long aluguelVinculoId) {
        return PREFIXO_GRUPO_REPASSE_INTERNO + aluguelVinculoId + "-D";
    }

    /** Chave determinística do crédito de contrapartida no extrato virtual. */
    private static String numeroCreditoRepasseInterno(Long aluguelVinculoId) {
        return PREFIXO_GRUPO_REPASSE_INTERNO + aluguelVinculoId + "-C";
    }

    // ----------------------------------------------------------------------------------------- (D)

    /**
     * Resultado por competência (ou período) calculado SOMENTE do que está vinculado.
     * Agrupa por {@code competencia_mes} — independe da data bancária (ciclo cross-mês = mesma competência).
     */
    @Transactional(readOnly = true)
    public ReconciliacaoResultadoResponse resultado(
            Long contratoId, String competencia, String inicio, String fim) {
        ContratoLocacaoEntity contrato = requireContrato(contratoId);
        BigDecimal taxaEsperada = taxaEsperadaPercent(contrato);

        List<LocacaoRepasseLancamentoEntity> vinculos;
        String competenciaUnica = null;
        if (StringUtils.hasText(competencia)) {
            competenciaUnica = parseCompetencia(competencia).toString();
            vinculos = vinculoRepository.findByContratoLocacao_IdAndCompetenciaMesOrderByIdAsc(
                    contratoId, competenciaUnica);
        } else {
            vinculos = vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(contratoId);
            vinculos = filtrarPorPeriodo(vinculos, inicio, fim);
        }

        Map<String, List<LocacaoRepasseLancamentoEntity>> porCompetencia = new HashMap<>();
        for (LocacaoRepasseLancamentoEntity v : vinculos) {
            porCompetencia.computeIfAbsent(chaveCompetencia(v.getCompetenciaMes()), k -> new ArrayList<>()).add(v);
        }

        List<ReconciliacaoResultadoCompetenciaResponse> detalhe = new ArrayList<>();
        for (Map.Entry<String, List<LocacaoRepasseLancamentoEntity>> e : porCompetencia.entrySet()) {
            detalhe.add(calcularCompetencia(e.getKey(), e.getValue(), taxaEsperada));
        }
        detalhe.sort(Comparator.comparing(
                ReconciliacaoResultadoCompetenciaResponse::competencia,
                Comparator.nullsLast(Comparator.naturalOrder())));

        Agregado total = agregar(vinculos);
        StatusRepasse statusTotal = statusRepasse(total, taxaEsperada);

        return new ReconciliacaoResultadoResponse(
                contratoId,
                competenciaUnica,
                escala(total.aluguel()),
                escala(total.repassado()),
                escala(total.despesas()),
                escala(resultadoEscritorio(total)),
                taxaEfetivaPercent(total),
                taxaEsperada,
                statusTotal,
                isImovelProprio(contrato),
                nomePessoa(contrato.getLocadorPessoa()),
                contrato.getDadosBancariosRepasseJson(),
                detalhe);
    }

    /**
     * Chaves {@code contratoId|AAAA-MM} com aluguel recebido (soma {@code papel=ALUGUEL} &gt; 0).
     * Mesma agregação de {@link #repassesPendentes(String)} / {@link #resultado(Long, String, String, String)}.
     */
    @Transactional(readOnly = true)
    public Set<String> chavesContratoCompetenciaComAluguelRecebido() {
        List<LocacaoRepasseLancamentoEntity> todos = vinculoRepository.findAllParaCarteiraRepasses();
        Map<String, List<LocacaoRepasseLancamentoEntity>> porContratoCompetencia = new HashMap<>();
        for (LocacaoRepasseLancamentoEntity v : todos) {
            String competencia = chaveCompetencia(v.getCompetenciaMes());
            if (!StringUtils.hasText(competencia)) {
                continue;
            }
            ContratoLocacaoEntity contrato = v.getContratoLocacao();
            if (contrato == null || contrato.getId() == null) {
                continue;
            }
            String chave = contrato.getId() + "|" + competencia;
            porContratoCompetencia.computeIfAbsent(chave, k -> new ArrayList<>()).add(v);
        }
        Set<String> out = new HashSet<>();
        for (Map.Entry<String, List<LocacaoRepasseLancamentoEntity>> e : porContratoCompetencia.entrySet()) {
            if (agregar(e.getValue()).aluguel().compareTo(BigDecimal.ZERO) > 0) {
                out.add(e.getKey());
            }
        }
        return out;
    }

    /**
     * Carteira de repasses em aberto: ciclos com aluguel vinculado ({@code papel=ALUGUEL}) e repasse
     * {@link StatusRepasse#PENDENTE} ou {@link StatusRepasse#DIVERGENTE}. Valores derivados da mesma
     * agregação de {@link #resultado(Long, String, String, String)}.
     *
     * @param ate competência máxima inclusive (AAAA-MM); {@code null} = todas as competências com aluguel
     */
    @Transactional(readOnly = true)
    public RepassePendenteCarteiraResponse repassesPendentes(String ate) {
        String ateCompetencia = StringUtils.hasText(ate) ? parseCompetencia(ate).toString() : null;
        List<LocacaoRepasseLancamentoEntity> todos = vinculoRepository.findAllParaCarteiraRepasses();

        Map<String, List<LocacaoRepasseLancamentoEntity>> porContratoCompetencia = new HashMap<>();
        for (LocacaoRepasseLancamentoEntity v : todos) {
            String competencia = chaveCompetencia(v.getCompetenciaMes());
            if (!StringUtils.hasText(competencia)) {
                continue;
            }
            if (ateCompetencia != null && competencia.compareTo(ateCompetencia) > 0) {
                continue;
            }
            ContratoLocacaoEntity contrato = v.getContratoLocacao();
            if (contrato == null || contrato.getId() == null) {
                continue;
            }
            String chave = contrato.getId() + "|" + competencia;
            porContratoCompetencia.computeIfAbsent(chave, k -> new ArrayList<>()).add(v);
        }

        List<RepassePendenteItemResponse> itens = new ArrayList<>();
        for (List<LocacaoRepasseLancamentoEntity> vinculos : porContratoCompetencia.values()) {
            RepassePendenteItemResponse item = montarRepassePendenteSeAplicavel(vinculos);
            if (item != null) {
                itens.add(item);
            }
        }

        itens.sort(Comparator.comparing(
                        RepassePendenteItemResponse::competencia, Comparator.nullsLast(String::compareTo))
                .thenComparing(RepassePendenteItemResponse::valorEmAberto, Comparator.reverseOrder()));

        BigDecimal totalEmAberto = itens.stream()
                .map(RepassePendenteItemResponse::valorEmAberto)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new RepassePendenteCarteiraResponse(escala(totalEmAberto), itens);
    }

    private RepassePendenteItemResponse montarRepassePendenteSeAplicavel(List<LocacaoRepasseLancamentoEntity> vinculos) {
        if (vinculos == null || vinculos.isEmpty()) {
            return null;
        }
        ContratoLocacaoEntity contrato = vinculos.get(0).getContratoLocacao();
        if (contrato == null) {
            return null;
        }
        String competencia = chaveCompetencia(vinculos.get(0).getCompetenciaMes());
        BigDecimal taxaEsperada = taxaEsperadaPercent(contrato);
        Agregado a = agregar(vinculos);
        if (a.aluguel().compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        StatusRepasse status = statusRepasse(a, taxaEsperada);
        if (status != StatusRepasse.PENDENTE && status != StatusRepasse.DIVERGENTE) {
            return null;
        }
        MetricasCicloRepasse metricas = metricasCicloRepasse(a, taxaEsperada);
        BigDecimal valorEmAberto = escala(metricas.repasseEsperado().subtract(a.repassado()));
        ImovelEntity imovel = contrato.getImovel();
        return new RepassePendenteItemResponse(
                contrato.getId(),
                imovel != null ? imovel.getNumeroPlanilha() : null,
                imovel != null ? imovel.getEnderecoCompleto() : null,
                nomePessoa(contrato.getLocadorPessoa()),
                contrato.getDadosBancariosRepasseJson(),
                competencia,
                escala(a.aluguel()),
                escala(metricas.taxaEsperadaValor()),
                escala(a.despesas()),
                escala(metricas.repasseEsperado()),
                escala(a.repassado()),
                valorEmAberto,
                status);
    }

    private ReconciliacaoResultadoCompetenciaResponse calcularCompetencia(
            String competencia, List<LocacaoRepasseLancamentoEntity> vinculos, BigDecimal taxaEsperada) {
        Agregado a = agregar(vinculos);
        return new ReconciliacaoResultadoCompetenciaResponse(
                competencia,
                escala(a.aluguel()),
                escala(a.repassado()),
                escala(a.despesas()),
                escala(resultadoEscritorio(a)),
                taxaEfetivaPercent(a),
                taxaEsperada,
                statusRepasse(a, taxaEsperada));
    }

    private Agregado agregar(List<LocacaoRepasseLancamentoEntity> vinculos) {
        Map<PapelReconciliacao, BigDecimal> somas = new EnumMap<>(PapelReconciliacao.class);
        boolean temRepasse = false;
        for (LocacaoRepasseLancamentoEntity v : vinculos) {
            BigDecimal valor = v.getValor() != null ? v.getValor().abs() : BigDecimal.ZERO;
            somas.merge(v.getPapel(), valor, BigDecimal::add);
            if (v.getPapel() == PapelReconciliacao.REPASSE) {
                temRepasse = true;
            }
        }
        return new Agregado(
                somas.getOrDefault(PapelReconciliacao.ALUGUEL, BigDecimal.ZERO),
                somas.getOrDefault(PapelReconciliacao.REPASSE, BigDecimal.ZERO),
                somas.getOrDefault(PapelReconciliacao.DESPESA, BigDecimal.ZERO),
                temRepasse);
    }

    private record Agregado(BigDecimal aluguel, BigDecimal repassado, BigDecimal despesas, boolean temRepasse) {}

    private record MetricasCicloRepasse(BigDecimal taxaEsperadaValor, BigDecimal repasseEsperado) {}

    private static MetricasCicloRepasse metricasCicloRepasse(Agregado a, BigDecimal taxaEsperadaPercent) {
        BigDecimal taxaEsperadaValor = a.aluguel().multiply(taxaEsperadaPercent).divide(CEM, 2, RoundingMode.HALF_UP);
        BigDecimal repasseEsperado = a.aluguel().subtract(taxaEsperadaValor).subtract(a.despesas());
        return new MetricasCicloRepasse(taxaEsperadaValor, repasseEsperado);
    }

    private static BigDecimal resultadoEscritorio(Agregado a) {
        return a.aluguel().subtract(a.repassado()).subtract(a.despesas());
    }

    private static BigDecimal taxaEfetivaPercent(Agregado a) {
        if (a.aluguel().compareTo(BigDecimal.ZERO) == 0) {
            return null;
        }
        return resultadoEscritorio(a)
                .multiply(CEM)
                .divide(a.aluguel(), 2, RoundingMode.HALF_UP);
    }

    private StatusRepasse statusRepasse(Agregado a, BigDecimal taxaEsperada) {
        if (!a.temRepasse()) {
            return StatusRepasse.PENDENTE;
        }
        MetricasCicloRepasse metricas = metricasCicloRepasse(a, taxaEsperada);
        BigDecimal diff = a.repassado().subtract(metricas.repasseEsperado()).abs();
        return diff.compareTo(TOLERANCIA_REPASSE) <= 0 ? StatusRepasse.FEITO : StatusRepasse.DIVERGENTE;
    }

    // ----------------------------------------------------------------------------------------- helpers

    private Map<String, PapelReconciliacao> historicoPapelPorDescricao(Long contratoId) {
        List<LocacaoRepasseLancamentoEntity> todos =
                vinculoRepository.findByContratoLocacao_IdOrderByCompetenciaMesAscIdAsc(contratoId);
        Map<String, Map<PapelReconciliacao, Long>> contagens = new HashMap<>();
        for (LocacaoRepasseLancamentoEntity v : todos) {
            String norm = descricaoNorm(v.getLancamentoFinanceiro());
            if (!StringUtils.hasText(norm) || v.getPapel() == null) {
                continue;
            }
            contagens
                    .computeIfAbsent(norm, k -> new EnumMap<>(PapelReconciliacao.class))
                    .merge(v.getPapel(), 1L, Long::sum);
        }
        Map<String, PapelReconciliacao> dominante = new HashMap<>();
        for (Map.Entry<String, Map<PapelReconciliacao, Long>> e : contagens.entrySet()) {
            e.getValue().entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .ifPresent(top -> dominante.put(e.getKey(), top.getKey()));
        }
        return dominante;
    }

    private Map<Long, LocacaoRepasseLancamentoEntity> vinculoPorLancamento(
            Long contratoId, List<LancamentoFinanceiroEntity> candidatos) {
        if (candidatos.isEmpty()) {
            return Map.of();
        }
        List<Long> ids = candidatos.stream().map(LancamentoFinanceiroEntity::getId).toList();
        Map<Long, LocacaoRepasseLancamentoEntity> mapa = new HashMap<>();
        for (LocacaoRepasseLancamentoEntity v :
                vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdIn(contratoId, ids)) {
            mapa.put(v.getLancamentoFinanceiro().getId(), v);
        }
        return mapa;
    }

    private static List<LocacaoRepasseLancamentoEntity> filtrarPorPeriodo(
            List<LocacaoRepasseLancamentoEntity> vinculos, String inicio, String fim) {
        String ini = StringUtils.hasText(inicio) ? parseCompetencia(inicio).toString() : null;
        String end = StringUtils.hasText(fim) ? parseCompetencia(fim).toString() : null;
        if (ini == null && end == null) {
            return vinculos;
        }
        List<LocacaoRepasseLancamentoEntity> out = new ArrayList<>();
        for (LocacaoRepasseLancamentoEntity v : vinculos) {
            String c = v.getCompetenciaMes();
            if (!StringUtils.hasText(c)) {
                continue;
            }
            if (ini != null && c.compareTo(ini) < 0) {
                continue;
            }
            if (end != null && c.compareTo(end) > 0) {
                continue;
            }
            out.add(v);
        }
        return out;
    }

    private Long processoIdDoContrato(ContratoLocacaoEntity contrato) {
        ProcessoEntity processo = processoAtivoDoContrato(contrato);
        return processo != null ? processo.getId() : null;
    }

    /**
     * Processo do imóvel pela FONTE ÚNICA: a linha ATIVA de {@code imovel_processo} (Fase 3, item 4).
     * Após o backfill V118, escalar == N:N ativo, então isto dá o mesmo resultado do escalar. O escalar
     * segue sendo escrito pelo sync (espelho) até a FASE C.
     */
    private ProcessoEntity processoAtivoDoContrato(ContratoLocacaoEntity contrato) {
        ImovelEntity imovel = contrato != null ? contrato.getImovel() : null;
        if (imovel == null || imovel.getId() == null) {
            return null;
        }
        return imovelProcessoRepository
                .findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(imovel.getId())
                .map(ip -> ip.getProcesso())
                .orElse(null);
    }

    private static ClienteEntity clienteDoImovel(ContratoLocacaoEntity contrato) {
        ImovelEntity imovel = contrato.getImovel();
        return imovel != null ? imovel.getCliente() : null;
    }

    private static String nomePessoa(PessoaEntity pessoa) {
        return pessoa != null ? pessoa.getNome() : null;
    }

    /** Tokens significativos (≥3 letras, sem acento/caixa) de um nome ou descrição. */
    private static Set<String> tokensNome(String texto) {
        if (!StringUtils.hasText(texto)) {
            return Set.of();
        }
        String semAcento = Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toUpperCase(java.util.Locale.ROOT);
        Set<String> tokens = new LinkedHashSet<>();
        for (String t : Arrays.asList(semAcento.split("[^A-Z0-9]+"))) {
            if (t.length() >= 3) {
                tokens.add(t);
            }
        }
        return tokens;
    }

    /**
     * Casa quando a descrição contém os tokens do nome: se o nome tem ≥2 tokens, exige ≥2 presentes;
     * com 1 token, exige esse token. Evita falsos positivos por sobrenome comum isolado.
     */
    private static boolean nomeCasa(Set<String> tokensDescricao, Set<String> tokensNome) {
        if (tokensNome.isEmpty() || tokensDescricao.isEmpty()) {
            return false;
        }
        long presentes = tokensNome.stream().filter(tokensDescricao::contains).count();
        int exigidos = tokensNome.size() >= 2 ? 2 : 1;
        return presentes >= exigidos;
    }

    /** Valor dentro de ±5% do alvo (aluguel ou repasse esperado). */
    private static boolean valorProximo(BigDecimal valor, BigDecimal alvo) {
        if (valor == null || alvo == null || alvo.compareTo(BigDecimal.ZERO) == 0) {
            return false;
        }
        BigDecimal diff = valor.subtract(alvo).abs();
        BigDecimal limite = alvo.abs().multiply(TOLERANCIA_VALOR_ORFAO);
        return diff.compareTo(limite) <= 0;
    }

    private static String descricaoNorm(LancamentoFinanceiroEntity l) {
        if (l == null) {
            return "";
        }
        if (StringUtils.hasText(l.getDescricaoNorm())) {
            return l.getDescricaoNorm();
        }
        return DescricaoNormalizer.normalizar(l.getDescricao());
    }

    private static boolean diaProximo(int dia, Integer diaReferencia) {
        return diaReferencia != null && dia >= 1 && Math.abs(dia - diaReferencia) <= TOLERANCIA_DIAS;
    }

    private static BigDecimal repasseEsperadoPorTaxa(BigDecimal valorAluguel, BigDecimal taxaPercent) {
        if (valorAluguel == null) {
            return null;
        }
        BigDecimal taxa = taxaPercent != null ? taxaPercent : new BigDecimal("10.00");
        BigDecimal fator = BigDecimal.ONE.subtract(taxa.divide(CEM, 6, RoundingMode.HALF_UP));
        return valorAluguel.multiply(fator).setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal taxaEsperadaPercent(ContratoLocacaoEntity contrato) {
        return contrato.getTaxaAdministracaoPercent() != null
                ? contrato.getTaxaAdministracaoPercent()
                : new BigDecimal("10.00");
    }

    private static boolean mesmaCompetencia(LocalDate data, YearMonth competencia) {
        return data != null && YearMonth.from(data).equals(competencia);
    }

    private static String chaveCompetencia(String competenciaMes) {
        return StringUtils.hasText(competenciaMes) ? competenciaMes : "";
    }

    private static BigDecimal escala(BigDecimal v) {
        return (v != null ? v : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private static YearMonth parseCompetenciaOpcional(String competencia) {
        return StringUtils.hasText(competencia) ? parseCompetencia(competencia) : null;
    }

    private static YearMonth parseCompetencia(String competencia) {
        try {
            return YearMonth.parse(competencia.trim());
        } catch (DateTimeParseException e) {
            throw new BusinessRuleException("Competência inválida (use AAAA-MM): " + competencia);
        }
    }

    private ContratoLocacaoEntity requireContrato(Long id) {
        return contratoLocacaoRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Contrato de locação não encontrado: " + id));
    }

    private static ReconciliacaoVinculoResponse toVinculoResponse(LocacaoRepasseLancamentoEntity e, boolean adotado) {
        LancamentoFinanceiroEntity l = e.getLancamentoFinanceiro();
        String contaCodigo = adotado && l.getContaContabil() != null ? l.getContaContabil().getCodigo() : null;
        Long processoId = adotado && l.getProcesso() != null ? l.getProcesso().getId() : null;
        return new ReconciliacaoVinculoResponse(
                e.getId(),
                e.getContratoLocacao().getId(),
                l.getId(),
                e.getPapel(),
                e.getCompetenciaMes(),
                e.getValor(),
                adotado,
                contaCodigo,
                processoId,
                e.getOrigem());
    }

    private static String trimToNull(String s) {
        if (!StringUtils.hasText(s)) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
