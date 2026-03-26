package br.com.vilareal.calculo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.net.URI;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Variação mensal percentual (SGS) — paridade com {@code monetaryIndicesService.js}.
 */
@Service
public class CalculoIndicesBcbService {

    private static final DateTimeFormatter BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final RestClient bcbSgsRestClient;

    public CalculoIndicesBcbService(RestClient bcbSgsRestClient) {
        this.bcbSgsRestClient = bcbSgsRestClient;
    }

    public Map<String, BigDecimal> obterIndicesMensais(String indice, LocalDate dataInicial, LocalDate dataFinal) {
        if (dataInicial == null || dataFinal == null) {
            throw new BusinessRuleException("dataInicial e dataFinal são obrigatórias");
        }
        if (dataFinal.isBefore(dataInicial)) {
            return Map.of();
        }
        int series = codigoSerie(indice);
        YearMonth startYm = YearMonth.from(dataInicial.withDayOfMonth(1));
        YearMonth endYm = YearMonth.from(dataFinal.withDayOfMonth(1));

        Map<String, BigDecimal> result = new LinkedHashMap<>();
        for (YearMonth ym = startYm; !ym.isAfter(endYm); ym = ym.plusMonths(1)) {
            result.put(ym.toString(), BigDecimal.ZERO);
        }

        LocalDate fetchStart = startYm.atDay(1);
        LocalDate fetchEnd = dataFinal;

        URI uri = UriComponentsBuilder.fromPath("/dados/serie/bcdata.sgs." + series + "/dados")
                .queryParam("formato", "json")
                .queryParam("dataInicial", BR.format(fetchStart))
                .queryParam("dataFinal", BR.format(fetchEnd))
                .build()
                .toUri();

        JsonNode arr = bcbSgsRestClient.get()
                .uri(uri)
                .retrieve()
                .body(JsonNode.class);

        if (arr != null && arr.isArray()) {
            for (JsonNode row : arr) {
                String ds = row.path("data").asText("").trim();
                if (ds.length() < 10) {
                    continue;
                }
                String[] parts = ds.split("/");
                if (parts.length != 3) {
                    continue;
                }
                int dd = Integer.parseInt(parts[0]);
                int mm = Integer.parseInt(parts[1]);
                int yyyy = Integer.parseInt(parts[2]);
                LocalDate d = LocalDate.of(yyyy, mm, dd);
                String mk = YearMonth.from(d).toString();
                if (result.containsKey(mk)) {
                    result.put(mk, parseBcbValor(row.path("valor").asText()));
                }
            }
        }

        return result;
    }

    private static int codigoSerie(String indice) {
        if (indice == null) {
            throw new BusinessRuleException("índice é obrigatório");
        }
        String u = indice.trim().toUpperCase().replace('Ç', 'C');
        if ("INPC".equals(u)) {
            return 1649;
        }
        if ("IPCA".equals(u) || "IPCA-E".equals(u) || "IPCAE".equals(u)) {
            return 433;
        }
        throw new BusinessRuleException("Índice não suportado. Use INPC, IPCA ou IPCA-E");
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
