package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.*;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.domain.FinanceiroDescricaoIndicaContaE;
import br.com.vilareal.financeiro.domain.FinanceiroDescricaoIndicaContaF;
import br.com.vilareal.financeiro.domain.FinanceiroDescricaoIndicaContaI;
import br.com.vilareal.financeiro.domain.TipoMatch;
import br.com.vilareal.financeiro.infrastructure.persistence.LancamentoFinanceiroSpecifications;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.RegraClassificacaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.RegraClassificacaoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.*;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

@Service
public class ClassificacaoAutomaticaService {

    private static final int MAX_EXEMPLOS_POR_REGRA = 5;
    private static final String CONTA_NAO_IDENTIFICADO = "N";

    private final RegraClassificacaoRepository regraRepository;
    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final ContaContabilRepository contaContabilRepository;

    public ClassificacaoAutomaticaService(
            RegraClassificacaoRepository regraRepository,
            LancamentoFinanceiroRepository lancamentoRepository,
            ContaContabilRepository contaContabilRepository) {
        this.regraRepository = regraRepository;
        this.lancamentoRepository = lancamentoRepository;
        this.contaContabilRepository = contaContabilRepository;
    }

    @Transactional
    public AutoClassificarResponse autoClassificar(AutoClassificarRequest req) {
        BigDecimal confiancaMinima =
                req.getConfiancaMinima() != null ? req.getConfiancaMinima() : new BigDecimal("0.85");

        ContaContabilEntity contaN = contaContabilRepository
                .findFirstByCodigoIgnoreCase(CONTA_NAO_IDENTIFICADO)
                .orElseThrow(() -> new ResourceNotFoundException("Conta contábil N não encontrada."));

        Integer ano = null;
        Integer mes = null;
        if (StringUtils.hasText(req.getMes())) {
            YearMonth ym = YearMonth.parse(req.getMes().trim());
            ano = ym.getYear();
            mes = ym.getMonthValue();
        }

        var spec = LancamentoFinanceiroSpecifications.comFiltros(
                null,
                null,
                contaN.getId(),
                null,
                null,
                null,
                req.getNumeroBanco(),
                null,
                null,
                true,
                ano,
                mes);

        List<LancamentoFinanceiroEntity> candidatos = lancamentoRepository.findAll(spec);
        List<RegraClassificacaoEntity> regras =
                regraRepository.findByAtivoTrueOrderByConfiancaDescPrioridadeAscIdAsc();

        Map<Long, AutoClassificarRegraAplicadaResponse> porRegra = new LinkedHashMap<>();
        int totalReclassificados = 0;

        for (LancamentoFinanceiroEntity lancamento : candidatos) {
            Optional<RegraClassificacaoEntity> regraOpt = primeiraRegraCompativel(regras, lancamento, confiancaMinima);
            if (regraOpt.isEmpty()) {
                continue;
            }
            RegraClassificacaoEntity regra = regraOpt.get();
            totalReclassificados++;

            AutoClassificarRegraAplicadaResponse bloco = porRegra.computeIfAbsent(regra.getId(), id -> {
                AutoClassificarRegraAplicadaResponse r = new AutoClassificarRegraAplicadaResponse();
                r.setRegraId(regra.getId());
                r.setDescricaoPadrao(Utf8MojibakeUtil.corrigir(regra.getPadraoDescricao()));
                r.setLetraDestino(
                        regra.getLetraDestino() != null
                                ? regra.getLetraDestino()
                                : regra.getContaContabil().getCodigo());
                r.setConfianca(regra.getConfianca());
                return r;
            });
            bloco.setLancamentosAfetados(bloco.getLancamentosAfetados() + 1);
            if (bloco.getExemplos().size() < MAX_EXEMPLOS_POR_REGRA) {
                AutoClassificarExemploResponse ex = new AutoClassificarExemploResponse();
                ex.setLancamentoId(lancamento.getId());
                ex.setDescricao(Utf8MojibakeUtil.corrigir(lancamento.getDescricao()));
                bloco.getExemplos().add(ex);
            }

            if (!req.isDryRun()) {
                aplicarRegra(lancamento, regra);
                lancamentoRepository.save(lancamento);
            }
        }

        AutoClassificarResponse response = new AutoClassificarResponse();
        response.setSimulacao(req.isDryRun());
        response.setCandidatos(candidatos.size());
        response.setTotalReclassificados(totalReclassificados);
        response.setClassificaveis(totalReclassificados);
        response.setRegrasAplicadas(new ArrayList<>(porRegra.values()));
        response.setPorConta(contarPorLetra(porRegra));
        return response;
    }

    private static Map<String, Integer> contarPorLetra(Map<Long, AutoClassificarRegraAplicadaResponse> porRegra) {
        Map<String, Integer> porConta = new LinkedHashMap<>();
        for (AutoClassificarRegraAplicadaResponse r : porRegra.values()) {
            String letra = r.getLetraDestino() != null ? r.getLetraDestino() : "?";
            porConta.merge(letra, r.getLancamentosAfetados(), Integer::sum);
        }
        return porConta;
    }

