package br.com.vilareal.processo.application;

import br.com.vilareal.agenda.application.PrazoAgendaLembreteService;
import br.com.vilareal.agenda.infrastructure.persistence.repository.AgendaEventoRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ProcessoExclusaoService {

    private final JdbcTemplate jdbcTemplate;
    private final ProcessoRepository processoRepository;
    private final AgendaEventoRepository agendaEventoRepository;

    public ProcessoExclusaoService(
            JdbcTemplate jdbcTemplate,
            ProcessoRepository processoRepository,
            AgendaEventoRepository agendaEventoRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.processoRepository = processoRepository;
        this.agendaEventoRepository = agendaEventoRepository;
    }

    @Transactional
    public void excluirPagamentosPorClienteId(Long clienteId) {
        if (clienteId == null || clienteId < 1) {
            return;
        }
        excluirPagamentosVinculados("cliente_id = ?", clienteId);
    }

    @Transactional
    public void excluirPorIds(Collection<Long> processoIds) {
        List<Long> ids = processoIds.stream()
                .filter(Objects::nonNull)
                .filter(id -> id >= 1)
                .distinct()
                .sorted()
                .toList();
        if (ids.isEmpty()) {
            return;
        }

        excluirCalculosRodadasDosProcessos(ids);
        limparAgendaDosProcessos(ids);

        String in = placeholders(ids.size());
        Object[] args = ids.toArray();

        excluirPagamentosVinculados("processo_id IN (" + in + ")", args);

        jdbcTemplate.update(
                """
                UPDATE processo_prazo SET andamento_id = NULL
                WHERE andamento_id IN (
                    SELECT id FROM (
                        SELECT id FROM processo_andamento WHERE processo_id IN (%s)
                    ) tmp
                )
                """
                        .formatted(in),
                args);
        jdbcTemplate.update("DELETE FROM processo_andamento WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update(
                """
                DELETE chp FROM contrato_honorarios_parcela chp
                INNER JOIN contrato_honorarios ch ON ch.id = chp.contrato_honorarios_id
                WHERE ch.processo_id IN (%s)
                """
                        .formatted(in),
                args);
        jdbcTemplate.update("DELETE FROM contrato_honorarios WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM financeiro_lancamento WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM financeiro_lancamento_cartao WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM financeiro_regra_classificacao WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM financeiro_recorrencia_descarte WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM financeiro_semelhante_escritorio_descarte WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM publicacoes WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM tarefa_operacional WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM julia_triagem WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM notificacao_destinatario WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM movimentacao_monitorada WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM consulta_processo_execucao WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM agendamento_consulta WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM whatsapp_messages WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM scheduled_whatsapp_messages WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM imovel_processo WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("UPDATE imovel SET processo_id = NULL WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("UPDATE contrato_locacao SET processo_id = NULL WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update(
                "UPDATE imovel_vinculo_locatario SET processo_id = NULL WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM processo_prazo WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update(
                """
                DELETE ppa FROM processo_parte_advogado ppa
                INNER JOIN processo_parte pp ON pp.id = ppa.processo_parte_id
                WHERE pp.processo_id IN (%s)
                """
                        .formatted(in),
                args);
        jdbcTemplate.update("DELETE FROM processo_parte WHERE processo_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM processo WHERE id IN (" + in + ")", args);
    }

    private void excluirCalculosRodadasDosProcessos(List<Long> ids) {
        for (Long id : ids) {
            processoRepository.findById(id).ifPresent(p -> {
                if (p.getCliente() == null
                        || !StringUtils.hasText(p.getCliente().getCodigoCliente())
                        || p.getNumeroInterno() == null) {
                    return;
                }
                jdbcTemplate.update(
                        "DELETE FROM calculo_rodada WHERE TRIM(codigo_cliente) = TRIM(?) AND numero_processo = ?",
                        p.getCliente().getCodigoCliente(),
                        p.getNumeroInterno());
            });
        }
    }

    private void limparAgendaDosProcessos(List<Long> ids) {
        Set<String> refs = new LinkedHashSet<>();
        for (ProcessoEntity processo : processoRepository.findAllById(ids)) {
            String ref = PrazoAgendaLembreteService.montarProcessoRef(processo);
            if (StringUtils.hasText(ref)) {
                refs.add(ref.trim());
            }
        }
        for (String ref : refs) {
            agendaEventoRepository.deleteByProcessoRefAndOrigem(ref, "processos-audiencia");
            agendaEventoRepository.deleteByProcessoRefAndOrigem(ref, "processos-prazo-lembrete");
        }
    }

    private void excluirPagamentosVinculados(String whereSql, Object... args) {
        List<Long> pagamentoIds = jdbcTemplate.queryForList(
                "SELECT id FROM pagamento WHERE " + whereSql, Long.class, args);
        excluirPagamentosPorIds(pagamentoIds);
    }

    private void excluirPagamentosPorIds(Collection<Long> pagamentoIds) {
        List<Long> ids = pagamentoIds.stream()
                .filter(Objects::nonNull)
                .filter(id -> id >= 1)
                .distinct()
                .sorted()
                .toList();
        if (ids.isEmpty()) {
            return;
        }

        String in = placeholders(ids.size());
        Object[] args = ids.toArray();

        jdbcTemplate.update(
                "UPDATE contrato_honorarios_parcela SET pagamento_id = NULL WHERE pagamento_id IN (" + in + ")",
                args);
        jdbcTemplate.update("UPDATE demanda_cards SET pagamento_id = NULL WHERE pagamento_id IN (" + in + ")", args);
        jdbcTemplate.update("UPDATE iptu_parcela SET pagamento_id = NULL WHERE pagamento_id IN (" + in + ")", args);
        jdbcTemplate.update(
                """
                UPDATE pagamento SET recorrencia_pagamento_origem_id = NULL, substituido_por_pagamento_id = NULL
                WHERE recorrencia_pagamento_origem_id IN (%s) OR substituido_por_pagamento_id IN (%s)
                """
                        .formatted(in, in),
                concatArgs(args, args));
        jdbcTemplate.update("DELETE FROM pagamento_historico WHERE pagamento_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM prestacao_contas_pagamento WHERE pagamento_id IN (" + in + ")", args);
        jdbcTemplate.update("DELETE FROM pagamento WHERE id IN (" + in + ")", args);
    }

    private static Object[] concatArgs(Object[] first, Object[] second) {
        List<Object> merged = new ArrayList<>(first.length + second.length);
        for (Object value : first) {
            merged.add(value);
        }
        for (Object value : second) {
            merged.add(value);
        }
        return merged.toArray();
    }

    private static String placeholders(int size) {
        return java.util.stream.IntStream.range(0, size)
                .mapToObj(i -> "?")
                .collect(Collectors.joining(","));
    }
}
