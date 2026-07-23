package br.com.vilareal.calculo.application;

import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoIndiceMensalEntity;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoIndiceMensalRepository;
import br.com.vilareal.common.exception.BusinessRuleException;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.net.URI;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Séries mensais (% variação/rentabilidade) dos índices usados nos Cálculos.
 *
 * <p>Fonte: SGS/BCB, com <b>persistência</b> em {@code calculo_indice_mensal} (read-through:
 * competências já publicadas são gravadas no banco e nunca refeitas — índice publicado não muda).
 * O mapeamento de séries foi conferido contra os txt legados do Dropbox («Banco de Dados/Índices»):</p>
 *
 * <ul>
 *   <li>INPC → 1649 (paridade com {@code monetaryIndicesService.js} — o front aplica escala do legado VBA)</li>
 *   <li>IPCA → 433 (paridade com o relatório legado)</li>
 *   <li>IPCA-E → 7478 (IPCA-15 mensal — é o que os txt legados «ipca-e» contêm)</li>
 *   <li>IGPM → 189 (bate com os txt legados)</li>
 *   <li>SELIC → 4390 (Selic acumulada no mês)</li>
 *   <li>CDI → 4391 (CDI acumulado no mês — bate com os txt legados)</li>
 *   <li>TR → 7811 (TR mensal — bate 100% com os txt legados)</li>
 *   <li>POUPANCA → 196 com defasagem de +1 mês (rendimento creditado no mês seguinte — regra do legado)</li>
 * </ul>
 */
@Service
public class CalculoIndicesBcbService {

    private static final Logger log = LoggerFactory.getLogger(CalculoIndicesBcbService.class);

    private static final DateTimeFormatter BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final ZoneId ZONA_SP = ZoneId.of("America/Sao_Paulo");

    /** Nome canônico → (código SGS, defasagem em meses da competência em relação à data SGS). */
    private record SerieSgs(int codigo, int shiftMeses) {}

    private static final Map<String, SerieSgs> SERIES = Map.of(
            "INPC", new SerieSgs(1649, 0),
            "IPCA", new SerieSgs(433, 0),
            "IPCA-E", new SerieSgs(7478, 0),
            "IGPM", new SerieSgs(189, 0),
            "SELIC", new SerieSgs(4390, 0),
            "CDI", new SerieSgs(4391, 0),
            "TR", new SerieSgs(7811, 0),
            "POUPANCA", new SerieSgs(196, 1));

    private final RestClient bcbSgsRestClient;
    private final CalculoIndiceMensalRepository repository;
    private final Clock clock;

    public CalculoIndicesBcbService(
            RestClient bcbSgsRestClient, CalculoIndiceMensalRepository repository, Clock clock) {
        this.bcbSgsRestClient = bcbSgsRestClient;
        this.repository = repository;
        this.clock = clock;
    }

    /** Nomes canônicos suportados (chave de persistência). */
    public static List<String> indicesSuportados() {
        return List.of("INPC", "IPCA", "IPCA-E", "IGPM", "SELIC", "CDI", "TR", "POUPANCA");
    }

    /**
     * Série mensal no intervalo, chaves {@code yyyy-MM}; contém <b>apenas competências publicadas</b>
     * (os consumidores tratam ausência como 0 — evita cachear 0 para mês ainda não divulgado).
     * Competências publicadas e ausentes no banco são buscadas no BCB e gravadas.
     */
    public Map<String, BigDecimal> obterIndicesMensais(String indice, LocalDate dataInicial, LocalDate dataFinal) {
        if (dataInicial == null || dataFinal == null) {
            throw new BusinessRuleException("dataInicial e dataFinal são obrigatórias");
        }
        if (dataFinal.isBefore(dataInicial)) {
            return Map.of();
        }
        String canonico = nomeCanonico(indice);
        YearMonth startYm = YearMonth.from(dataInicial);
        YearMonth endYm = YearMonth.from(dataFinal);

        Map<String, BigDecimal> result = new LinkedHashMap<>();
        Map<String, BigDecimal> persistidos = carregarPersistidos(canonico, startYm, endYm);

        // Regra de disponibilidade do legado: nova competência só é esperada após o dia 10 do mês seguinte.
        YearMonth ultimaEsperada = ultimaCompetenciaEsperada();
        YearMonth faltanteInicio = null;
        YearMonth faltanteFim = null;
        for (YearMonth ym = startYm; !ym.isAfter(endYm); ym = ym.plusMonths(1)) {
            if (ym.isAfter(ultimaEsperada) || persistidos.containsKey(ym.toString())) {
                continue;
            }
            if (faltanteInicio == null) {
                faltanteInicio = ym;
            }
            faltanteFim = ym;
        }

        Map<String, BigDecimal> buscados = faltanteInicio == null
                ? Map.of()
                : buscarEPersistir(canonico, faltanteInicio, faltanteFim);

        for (YearMonth ym = startYm; !ym.isAfter(endYm); ym = ym.plusMonths(1)) {
            String mk = ym.toString();
            BigDecimal v = persistidos.getOrDefault(mk, buscados.get(mk));
            if (v != null) {
                result.put(mk, v);
            }
        }
        return result;
    }

