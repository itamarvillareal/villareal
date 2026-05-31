package br.com.vilareal.projudi;

import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** TEMP — apaga publicações PROJUDI para reprocessamento em testes. Remover antes de produção. */
@Service
public class ProjudiPublicacaoLimpezaDiagnosticoService {

    private static final String ORIGEM_PROJUDI = "PROJUDI";

    private final PublicacaoRepository publicacaoRepository;
    private final ProcessoRepository processoRepository;

    public ProjudiPublicacaoLimpezaDiagnosticoService(
            PublicacaoRepository publicacaoRepository, ProcessoRepository processoRepository) {
        this.publicacaoRepository = publicacaoRepository;
        this.processoRepository = processoRepository;
    }

    @Transactional
    public Map<String, Object> apagarPublicacoesProjudi(String idsCsv, String numeroCnj) {
        if (StringUtils.hasText(idsCsv)) {
            return apagarPorIds(idsCsv);
        }
        if (StringUtils.hasText(numeroCnj)) {
            return apagarPorNumeroCnj(numeroCnj.trim());
        }
        throw new IllegalArgumentException("Informe ids ou numero.");
    }

    private Map<String, Object> apagarPorIds(String idsCsv) {
        List<Long> solicitados = parseIdsCsv(idsCsv);
        if (solicitados.isEmpty()) {
            return montarResposta(List.of(), List.of(), List.of());
        }

        Map<Long, PublicacaoEntity> encontradas = publicacaoRepository.findAllById(solicitados).stream()
                .collect(Collectors.toMap(PublicacaoEntity::getId, p -> p, (a, b) -> a, LinkedHashMap::new));

        List<Long> apagados = new ArrayList<>();
        List<Long> ignoradosNaoProjudi = new ArrayList<>();
        for (Long id : solicitados) {
            PublicacaoEntity pub = encontradas.get(id);
            if (pub == null) {
                continue;
            }
            if (ORIGEM_PROJUDI.equals(pub.getOrigemImportacao())) {
                apagados.add(id);
            } else {
                ignoradosNaoProjudi.add(id);
            }
        }

        if (!apagados.isEmpty()) {
            publicacaoRepository.deleteByIdInAndOrigemImportacaoProjudi(apagados);
        }
        return montarResposta(solicitados, apagados, ignoradosNaoProjudi);
    }

    private Map<String, Object> apagarPorNumeroCnj(String numeroCnj) {
        String norm = somenteDigitos(numeroCnj);
        if (!StringUtils.hasText(norm)) {
            throw new IllegalArgumentException("numero CNJ inválido.");
        }

        List<Long> processoIds = processoRepository.findIdsByNumeroCnjNormalizadoDiagnostico(norm).stream()
                .map(BigInteger::longValue)
                .toList();
        if (processoIds.isEmpty()) {
            return montarResposta(List.of(), List.of(), List.of());
        }

        List<Long> solicitados = publicacaoRepository
                .findByProcesso_IdInAndOrigemImportacaoProjudi(processoIds)
                .stream()
                .map(PublicacaoEntity::getId)
                .toList();
        if (solicitados.isEmpty()) {
            return montarResposta(List.of(), List.of(), List.of());
        }

        publicacaoRepository.deleteByIdInAndOrigemImportacaoProjudi(solicitados);
        return montarResposta(solicitados, solicitados, List.of());
    }

    private static Map<String, Object> montarResposta(
            List<Long> solicitados, List<Long> apagados, List<Long> ignoradosNaoProjudi) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("solicitados", solicitados);
        out.put("apagados", apagados);
        out.put("ignoradosNaoProjudi", ignoradosNaoProjudi);
        out.put("total", apagados.size());
        return out;
    }

    private static List<Long> parseIdsCsv(String idsCsv) {
        Set<Long> ids = new LinkedHashSet<>();
        for (String parte : idsCsv.split(",")) {
            if (!StringUtils.hasText(parte)) {
                continue;
            }
            ids.add(Long.parseLong(parte.trim()));
        }
        return List.copyOf(ids);
    }

    private static String somenteDigitos(String s) {
        if (s == null) {
            return "";
        }
        return s.replaceAll("\\D", "");
    }
}
