package br.com.vilareal.financeiro.ofx;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OfxParserTest {

    private static final String OFX_CORA_MINI =
            """
            OFXHEADER:100
            DATA:OFXSGML
            VERSION:102
            ENCODING:UTF-8
            CHARSET:1252

            <OFX>
            <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20260204120000[-3:BRT]
            <TRNAMT>120.00
            <FITID>CORA202602041200001</FITID>
            <MEMO>Recebimento Pix</MEMO>
            </STMTTRN>
            <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20260206120000[-3:BRT]
            <TRNAMT>-75.00
            <FITID>CORA202602061200002</FITID>
            <NAME>BOLETO</NAME>
            </STMTTRN>
            </OFX>
            """;

    @Test
    void parseTransacoes_extraiFitIdDataValor() {
        List<OfxParser.OfxTransacao> txs = OfxParser.parseTransacoes(OFX_CORA_MINI);
        assertThat(txs).hasSize(2);

        OfxParser.OfxTransacao credito = txs.get(0);
        assertThat(credito.fitId()).isEqualTo("CORA202602041200001");
        assertThat(credito.dataLancamento()).isEqualTo(LocalDate.of(2026, 2, 4));
        assertThat(credito.trnAmt()).isEqualByComparingTo(new BigDecimal("120.00"));
        assertThat(credito.memo()).isEqualTo("Recebimento Pix");

        OfxParser.OfxTransacao debito = txs.get(1);
        assertThat(debito.trnAmt()).isEqualByComparingTo(new BigDecimal("-75.00"));
        assertThat(debito.name()).isEqualTo("BOLETO");
    }

    @Test
    void decodificarOfx_respeitaCharset1252NoHeader() {
        byte[] latin = "CHARSET:1252\n<MEMO>".getBytes(StandardCharsets.ISO_8859_1);
        String texto = OfxParser.decodificarOfx(latin);
        assertThat(texto).contains("CHARSET:1252");
    }

    @Test
    void parseTransacoes_fitIdZeroCaixa_geraOfxNUnicos() {
        String ofx =
                """
                <OFX>
                <STMTTRN>
                <TRNTYPE>CREDIT
                <DTPOSTED>20260601120000
                <TRNAMT>1052.00
                <FITID>0
                <CHECKNUM>0
                <MEMO>CR LV OR E
                </STMTTRN>
                <STMTTRN>
                <TRNTYPE>CREDIT
                <DTPOSTED>20260601120000
                <TRNAMT>4394.42
                <FITID>0
                <CHECKNUM>0
                <MEMO>CR LV OR E
                </STMTTRN>
                <STMTTRN>
                <TRNTYPE>CREDIT
                <DTPOSTED>20260616120000
                <TRNAMT>4022.80
                <FITID>14
                <CHECKNUM>14
                <MEMO>CR LEV JUD
                </STMTTRN>
                </OFX>
                """;
        List<OfxParser.OfxTransacao> txs = OfxParser.parseTransacoes(ofx);
        assertThat(txs).hasSize(3);
        assertThat(txs.get(0).fitId()).isEqualTo("ofx-1");
        assertThat(txs.get(1).fitId()).isEqualTo("ofx-2");
        assertThat(txs.get(2).fitId()).isEqualTo("14");
    }

    @Test
    void parseTransacoes_fitIdRepetido_sufixaComIndice() {
        String ofx =
                """
                <OFX>
                <STMTTRN>
                <TRNTYPE>CREDIT
                <DTPOSTED>20260602120000
                <TRNAMT>799.35
                <FITID>1
                <CHECKNUM>1
                <MEMO>CRED TED
                </STMTTRN>
                <STMTTRN>
                <TRNTYPE>CREDIT
                <DTPOSTED>20260602120000
                <TRNAMT>67.57
                <FITID>1
                <CHECKNUM>1
                <MEMO>CRED TED
                </STMTTRN>
                </OFX>
                """;
        List<OfxParser.OfxTransacao> txs = OfxParser.parseTransacoes(ofx);
        assertThat(txs.get(0).fitId()).isEqualTo("1");
        assertThat(txs.get(1).fitId()).isEqualTo("1-2");
    }
}
