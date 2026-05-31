package br.com.vilareal.projudi;

import br.com.vilareal.processo.application.ProcessoDiagnosticoNumeroBuscaUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigInteger;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** TEMP — diagnóstico read-only da seleção automática PROJUDI. */
@Service
public class ProjudiSelecaoAutomaticaDiagnosticoService {

    static final String JPQL_FIND_PARA_CONSULTA_AUTOMATICA_PROJUDI = """
            SELECT p FROM ProcessoEntity p
            LEFT JOIN FETCH p.cliente
            LEFT JOIN FETCH p.pessoa
            WHERE p.consultaAutomatica = true
              AND p.ativo = true
              AND p.numeroCnj IS NOT NULL
              AND TRIM(p.numeroCnj) <> ''
              AND UPPER(TRIM(p.uf)) = 'GO'
            ORDER BY p.proximaConsulta ASC, p.id ASC
            """;

    private static final List<String> FILTROS_APLICADOS = List.of(
            "consulta_automatica = true",
            "ativo = true",
            "numero_cnj IS NOT NULL e TRIM(numero_cnj) <> ''",
            "UPPER(TRIM(uf)) = 'GO'");

    private static final List<String> FILTROS_NAO_APLICADOS = List.of(
            "proxima_consulta (não filtra — só ORDER BY ASC)",
            "tramitacao",
            "cidade",
            "fase");

    private final ProcessoRepository processoRepository;

    public ProjudiSelecaoAutomaticaDiagnosticoService(ProcessoRepository processoRepository) {
        this.processoRepository = processoRepository;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> diagnosticar(String numeroCnjOpcional) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("queryJpql", JPQL_FIND_PARA_CONSULTA_AUTOMATICA_PROJUDI.trim());
        out.put("filtrosAplicados", FILTROS_APLICADOS);
        out.put("filtrosNaoAplicados", FILTROS_NAO_APLICADOS);

        List<ProcessoEntity> selecionados = processoRepository.findParaConsultaAutomaticaProjudi(Pageable.unpaged());
        List<Map<String, Object>> itens = selecionados.stream().map(this::resumoProcesso).toList();
        Map<String, Object> blocoSelecionados = new LinkedHashMap<>();
        blocoSelecionados.put("total", itens.size());
        blocoSelecionados.put("itens", itens);
        out.put("selecionados", blocoSelecionados);

        if (StringUtils.hasText(numeroCnjOpcional)) {
            out.put("processoConsultado", diagnosticarProcessoInformado(numeroCnjOpcional.trim()));
        }

        return out;
    }

    private Map<String, Object> diagnosticarProcessoInformado(String cnj) {
        Map<String, Object> bloco = new LinkedHashMap<>();
        Optional<ProcessoEntity> processoOpt = buscarProcessoPorCnj(cnj);
        if (processoOpt.isEmpty()) {
            bloco.put("encontrado", false);
            bloco.put("numeroInformado", cnj);
            bloco.put("motivosExclusao", List.of("processo não encontrado no cadastro local por CNJ normalizado"));
            return bloco;
        }

        ProcessoEntity p = processoOpt.get();
        bloco.put("encontrado", true);
        bloco.putAll(resumoProcessoConsultado(p));
        bloco.put("motivosExclusao", motivosExclusaoQuery(p));
        bloco.put("elegivelPelaQuery", ((List<?>) bloco.get("motivosExclusao")).isEmpty());
        return bloco;
    }

    private Optional<ProcessoEntity> buscarProcessoPorCnj(String cnj) {
        String norm = ProcessoDiagnosticoNumeroBuscaUtil.normalizarSomenteDigitos(cnj);
        if (norm.isEmpty()) {
            return Optional.empty();
        }
        List<BigInteger> ids = processoRepository.findIdsByNumeroCnjNormalizadoDiagnostico(norm);
        if (ids.isEmpty()) {
            return Optional.empty();
        }
        return processoRepository.findByIdWithClienteAndPessoa(ids.getFirst().longValue());
    }

    private static List<String> motivosExclusaoQuery(ProcessoEntity p) {
        List<String> motivos = new ArrayList<>();
        if (!Boolean.TRUE.equals(p.getConsultaAutomatica())) {
            motivos.add("consultaAutomatica=false (valor="
                    + (p.getConsultaAutomatica() == null ? "null" : p.getConsultaAutomatica()) + ")");
        }
        if (!Boolean.TRUE.equals(p.getAtivo())) {
            motivos.add("ativo=false (valor=" + (p.getAtivo() == null ? "null" : p.getAtivo()) + ")");
        }
        if (!StringUtils.hasText(p.getNumeroCnj()) || p.getNumeroCnj().trim().isEmpty()) {
            motivos.add("numeroCnj vazio ou null");
        }
        String ufNorm = p.getUf() == null ? "" : p.getUf().trim().toUpperCase();
        if (!"GO".equals(ufNorm)) {
            motivos.add("uf != GO (valor=" + (p.getUf() == null ? "null" : p.getUf()) + ")");
        }
        return motivos;
    }

    private Map<String, Object> resumoProcesso(ProcessoEntity p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("numeroCnj", p.getNumeroCnj());
        m.put("consultaAutomatica", p.getConsultaAutomatica());
        m.put("uf", p.getUf());
        m.put("cidade", p.getCidade());
        m.put("proximaConsulta", formatLocalDate(p.getProximaConsulta()));
        return m;
    }

    private Map<String, Object> resumoProcessoConsultado(ProcessoEntity p) {
        Map<String, Object> m = resumoProcesso(p);
        m.put("tramitacao", p.getTramitacao());
        m.put("ativo", p.getAtivo());
        return m;
    }

    private static String formatLocalDate(LocalDate d) {
        return d == null ? null : d.toString();
    }
}
