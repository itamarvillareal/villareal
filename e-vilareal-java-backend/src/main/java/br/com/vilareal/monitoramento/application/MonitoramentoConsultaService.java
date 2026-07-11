package br.com.vilareal.monitoramento.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.monitoramento.api.dto.PessoaMonitoradaResponse;
import br.com.vilareal.monitoramento.api.dto.ProcessoDescobertoResponse;
import br.com.vilareal.monitoramento.api.dto.SegredoContagemResponse;
import br.com.vilareal.monitoramento.api.dto.VarreduraResponse;
import br.com.vilareal.monitoramento.domain.SituacaoProcessoDescoberto;
import br.com.vilareal.monitoramento.infrastructure.persistence.entity.ProcessoDescobertoEntity;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.ProcessoDescobertoRepository;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.SegredoJusticaContagemRepository;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.VarreduraPessoaRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Leituras da tela de monitoramento (Parte 5, Bloco A). Somente consulta — as ações
 * (ignorar, cadastrar) são de outro bloco.
 */
@Service
public class MonitoramentoConsultaService {

    /** Janela do recorte "recentes": distribuídos nos últimos 30 dias. */
    static final int RECENTES_DIAS = 30;

    /** Teto do histórico de varreduras devolvido de uma vez (modal de conferência). */
    static final int HISTORICO_LIMITE_MAX = 500;

    private final ProcessoDescobertoRepository descobertoRepository;
    private final SegredoJusticaContagemRepository segredoRepository;
    private final VarreduraPessoaRepository varreduraRepository;
    private final PessoaRepository pessoaRepository;
    private final Clock clock;

    public MonitoramentoConsultaService(
            ProcessoDescobertoRepository descobertoRepository,
            SegredoJusticaContagemRepository segredoRepository,
            VarreduraPessoaRepository varreduraRepository,
            PessoaRepository pessoaRepository,
            Clock clock) {
        this.descobertoRepository = descobertoRepository;
        this.segredoRepository = segredoRepository;
        this.varreduraRepository = varreduraRepository;
        this.pessoaRepository = pessoaRepository;
        this.clock = clock;
    }

    /**
     * Caixa de entrada: descobertos na situação pedida (default NOVO), de todas as pessoas
     * marcadas para monitoramento, ordenados por data de distribuição descendente.
     */
    @Transactional(readOnly = true)
    public List<ProcessoDescobertoResponse> caixaDeEntrada(String situacaoParam) {
        SituacaoProcessoDescoberto situacao = parseSituacao(
                situacaoParam == null || situacaoParam.isBlank() ? "NOVO" : situacaoParam);
        return descobertoRepository.findCaixaDeEntrada(situacao).stream()
                .map(ProcessoDescobertoResponse::de)
                .toList();
    }

    /**
     * Painel da pessoa: descobertos dela, filtráveis por situação e pelo recorte "recentes".
     *
     * <p>"Recentes" filtra por DATA DE DISTRIBUIÇÃO nos últimos {@value RECENTES_DIAS} dias,
     * deliberadamente NÃO por {@code primeiro_visto_em}: numa pessoa recém-marcada os dois
     * coincidem, mas numa pessoa monitorada há meses divergem — e o que responde "isto é um
     * processo fresco" é quando ele foi distribuído, não quando nós o vimos.</p>
     */
    @Transactional(readOnly = true)
    public List<ProcessoDescobertoResponse> descobertosDaPessoa(
            Long pessoaId, String situacaoParam, boolean recentes) {
        exigirPessoa(pessoaId);
        SituacaoProcessoDescoberto situacao =
                situacaoParam == null || situacaoParam.isBlank() ? null : parseSituacao(situacaoParam);
        LocalDateTime corte = recentes ? LocalDateTime.now(clock).minusDays(RECENTES_DIAS) : null;

        List<ProcessoDescobertoEntity> todos =
                descobertoRepository.findDaPessoaOrdenadoPorDistribuicao(pessoaId);
        return todos.stream()
                .filter(d -> situacao == null || d.getSituacao() == situacao)
                .filter(d -> corte == null
                        || (d.getDataDistribuicao() != null && !d.getDataDistribuicao().isBefore(corte)))
                .map(ProcessoDescobertoResponse::de)
                .toList();
    }

    /**
     * Pessoas marcadas para monitoramento, com os agregados que a tela usa (alertas pendentes,
     * total de descobertos, soma do segredo). Escala atual é de poucas pessoas — duas queries
     * agregadas cobrem tudo sem N+1.
     */
    @Transactional(readOnly = true)
    public List<PessoaMonitoradaResponse> pessoasMonitoradas() {
        Map<Long, Long> alertas = new HashMap<>();
        Map<Long, Long> totais = new HashMap<>();
        for (Object[] linha : descobertoRepository.contarPorPessoaESituacao()) {
            Long pessoaId = (Long) linha[0];
            SituacaoProcessoDescoberto situacao = (SituacaoProcessoDescoberto) linha[1];
            long qtd = ((Number) linha[2]).longValue();
            totais.merge(pessoaId, qtd, Long::sum);
            if (situacao == SituacaoProcessoDescoberto.NOVO) {
                alertas.merge(pessoaId, qtd, Long::sum);
            }
        }
        Map<Long, Long> segredo = new HashMap<>();
        for (Object[] linha : segredoRepository.somaPorPessoa()) {
            segredo.put((Long) linha[0], ((Number) linha[1]).longValue());
        }
        return pessoaRepository.findByMarcadoMonitoramentoTrueOrderByNomeAsc().stream()
                .map(p -> new PessoaMonitoradaResponse(
                        p.getId(),
                        p.getNome(),
                        p.getCpf(),
                        p.getPoloMonitorado(),
                        p.getBaselineEm(),
                        alertas.getOrDefault(p.getId(), 0L),
                        totais.getOrDefault(p.getId(), 0L),
                        segredo.getOrDefault(p.getId(), 0L)))
                .toList();
    }

    /**
     * Histórico de varreduras, mais recentes primeiro, opcionalmente de uma pessoa só.
     * A primeira linha (sem filtro) é a "última varredura" exibida no cabeçalho da tela.
     */
    @Transactional(readOnly = true)
    public List<VarreduraResponse> historicoVarreduras(Long pessoaId, Integer limite) {
        int tamanho = limite == null || limite < 1 ? 100 : Math.min(limite, HISTORICO_LIMITE_MAX);
        PageRequest pagina = PageRequest.of(0, tamanho);
        var varreduras = pessoaId == null
                ? varreduraRepository.findHistorico(pagina)
                : varreduraRepository.findHistoricoDaPessoa(pessoaId, pagina);
        return varreduras.stream().map(VarreduraResponse::de).toList();
    }

    @Transactional(readOnly = true)
    public List<SegredoContagemResponse> segredoDaPessoa(Long pessoaId) {
        exigirPessoa(pessoaId);
        return segredoRepository.findByPessoaId(pessoaId).stream()
                .map(SegredoContagemResponse::de)
                .toList();
    }

    private void exigirPessoa(Long pessoaId) {
        if (!pessoaRepository.existsById(pessoaId)) {
            throw new ResourceNotFoundException("Pessoa não encontrada: " + pessoaId);
        }
    }

    private static SituacaoProcessoDescoberto parseSituacao(String valor) {
        try {
            return SituacaoProcessoDescoberto.valueOf(valor.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BusinessRuleException("Situação inválida: " + valor
                    + " (esperado NOVO, BASELINE, IGNORADO ou VINCULADO).");
        }
    }
}