    /**
     * Garante a competência do mês anterior (se já esperada) para todos os índices.
     * Usada pelo job automático. Retorna quantidade de índices com o mês anterior disponível.
     */
    public int garantirMesAnteriorTodosIndices() {
        YearMonth mesAnterior = YearMonth.now(clock.withZone(ZONA_SP)).minusMonths(1);
        LocalDate inicio = mesAnterior.atDay(1);
        LocalDate fim = mesAnterior.atEndOfMonth();
        int disponiveis = 0;
        for (String indice : indicesSuportados()) {
            try {
                Map<String, BigDecimal> serie = obterIndicesMensais(indice, inicio, fim);
                if (serie.containsKey(mesAnterior.toString())) {
                    disponiveis++;
                } else {
                    log.info("[indices-mensais] {} {} ainda não publicado no BCB.", indice, mesAnterior);
                }
            } catch (Exception e) {
                log.warn("[indices-mensais] Falha ao atualizar {} {}: {}", indice, mesAnterior, e.getMessage());
            }
        }
        return disponiveis;
    }

    private Map<String, BigDecimal> carregarPersistidos(String indice, YearMonth de, YearMonth ate) {
        Map<String, BigDecimal> map = new HashMap<>();
        for (CalculoIndiceMensalEntity e :
                repository.findByIndiceAndCompetenciaBetween(indice, de.toString(), ate.toString())) {
            map.put(e.getCompetencia(), e.getValor());
        }
        return map;
    }

    /**
     * Busca no BCB o intervalo de competências e persiste o que veio publicado.
     * Para séries com defasagem (poupança), a janela SGS é deslocada de acordo.
     */
    private Map<String, BigDecimal> buscarEPersistir(String indice, YearMonth de, YearMonth ate) {
        SerieSgs serie = SERIES.get(indice);
        YearMonth fetchStartYm = de.minusMonths(serie.shiftMeses());
        YearMonth fetchEndYm = ate.minusMonths(serie.shiftMeses());

        URI uri = UriComponentsBuilder.fromPath("/dados/serie/bcdata.sgs." + serie.codigo() + "/dados")
                .queryParam("formato", "json")
                .queryParam("dataInicial", BR.format(fetchStartYm.atDay(1)))
                .queryParam("dataFinal", BR.format(fetchEndYm.atEndOfMonth()))
                .build()
                .toUri();

        JsonNode arr = bcbSgsRestClient.get()
                .uri(uri)
                .retrieve()
                .body(JsonNode.class);

        Map<String, BigDecimal> buscados = new LinkedHashMap<>();
        if (arr != null && arr.isArray()) {
            for (JsonNode row : arr) {
                YearMonth ymSgs = parseCompetenciaSgs(row.path("data").asText(""));
                if (ymSgs == null) {
                    continue;
                }
                YearMonth competencia = ymSgs.plusMonths(serie.shiftMeses());
                if (competencia.isBefore(de) || competencia.isAfter(ate)) {
                    continue;
                }
                buscados.put(competencia.toString(), parseBcbValor(row.path("valor").asText()));
            }
        }

        List<CalculoIndiceMensalEntity> novos = new ArrayList<>();
        for (Map.Entry<String, BigDecimal> e : buscados.entrySet()) {
            CalculoIndiceMensalEntity entity = new CalculoIndiceMensalEntity();
            entity.setIndice(indice);
            entity.setCompetencia(e.getKey());
            entity.setValor(e.getValue());
            novos.add(entity);
        }
        try {
            repository.saveAll(novos);
        } catch (DataIntegrityViolationException e) {
            // Corrida com o job/outra requisição: as competências já foram gravadas — seguro ignorar.
            log.debug("[indices-mensais] Competências de {} já persistidas em paralelo.", indice);
        }
        return buscados;
    }

    /** Paridade com o front: antes do dia 10, o mês anterior pode ainda não estar publicado. */
    private YearMonth ultimaCompetenciaEsperada() {
        LocalDate hoje = LocalDate.now(clock.withZone(ZONA_SP));
        int offsetMeses = hoje.getDayOfMonth() >= 10 ? 1 : 2;
        return YearMonth.from(hoje).minusMonths(offsetMeses);
    }

    private static YearMonth parseCompetenciaSgs(String dataBr) {
        String ds = dataBr == null ? "" : dataBr.trim();
        String[] parts = ds.split("/");
        if (parts.length != 3) {
            return null;
        }
        try {
            int mm = Integer.parseInt(parts[1]);
            int yyyy = Integer.parseInt(parts[2]);
            return YearMonth.of(yyyy, mm);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Normaliza nome vindo do front (POUPANÇA→POUPANCA, IPCAE→IPCA-E, IGP-M→IGPM). */
    static String nomeCanonico(String indice) {
        if (indice == null) {
            throw new BusinessRuleException("índice é obrigatório");
        }
        String u = indice.trim().toUpperCase().replace('Ç', 'C');
        u = switch (u) {
            case "IPCAE" -> "IPCA-E";
            case "IGP-M" -> "IGPM";
            default -> u;
        };
        if (!SERIES.containsKey(u)) {
            throw new BusinessRuleException(
                    "Índice não suportado. Use INPC, IPCA, IPCA-E, IGPM, SELIC, CDI, TR ou POUPANCA");
        }
        return u;
    }

    private static BigDecimal parseBcbValor(String raw) {
        if (raw == null || raw.isBlank()) {
            return BigDecimal.ZERO;
        }
        String s = raw.trim();
        boolean hasComma = s.contains(",");
        boolean hasDot = s.contains(".");
        String normalized;
        if (hasComma && hasDot) {
            normalized = s.replace(".", "").replace(",", ".");
        } else if (hasComma) {
            normalized = s.replace(",", ".");
        } else {
            normalized = s;
        }
        try {
            return new BigDecimal(normalized);
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }
}
