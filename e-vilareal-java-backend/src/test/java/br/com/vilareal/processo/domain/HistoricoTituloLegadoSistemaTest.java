package br.com.vilareal.processo.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class HistoricoTituloLegadoSistemaTest {

    @Test
    void excluiTitulosAutomaticosDoLegado() {
        assertThat(HistoricoTituloLegadoSistema.ehTituloSistemaLegado(
                        "JUNTAR PETIÇÃO INSERIDA NA PASTA EM 15/05/2026 (EXECUTA ACORDO DESCUMPRIDO)"))
                .isTrue();
        assertThat(HistoricoTituloLegadoSistema.ehTituloSistemaLegado(
                        "PETIÇÃO DA INFORMAÇÃO ANTERIOR JUNTADA EM 15/05/2026"))
                .isTrue();
    }

    @Test
    void mantemInformacaoReal() {
        assertThat(HistoricoTituloLegadoSistema.ehTituloSistemaLegado("AGRAVO INTERNO JUNTADO E PREPARADO"))
                .isFalse();
    }
}