    private Optional<RegraClassificacaoEntity> primeiraRegraCompativel(
            List<RegraClassificacaoEntity> regras,
            LancamentoFinanceiroEntity lancamento,
            BigDecimal confiancaMinima) {
        if (FinanceiroDescricaoIndicaContaF.indica(lancamento.getDescricao(), lancamento.getDescricaoDetalhada())) {
            Optional<RegraClassificacaoEntity> regraF = contaContabilRepository
                    .findFirstByCodigoIgnoreCase("F")
                    .map(this::regraSinteticaRendimentos);
            if (regraF.isPresent()) {
                return regraF;
            }
        }
        if (FinanceiroDescricaoIndicaContaE.indica(lancamento.getDescricao(), lancamento.getDescricaoDetalhada())) {
            Optional<RegraClassificacaoEntity> regraE = contaContabilRepository
                    .findFirstByCodigoIgnoreCase("E")
                    .map(this::regraSinteticaCompensacaoItamarVrv);
            if (regraE.isPresent()) {
                return regraE;
            }
        }
        if (FinanceiroDescricaoIndicaContaI.indica(lancamento.getDescricao(), lancamento.getDescricaoDetalhada())) {
            Optional<RegraClassificacaoEntity> regraI = contaContabilRepository
                    .findFirstByCodigoIgnoreCase("I")
                    .map(this::regraSinteticaFinanciamentoImobiliario);
            if (regraI.isPresent()) {
                return regraI;
            }
        }
        String texto = textoParaMatch(lancamento);
        for (RegraClassificacaoEntity regra : regras) {
            if (regra.getConfianca() == null
                    || regra.getConfianca().compareTo(confiancaMinima) < 0) {
                continue;
            }
            if (regra.getNumeroBanco() != null
                    && !Objects.equals(regra.getNumeroBanco(), lancamento.getNumeroBanco())) {
                continue;
            }
            if (matchRegra(regra, texto)) {
                return Optional.of(regra);
            }
        }
        return Optional.empty();
    }

    private void aplicarRegra(LancamentoFinanceiroEntity lancamento, RegraClassificacaoEntity regra) {
        lancamento.setContaContabil(regra.getContaContabil());
        if (regra.getClienteEntidade() != null) {
            lancamento.setClienteEntidade(regra.getClienteEntidade());
        }
        if (regra.getProcesso() != null) {
            lancamento.setProcesso(regra.getProcesso());
            if (lancamento.getClienteEntidade() == null && regra.getProcesso().getCliente() != null) {
                lancamento.setClienteEntidade(regra.getProcesso().getCliente());
            }
        }
        Long clienteId = lancamento.getClienteEntidade() != null ? lancamento.getClienteEntidade().getId() : null;
        lancamento.setEtapa(EtapaLancamento.calcular(
                regra.getContaContabil().getCodigo(), lancamento.getGrupoCompensacao(), clienteId));
    }

    private RegraClassificacaoEntity regraSinteticaRendimentos(ContaContabilEntity contaF) {
        RegraClassificacaoEntity regra = new RegraClassificacaoEntity();
        regra.setId(0L);
        regra.setPadraoDescricao("COR JURS/JUROS/CRI/LCA/CDB");
        regra.setTipoMatch(TipoMatch.CONTAINS);
        regra.setContaContabil(contaF);
        regra.setLetraDestino("F");
        regra.setPrioridade(1);
        regra.setConfianca(new BigDecimal("0.9900"));
        regra.setAtivo(true);
        return regra;
    }

    private RegraClassificacaoEntity regraSinteticaCompensacaoItamarVrv(ContaContabilEntity contaE) {
        RegraClassificacaoEntity regra = new RegraClassificacaoEntity();
        regra.setId(0L);
        regra.setPadraoDescricao("Itamar/VRV compensação");
        regra.setTipoMatch(TipoMatch.CONTAINS);
        regra.setContaContabil(contaE);
        regra.setLetraDestino("E");
        regra.setPrioridade(1);
        regra.setConfianca(new BigDecimal("0.9900"));
        regra.setAtivo(true);
        return regra;
    }

    private RegraClassificacaoEntity regraSinteticaFinanciamentoImobiliario(ContaContabilEntity contaI) {
        RegraClassificacaoEntity regra = new RegraClassificacaoEntity();
        regra.setId(0L);
        regra.setPadraoDescricao("FINANC IMOBILIARIO");
        regra.setTipoMatch(TipoMatch.CONTAINS);
        regra.setContaContabil(contaI);
        regra.setLetraDestino("I");
        regra.setPrioridade(1);
        regra.setConfianca(new BigDecimal("0.9900"));
        regra.setAtivo(true);
        return regra;
    }

    static boolean matchRegra(RegraClassificacaoEntity regra, String texto) {
        String padrao = regra.getPadraoDescricao();
        if (!StringUtils.hasText(padrao) || !StringUtils.hasText(texto)) {
            return false;
        }
        TipoMatch tipo = regra.getTipoMatch() != null ? regra.getTipoMatch() : TipoMatch.CONTAINS;
        return switch (tipo) {
            case CONTAINS -> matchLike(padrao, texto);
            case EXACT -> texto.equalsIgnoreCase(padrao.trim());
            case REGEX -> {
                try {
                    yield Pattern.compile(padrao, Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE)
                            .matcher(texto)
                            .find();
                } catch (PatternSyntaxException ex) {
                    yield false;
                }
            }
        };
    }

    /** Padrões no formato %texto% ou texto simples. */
    static boolean matchLike(String padrao, String texto) {
        String nucleo = padrao.trim();
        if (nucleo.startsWith("%")) {
            nucleo = nucleo.substring(1);
        }
        if (nucleo.endsWith("%")) {
            nucleo = nucleo.substring(0, nucleo.length() - 1);
        }
        if (nucleo.isEmpty()) {
            return false;
        }
        return texto.toUpperCase(Locale.ROOT).contains(nucleo.toUpperCase(Locale.ROOT));
    }

    private static String textoParaMatch(LancamentoFinanceiroEntity lancamento) {
        String d1 = lancamento.getDescricao() != null ? lancamento.getDescricao() : "";
        String d2 = lancamento.getDescricaoDetalhada() != null ? lancamento.getDescricaoDetalhada() : "";
        return (d1 + " " + d2).trim();
    }
}
