package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.*;
import br.com.vilareal.financeiro.domain.*;
import br.com.vilareal.financeiro.infrastructure.persistence.LancamentoFinanceiroSpecifications;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.RegraClassificacaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.RegraClassificacaoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.*;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;
import java.util.stream.Collectors;

@Service
public class FinanceiroSugestaoService {

    private final RegraClassificacaoRepository regraRepository;
    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final ContaContabilRepository contaContabilRepository;
    private final PessoaRepository pessoaRepository;
    private final ProcessoRepository processoRepository;

    public FinanceiroSugestaoService(
            RegraClassificacaoRepository regraRepository,
            LancamentoFinanceiroRepository lancamentoRepository,
            ContaContabilRepository contaContabilRepository,
            PessoaRepository pessoaRepository,
            ProcessoRepository processoRepository) {
        this.regraRepository = regraRepository;
        this.lancamentoRepository = lancamentoRepository;
        this.contaContabilRepository = contaContabilRepository;
        this.pessoaRepository = pessoaRepository;
        this.processoRepository = processoRepository;
    }

    @Transactional(readOnly = true)
    public List<SugestaoClassificacaoResponse> sugerir(Long lancamentoId) {
        LancamentoFinanceiroEntity lancamento = carregarLancamento(lancamentoId);
        return sugerir(lancamento);
    }

    @Transactional(readOnly = true)
    public List<SugestaoClassificacaoResponse> sugerir(LancamentoFinanceiroEntity lancamento) {
        List<SugestaoClassificacaoResponse> todas = new ArrayList<>();
        todas.addAll(camadaRegras(lancamento));
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
        return toLancamentoResponse(lancamentoRepository.save(e));
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
        return result;
    }

    @Transactional
    public AutoClassificarResponse autoClassificar(AutoClassificarRequest req) {
        ConfiancaSugestao minimo = req.getConfiancaMinima() != null ? req.getConfiancaMinima() : ConfiancaSugestao.ALTA;
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
                null,
                null,
                null,
                EtapaLancamento.IMPORTADO,
                req.getNumeroBanco(),
                null,
                null,
                null,
                ano,
                mes);

        List<LancamentoFinanceiroEntity> candidatos = lancamentoRepository.findAll(spec);

        AutoClassificarResponse response = new AutoClassificarResponse();
        response.setSimulacao(req.isDryRun());
        response.setCandidatos(candidatos.size());
        List<AutoClassificarDetalheResponse> detalhes = new ArrayList<>();
        Map<String, Integer> porConta = new LinkedHashMap<>();
        int classificaveis = 0;

        for (LancamentoFinanceiroEntity l : candidatos) {
            List<SugestaoClassificacaoResponse> sugestoes = sugerir(l);
            Optional<SugestaoClassificacaoResponse> melhor = sugestoes.stream()
                    .filter(s -> s.getConfianca().atendeMinimo(minimo))
                    .findFirst();
            if (melhor.isEmpty()) {
                continue;
            }
            classificaveis++;
            SugestaoClassificacaoResponse s = melhor.get();
            porConta.merge(s.getContaCodigo(), 1, Integer::sum);

            AutoClassificarDetalheResponse d = new AutoClassificarDetalheResponse();
            d.setLancamentoId(l.getId());
            d.setDescricao(Utf8MojibakeUtil.corrigir(l.getDescricao()));
            d.setSugestao(s.getContaCodigo());
            d.setConfianca(s.getConfianca());
            d.setOrigem(s.getOrigem());
            detalhes.add(d);

            if (!req.isDryRun()) {
                aplicarClassificacaoEmEntity(l, s.getContaContabilId(), s.getClienteId(), s.getProcessoId());
                lancamentoRepository.save(l);
            }
        }

        response.setClassificaveis(classificaveis);
        response.setPorConta(porConta);
        response.setDetalhes(detalhes);
        return response;
    }

    private List<SugestaoClassificacaoResponse> camadaRegras(LancamentoFinanceiroEntity lancamento) {
        String texto = textoParaMatch(lancamento);
        List<SugestaoClassificacaoResponse> out = new ArrayList<>();
        for (RegraClassificacaoEntity regra : regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc()) {
            if (regra.getNumeroBanco() != null
                    && !Objects.equals(regra.getNumeroBanco(), lancamento.getNumeroBanco())) {
                continue;
            }
            if (!matchRegra(regra, texto)) {
                continue;
            }
            SugestaoClassificacaoResponse s = baseSugestao(regra.getContaContabil(), ConfiancaSugestao.ALTA, OrigemSugestao.REGRA);
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

    private boolean matchRegra(RegraClassificacaoEntity regra, String texto) {
        String padrao = regra.getPadraoDescricao();
        if (!StringUtils.hasText(padrao) || !StringUtils.hasText(texto)) {
            return false;
        }
        return switch (regra.getTipoMatch()) {
            case CONTAINS -> texto.toUpperCase(Locale.ROOT).contains(padrao.trim().toUpperCase(Locale.ROOT));
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
        Map<Long, SugestaoClassificacaoResponse> porConta = new LinkedHashMap<>();
        for (SugestaoClassificacaoResponse s : todas) {
            SugestaoClassificacaoResponse existente = porConta.get(s.getContaContabilId());
            if (existente == null || s.getConfianca().ordinal() < existente.getConfianca().ordinal()) {
                porConta.put(s.getContaContabilId(), s);
            }
        }
        return porConta.values().stream()
                .sorted(Comparator.comparingInt(s -> s.getConfianca().ordinal()))
                .collect(Collectors.toList());
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
