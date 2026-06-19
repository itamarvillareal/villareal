package br.com.vilareal.financeiro.domain;

import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoRodadaEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class SemelhanteEscritorioCalculoMatcherTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    void parear_valorEDataVencimento_sugereAltaConfianca() throws Exception {
        CalculoRodadaEntity rodada = rodadaComParcela("00000728", 1345, "05/06/2026", "R$ 195,80");
        var pend = List.of(pendente(1L, LocalDate.of(2026, 6, 5), new BigDecimal("195.80")));

        var matches = SemelhanteEscritorioCalculoMatcher.parear(
                pend,
                List.of(rodada),
                Map.of("00000728", 99L),
                Map.of("99|1345", 1345L));

        assertThat(matches).hasSize(1);
        assertThat(matches.get(0).origem()).isEqualTo(SemelhanteEscritorioOrigem.CALCULO_PARCELA);
        assertThat(matches.get(0).confianca()).isEqualTo(ConfiancaSugestao.ALTA);
        assertThat(matches.get(0).sugestaoClienteId()).isEqualTo(99L);
        assertThat(matches.get(0).sugestaoProcessoId()).isEqualTo(1345L);
    }

    @Test
    void parear_valorEDataDPlus1_sugereAltaConfianca() throws Exception {
        CalculoRodadaEntity rodada = rodadaComParcela("00000728", 1345, "05/06/2026", "R$ 195,80");
        var pend = List.of(pendente(2L, LocalDate.of(2026, 6, 6), new BigDecimal("195.80")));

        var matches = SemelhanteEscritorioCalculoMatcher.parear(
                pend,
                List.of(rodada),
                Map.of("00000728", 99L),
                Map.of("99|1345", 1345L));

        assertThat(matches).hasSize(1);
        assertThat(matches.get(0).descricaoRegra()).contains("D+1");
    }

    @Test
    void parear_valorDiferente_naoSugere() throws Exception {
        CalculoRodadaEntity rodada = rodadaComParcela("00000728", 1345, "05/06/2026", "R$ 195,80");
        var pend = List.of(pendente(3L, LocalDate.of(2026, 6, 6), new BigDecimal("200.00")));

        var matches = SemelhanteEscritorioCalculoMatcher.parear(
                pend,
                List.of(rodada),
                Map.of("00000728", 99L),
                Map.of("99|1345", 1345L));

        assertThat(matches).isEmpty();
    }

    private static CalculoRodadaEntity rodadaComParcela(
            String cod8, int proc, String venc, String valor) throws Exception {
        ObjectNode payload = JSON.createObjectNode();
        payload.put("parcelamentoAceito", true);
        payload.put("quantidadeParcelasInformada", "1");
        var parcelas = JSON.createArrayNode();
        ObjectNode p = JSON.createObjectNode();
        p.put("dataVencimento", venc);
        p.put("valorParcela", valor);
        parcelas.add(p);
        payload.set("parcelas", parcelas);

        CalculoRodadaEntity e = new CalculoRodadaEntity();
        e.setCodigoCliente(cod8);
        e.setNumeroProcesso(proc);
        e.setDimensao(1);
        e.setParcelamentoAceito(true);
        e.setPayloadJson(payload);
        return e;
    }

    private static SemelhanteEscritorioMatcher.PendenteItem pendente(Long id, LocalDate data, BigDecimal valor) {
        return new SemelhanteEscritorioMatcher.PendenteItem(
                id, data, "PIX FRANCISCO JEFFERSON", "pix francisco jefferson", valor, 756, "Sicoob");
    }
}
