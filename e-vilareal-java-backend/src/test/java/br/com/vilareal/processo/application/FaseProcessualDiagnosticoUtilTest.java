package br.com.vilareal.processo.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FaseProcessualDiagnosticoUtilTest {

    @Test
    void reconheceFaseCanonicaEVariantes() {
        assertThat(FaseProcessualDiagnosticoUtil.emFaseAguardandoProtocolo("Protocolo / Movimentação"))
                .isTrue();
        assertThat(FaseProcessualDiagnosticoUtil.emFaseAguardandoProtocolo("Aguardando Protocolo"))
                .isTrue();
        assertThat(FaseProcessualDiagnosticoUtil.emFaseAguardandoProtocolo("Ag. Peticionar"))
                .isFalse();
    }
}
