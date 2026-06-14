package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.financeiro.domain.DescricaoNormalizer;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.domain.RecorrenciaValorPerfilUtil;
import br.com.vilareal.financeiro.domain.RecorrenciaValorPerfilUtil.ClassePrecisao;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.imovel.api.dto.ReconciliacaoResultadoResponse;
import br.com.vilareal.imovel.api.dto.ReconciliacaoResultadoResponse.ReconciliacaoResultadoCompetenciaResponse;
import br.com.vilareal.imovel.api.dto.ReconciliacaoSugestaoItemResponse;
import br.com.vilareal.imovel.api.dto.ReconciliacaoVincularRequest;
import br.com.vilareal.imovel.api.dto.ReconciliacaoVinculoResponse;
import br.com.vilareal.imovel.domain.PapelReconciliacao;
import br.com.vilareal.imovel.domain.StatusRepasse;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.LocacaoRepasseLancamentoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
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
    /** Conta contábil "I" (Imóveis) — renda de investimento do imóvel próprio. */
    private static final String CODIGO_CONTA_IMOVEIS = "I";

    /**
     * "Imóvel próprio" (VRV/Itamar): detecção por CÓDIGO de cliente, consistente com o resto do
     * sistema (NÃO por pessoa/locador). 00000938 = VRV, 00000149 = Itamar (cliente.id 938 e 151).
     */
    private static final Set<String> CODIGOS_CLIENTE_PROPRIO = Set.of("00000938", "00000149");
    /** Banco virtual dos lançamentos automáticos de repasse interno — sem extrato, fora da conciliação. */
    private static final int NUMERO_BANCO_REPASSE_INTERNO = 900;
    private static final String BANCO_NOME_REPASSE_INTERNO = "REPASSE INTERNO";
    /** Origem dos lançamentos gerados automaticamente. */
    private static final String ORIGEM_AUTO = "AUTO";
    /** Prefixo do grupo de compensação do par interno; embute o id do vínculo de ALUGUEL (idempotência). */
    private static final String PREFIXO_GRUPO_REPASSE_INTERNO = "AUTO-REP-";

    private static final Logger log = LoggerFactory.getLogger(LocacaoReconciliacaoService.class);

    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final LocacaoRepasseLancamentoRepository vinculoRepository;
    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final ContaContabilRepository contaContabilRepository;

    public LocacaoReconciliacaoService(
            ContratoLocacaoRepository contratoLocacaoRepository,
            LocacaoRepasseLancamentoRepository vinculoRepository,
            LancamentoFinanceiroRepository lancamentoRepository,
            ContaContabilRepository contaContabilRepository) {
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.vinculoRepository = vinculoRepository;
        this.lancamentoRepository = lancamentoRepository;
        this.contaContabilRepository = contaContabilRepository;
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

        List<LancamentoFinanceiroEntity> candidatos = lancamentoRepository.findAtivosByProcessoId(processoId);
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
                lancamentoRepository.findOrfaosAtivosNoIntervalo(inicio, fim);
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
     *   <li>Imóvel PRÓPRIO (codigo_cliente ∈ {00000938, 00000149}): nunca sugere — o repasse é
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
                    criarVinculoComGatilho(contrato, lancamento, item.papel(), item.competenciaMes());
            saida.add(toVinculoResponse(entity, adotado));
        }
        return saida;
    }

    /**
     * Ponto ÚNICO de criação de vínculo: upsert por (contrato, lançamento, papel) e, quando o papel
     * é ALUGUEL, dispara o repasse interno (imóvel próprio). Usado por {@link #vincular} e pela
     * convergência do "Aprovar" ({@link #registrarAluguelClassificado}).
     */
    private LocacaoRepasseLancamentoEntity criarVinculoComGatilho(
            ContratoLocacaoEntity contrato, LancamentoFinanceiroEntity lancamento,
            PapelReconciliacao papel, String competenciaMes) {
        LocacaoRepasseLancamentoEntity entity = vinculoRepository
                .findByContratoLocacao_IdAndLancamentoFinanceiro_IdAndPapel(
                        contrato.getId(), lancamento.getId(), papel)
                .orElseGet(LocacaoRepasseLancamentoEntity::new);

        entity.setContratoLocacao(contrato);
        entity.setLancamentoFinanceiro(lancamento);
        entity.setPapel(papel);
        entity.setCompetenciaMes(trimToNull(competenciaMes));
        entity.setValor(lancamento.getValor() != null ? lancamento.getValor().abs() : null);

        entity = vinculoRepository.save(entity);

        // Imóvel próprio (VRV/Itamar): ao reconhecer o ALUGUEL, gera o repasse internamente
        // (não há repasse bancário real). Idempotente e reversível.
        if (entity.getPapel() == PapelReconciliacao.ALUGUEL) {
            gerarRepasseInternoSeProprio(entity, contrato);
        }
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
        for (LancamentoFinanceiroEntity l : lancamentoRepository.findAtivosByProcessoId(processoId)) {
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

    /** Adota um lançamento órfão: conta A + cliente + processo do imóvel, recalculando a etapa. Auditado. */
    private void adotarLancamento(LancamentoFinanceiroEntity lancamento, ContratoLocacaoEntity contrato) {
        ContaContabilEntity contaA = contaAdministracao();
        ClienteEntity cliente = clienteDoImovel(contrato);
        ProcessoEntity processo = contrato.getImovel() != null ? contrato.getImovel().getProcesso() : null;
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
     * Gera o PAR de repasse interno para um vínculo de ALUGUEL em imóvel próprio (idempotente).
     * Débito em conta A (fecha o ciclo via vínculo REPASSE) e crédito em conta I (renda de investimento),
     * num banco virtual sem extrato, pareados por {@code grupo_compensacao} (saldo A−x / I+x).
     */
    private void gerarRepasseInternoSeProprio(LocacaoRepasseLancamentoEntity aluguelVinculo, ContratoLocacaoEntity contrato) {
        if (!isImovelProprio(contrato)) {
            return;
        }
        String grupo = grupoRepasseInterno(aluguelVinculo.getId());
        List<LancamentoFinanceiroEntity> existentes = lancamentoRepository.findAllByGrupoCompensacao(grupo);
        if (!existentes.isEmpty()) {
            // Par já existe (idempotência). Se a competência do ALUGUEL mudou (reatribuição na tela),
            // sincroniza o par e o vínculo REPASSE para manter o ciclo na mesma competência.
            sincronizarCompetenciaDoPar(aluguelVinculo, existentes);
            return;
        }

        BigDecimal aluguel = aluguelVinculo.getValor() != null ? aluguelVinculo.getValor().abs() : null;
        if (aluguel == null || aluguel.signum() <= 0) {
            return;
        }
        BigDecimal taxa = taxaEsperadaPercent(contrato);
        // repasseEsperado = aluguel − aluguel×taxa − despesas (o mesmo do /resultado).
        // Assume 1 aluguel por competência (caso real do imóvel próprio); as despesas da competência são abatidas.
        BigDecimal despesas = despesasDaCompetencia(contrato.getId(), aluguelVinculo.getCompetenciaMes());
        BigDecimal repasse = repasseEsperadoPorTaxa(aluguel, taxa).subtract(despesas).setScale(2, RoundingMode.HALF_UP);
        if (repasse.signum() <= 0) {
            return;
        }

        ClienteEntity cliente = clienteDoImovel(contrato);
        ProcessoEntity processo = contrato.getImovel() != null ? contrato.getImovel().getProcesso() : null;
        LancamentoFinanceiroEntity aluguelLanc = aluguelVinculo.getLancamentoFinanceiro();
        LocalDate dataComp = competenciaParaData(aluguelVinculo.getCompetenciaMes(),
                aluguelLanc != null ? aluguelLanc.getDataLancamento() : null);
        String compLabel = StringUtils.hasText(aluguelVinculo.getCompetenciaMes()) ? aluguelVinculo.getCompetenciaMes() : "";

        LancamentoFinanceiroEntity debito = novoLancamentoInterno(
                contaAdministracao(), NaturezaLancamento.DEBITO, repasse, cliente, processo, dataComp,
                ("Repasse interno (imóvel próprio) " + compLabel).trim(), grupo, grupo + "-D");
        LancamentoFinanceiroEntity credito = novoLancamentoInterno(
                contaImoveis(), NaturezaLancamento.CREDITO, repasse, cliente, processo, dataComp,
                ("Renda de investimento (repasse interno) " + compLabel).trim(), grupo, grupo + "-C");
        lancamentoRepository.save(debito);
        lancamentoRepository.save(credito);

        LocacaoRepasseLancamentoEntity repasseVinculo = new LocacaoRepasseLancamentoEntity();
        repasseVinculo.setContratoLocacao(contrato);
        repasseVinculo.setLancamentoFinanceiro(debito);
        repasseVinculo.setPapel(PapelReconciliacao.REPASSE);
        repasseVinculo.setCompetenciaMes(aluguelVinculo.getCompetenciaMes());
        repasseVinculo.setValor(repasse);
        vinculoRepository.save(repasseVinculo);

        log.info("[reconciliacao-imovel] REPASSE-INTERNO gerado contrato={} aluguelVinculo={} grupo={} repasse={} debitoA={} creditoI={}",
                contrato.getId(), aluguelVinculo.getId(), grupo, repasse, debito.getId(), credito.getId());
    }

    /** Remove o par de repasse interno (lançamentos + vínculo REPASSE) gerado por um vínculo de ALUGUEL. */
    private void removerRepasseInterno(Long contratoId, Long aluguelVinculoId) {
        String grupo = grupoRepasseInterno(aluguelVinculoId);
        List<LancamentoFinanceiroEntity> lancs = lancamentoRepository.findAllByGrupoCompensacao(grupo);
        if (lancs.isEmpty()) {
            return;
        }
        List<Long> ids = lancs.stream().map(LancamentoFinanceiroEntity::getId).toList();
        List<LocacaoRepasseLancamentoEntity> vinculos =
                vinculoRepository.findByContratoLocacao_IdAndLancamentoFinanceiro_IdIn(contratoId, ids);
        if (!vinculos.isEmpty()) {
            vinculoRepository.deleteAll(vinculos);
            vinculoRepository.flush();
        }
        lancamentoRepository.deleteAll(lancs);
        log.info("[reconciliacao-imovel] REPASSE-INTERNO removido contrato={} aluguelVinculo={} grupo={} lancamentos={}",
                contratoId, aluguelVinculoId, grupo, ids);
    }

    /** Mantém o par interno na mesma competência do ALUGUEL após uma reatribuição na tela. */
    private void sincronizarCompetenciaDoPar(
            LocacaoRepasseLancamentoEntity aluguelVinculo, List<LancamentoFinanceiroEntity> parExistente) {
        String competencia = aluguelVinculo.getCompetenciaMes();
        if (!StringUtils.hasText(competencia)) {
            return;
        }
        LocalDate dataComp = competenciaParaData(competencia, null);
        boolean mudou = false;
        for (LancamentoFinanceiroEntity l : parExistente) {
            if (dataComp != null && !dataComp.equals(l.getDataCompetencia())) {
                l.setDataCompetencia(dataComp);
                lancamentoRepository.save(l);
                mudou = true;
            }
        }
        List<Long> ids = parExistente.stream().map(LancamentoFinanceiroEntity::getId).toList();
        for (LocacaoRepasseLancamentoEntity v : vinculoRepository
                .findByContratoLocacao_IdAndLancamentoFinanceiro_IdIn(
                        aluguelVinculo.getContratoLocacao().getId(), ids)) {
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

    private boolean isImovelProprio(ContratoLocacaoEntity contrato) {
        ClienteEntity cliente = clienteDoImovel(contrato);
        if (cliente == null) {
            return false;
        }
        String codigo = normalizarCodigoCliente(cliente.getCodigoCliente());
        return codigo != null && CODIGOS_CLIENTE_PROPRIO.contains(codigo);
    }

    /** Normaliza o código do cliente para o formato CHAR(8) ("938" → "00000938"). */
    private static String normalizarCodigoCliente(String codigo) {
        if (!StringUtils.hasText(codigo)) {
            return null;
        }
        String digitos = codigo.trim().replaceAll("[^0-9]", "");
        if (digitos.isEmpty()) {
            return null;
        }
        return String.format("%08d", Long.parseLong(digitos));
    }

    private ContaContabilEntity contaImoveis() {
        return contaContabilRepository.findFirstByCodigoIgnoreCase(CODIGO_CONTA_IMOVEIS)
                .or(() -> contaContabilRepository.findById(11L))
                .orElseThrow(() -> new BusinessRuleException(
                        "Conta contábil de imóveis (I) não encontrada."));
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

    private LancamentoFinanceiroEntity novoLancamentoInterno(
            ContaContabilEntity conta, NaturezaLancamento natureza, BigDecimal valor,
            ClienteEntity cliente, ProcessoEntity processo, LocalDate data,
            String descricao, String grupo, String numeroLancamento) {
        LancamentoFinanceiroEntity l = new LancamentoFinanceiroEntity();
        l.setContaContabil(conta);
        l.setClienteEntidade(cliente);
        l.setProcesso(processo);
        l.setNumeroBanco(NUMERO_BANCO_REPASSE_INTERNO);
        l.setBancoNome(BANCO_NOME_REPASSE_INTERNO);
        l.setNumeroLancamento(numeroLancamento);
        l.setDataLancamento(data);
        l.setDataCompetencia(data);
        l.setDescricao(descricao);
        l.setValor(valor);
        l.setNatureza(natureza);
        l.setOrigem(ORIGEM_AUTO);
        l.setStatus("ATIVO");
        l.setGrupoCompensacao(grupo);
        l.setEtapa(EtapaLancamento.COMPENSADO);
        return l;
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

    private static String grupoRepasseInterno(Long aluguelVinculoId) {
        return PREFIXO_GRUPO_REPASSE_INTERNO + aluguelVinculoId;
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
                detalhe);
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
        BigDecimal taxaEsperadaValor = a.aluguel().multiply(taxaEsperada).divide(CEM, 2, RoundingMode.HALF_UP);
        BigDecimal repasseEsperado = a.aluguel().subtract(taxaEsperadaValor).subtract(a.despesas());
        BigDecimal diff = a.repassado().subtract(repasseEsperado).abs();
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

    private static Long processoIdDoContrato(ContratoLocacaoEntity contrato) {
        ImovelEntity imovel = contrato.getImovel();
        if (imovel == null) {
            return null;
        }
        ProcessoEntity processo = imovel.getProcesso();
        return processo != null ? processo.getId() : null;
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
                processoId);
    }

    private static String trimToNull(String s) {
        if (!StringUtils.hasText(s)) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
