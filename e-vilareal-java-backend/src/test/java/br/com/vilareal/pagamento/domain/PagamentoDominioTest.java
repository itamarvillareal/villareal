package br.com.vilareal.pagamento.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PagamentoDominioTest {

    @Test
    void statusInicial_pagarEhPendente_receberEhEmitido() {
        assertThat(PagamentoDominio.statusInicialPara(PagamentoDominio.TIPO_PAGAR)).isEqualTo(PagamentoDominio.ST_PENDENTE);
        assertThat(PagamentoDominio.statusInicialPara(PagamentoDominio.TIPO_RECEBER)).isEqualTo(PagamentoDominio.ST_EMITIDO);
    }

    @Test
    void transicoesReceber_fluxoFeliz() {
        assertThat(PagamentoDominio.transicaoReceberPermitida(PagamentoDominio.ST_EMITIDO, PagamentoDominio.ST_RECEBIDO))
                .isTrue();
        assertThat(PagamentoDominio.transicaoReceberPermitida(PagamentoDominio.ST_RECEBIDO, PagamentoDominio.ST_CONCILIADO))
                .isTrue();
    }

    @Test
    void transicoesReceber_invalidas() {
        assertThat(PagamentoDominio.transicaoReceberPermitida(PagamentoDominio.ST_EMITIDO, PagamentoDominio.ST_CONCILIADO))
                .isFalse();
        assertThat(PagamentoDominio.transicaoReceberPermitida(PagamentoDominio.ST_CONCILIADO, PagamentoDominio.ST_RECEBIDO))
                .isFalse();
    }

    @Test
    void statusValidos_pagarMantemConjuntoOriginal() {
        assertThat(PagamentoDominio.STATUS_VALIDOS)
                .containsExactlyInAnyOrder(
                        PagamentoDominio.ST_PENDENTE,
                        PagamentoDominio.ST_AGENDADO,
                        PagamentoDominio.ST_PAGO_CONFIRMADO,
                        PagamentoDominio.ST_PAGO_SEM_COMPROVANTE,
                        PagamentoDominio.ST_CONFERENCIA_PENDENTE,
                        PagamentoDominio.ST_VENCIDO,
                        PagamentoDominio.ST_CANCELADO,
                        PagamentoDominio.ST_SUBSTITUIDO,
                        PagamentoDominio.ST_CONFERIDO,
                        PagamentoDominio.ST_ACERTADO);
    }
}
