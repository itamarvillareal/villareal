package br.com.vilareal.financeiro.domain;

import br.com.vilareal.calculo.application.CalculoApplicationService;
import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoRodadaEntity;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Cruza lançamentos pendentes com parcelas de Cálculos (parcelamento aceito):
 * valor exato + data do lançamento = vencimento ou vencimento + 1 dia.
 */
public final class SemelhanteEscritorioCalculoMatcher {

    private static final DateTimeFormatter BR = DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.ROOT);

    private SemelhanteEscritorioCalculoMatcher() {}

    public record ParcelaVinculo(
            Long clienteId,
            Long processoId,
            String codigoCliente,
            Integer numeroProcesso,
            Integer dimensao,
            int indiceParcela,
            LocalDate dataVencimento,
            long valorCentavos) {}

    public static List<SemelhanteEscritorioMatcher.MatchResult> parear(
            List<SemelhanteEscritorioMatcher.PendenteItem> pendentes,
            List<CalculoRodadaEntity> rodadas,
            Map<String, Long> clienteIdPorCodigo,
            Map<String, Long> processoIdPorClienteProc) {
        if (pendentes == null || pendentes.isEmpty() || rodadas == null || rodadas.isEmpty()) {
            return List.of();
        }

        Map<Long, List<ParcelaVinculo>> porValor = indexarParcelas(rodadas, clienteIdPorCodigo, processoIdPorClienteProc);
        if (porValor.isEmpty()) {
            return List.of();
        }

        List<SemelhanteEscritorioMatcher.MatchResult> out = new ArrayList<>();
        for (SemelhanteEscritorioMatcher.PendenteItem p : pendentes) {
            if (p == null || p.lancamentoId() == null || p.valor() == null || p.dataLancamento() == null) {
                continue;
            }
            long centavos = valorCentavos(p.valor());
            if (centavos <= 0) {
                continue;
            }
            List<ParcelaVinculo> candidatos = porValor.getOrDefault(centavos, List.of());
            ParcelaVinculo hit = escolherMelhor(candidatos, p.dataLancamento());
            if (hit == null) {
                continue;
            }
            String regra = montarRegra(hit, p.dataLancamento());
            out.add(SemelhanteEscritorioMatcher.MatchResult.calculo(
                    p,
                    hit.clienteId(),
                    hit.processoId(),
                    regra));
        }
        return out;
    }

    static Map<Long, List<ParcelaVinculo>> indexarParcelas(
            List<CalculoRodadaEntity> rodadas,
            Map<String, Long> clienteIdPorCodigo,
            Map<String, Long> processoIdPorClienteProc) {
        Map<Long, List<ParcelaVinculo>> out = new HashMap<>();
        for (CalculoRodadaEntity rodada : rodadas) {
            if (rodada == null || !rodada.isParcelamentoAceito()) {
                continue;
            }
            JsonNode payload = rodada.getPayloadJson();
            if (payload == null || !payload.isObject()) {
                continue;
            }
            Long clienteId = clienteIdPorCodigo.get(normalizarCod8(rodada.getCodigoCliente()));
            if (clienteId == null) {
                continue;
            }
            String procKey = clienteId + "|" + rodada.getNumeroProcesso();
            Long processoId = processoIdPorClienteProc.get(procKey);
            if (processoId == null) {
                continue;
            }

            JsonNode parcelasNode = payload.get("parcelas");
            if (parcelasNode == null || !parcelasNode.isArray()) {
                continue;
            }
            int limite = lerQuantidadeParcelas(payload, parcelasNode.size());
            for (int i = 0; i < limite && i < parcelasNode.size(); i++) {
                JsonNode par = parcelasNode.get(i);
                if (par == null || !par.isObject()) {
                    continue;
                }
                LocalDate venc = parseDataBR(CalculoApplicationService.normalizaDataVencimento(
                        par.path("dataVencimento").asText("")));
                long centavos = CalculoApplicationService.parseValorInicialParaCentavos(
                        par.path("valorParcela").asText(""));
                if (venc == null || centavos <= 0) {
                    continue;
                }
                ParcelaVinculo v = new ParcelaVinculo(
                        clienteId,
                        processoId,
                        normalizarCod8(rodada.getCodigoCliente()),
                        rodada.getNumeroProcesso(),
                        rodada.getDimensao(),
                        i + 1,
                        venc,
                        centavos);
                out.computeIfAbsent(centavos, k -> new ArrayList<>()).add(v);
            }
        }
        return out;
    }

    private static ParcelaVinculo escolherMelhor(List<ParcelaVinculo> candidatos, LocalDate dataLancamento) {
        ParcelaVinculo exato = null;
        ParcelaVinculo dPlus1 = null;
        for (ParcelaVinculo c : candidatos) {
            if (c.dataVencimento().equals(dataLancamento)) {
                exato = c;
                break;
            }
            if (c.dataVencimento().plusDays(1).equals(dataLancamento)) {
                dPlus1 = c;
            }
        }
        return exato != null ? exato : dPlus1;
    }

    private static String montarRegra(ParcelaVinculo hit, LocalDate dataLancamento) {
        boolean mesmoDia = hit.dataVencimento().equals(dataLancamento);
        return "Cálculos dim. "
                + hit.dimensao()
                + ", parcela "
                + hit.indiceParcela()
                + " ("
                + hit.dataVencimento().format(BR)
                + (mesmoDia ? ", mesmo dia" : ", D+1")
                + ")";
    }

    private static int lerQuantidadeParcelas(JsonNode payload, int tamanhoArray) {
        JsonNode q = payload.get("quantidadeParcelasInformada");
        if (q == null || q.isNull()) {
            return tamanhoArray;
        }
        String digits = q.asText("").replaceAll("\\D", "");
        if (digits.isEmpty()) {
            return tamanhoArray;
        }
        try {
            int n = Integer.parseInt(digits);
            return n > 0 ? Math.min(n, tamanhoArray) : tamanhoArray;
        } catch (NumberFormatException e) {
            return tamanhoArray;
        }
    }

    static LocalDate parseDataBR(String br) {
        if (!StringUtils.hasText(br)) {
            return null;
        }
        try {
            return LocalDate.parse(br.trim(), BR);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    static long valorCentavos(BigDecimal valor) {
        if (valor == null) {
            return 0L;
        }
        return valor.setScale(2, RoundingMode.HALF_UP).movePointRight(2).longValue();
    }

    public static String normalizarCod8(String cod) {
        if (!StringUtils.hasText(cod)) {
            return "";
        }
        String d = cod.replaceAll("\\D", "");
        if (d.isEmpty()) {
            return "";
        }
        return String.format(Locale.ROOT, "%08d", Long.parseLong(d));
    }

    static String chaveProcesso(Long clienteId, Integer numeroProcesso) {
        return clienteId + "|" + numeroProcesso;
    }

    public static void registrarProcesso(Map<String, Long> map, Long clienteId, Integer numeroProcesso, Long processoId) {
        if (clienteId != null && numeroProcesso != null && processoId != null) {
            map.put(chaveProcesso(clienteId, numeroProcesso), processoId);
        }
    }

    public static Set<String> codigosUnicos(List<CalculoRodadaEntity> rodadas) {
        return rodadas.stream()
                .map(CalculoRodadaEntity::getCodigoCliente)
                .filter(StringUtils::hasText)
                .map(SemelhanteEscritorioCalculoMatcher::normalizarCod8)
                .filter(StringUtils::hasText)
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
    }
}
