package br.com.vilareal.importacao;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FasePlanilhaNormalizerTest {

    @Test
    void vazioRetornaEmpty() {
        assertThat(FasePlanilhaNormalizer.normalizarOuVazio(null)).isEmpty();
        assertThat(FasePlanilhaNormalizer.normalizarOuVazio("  ")).isEmpty();
    }

    @Test
    void matchExatoCanonica() {
        assertThat(FasePlanilhaNormalizer.normalizarOuVazio("Ag. Documentos"))
                .contains("Ag. Documentos");
        assertThat(FasePlanilhaNormalizer.normalizarOuVazio("  Protocolo / Movimentação "))
                .contains("Protocolo / Movimentação");
    }

    @Test
    void sinonimo() {
        assertThat(FasePlanilhaNormalizer.normalizarOuVazio("aguardando documentos"))
                .contains("Ag. Documentos");
    }

    @Test
    void aguardandoPeticionamentoParaAgPeticionar() {
        assertThat(FasePlanilhaNormalizer.normalizarOuVazio("Aguardando Peticionamento"))
                .contains("Ag. Peticionar");
    }

    @Test
    void desconhecidaLanca() {
        assertThatThrownBy(() -> FasePlanilhaNormalizer.normalizarOuVazio("Fase inventada XYZ"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void listaCanonicaAlinhadaAoFront() {
        assertThat(FasePlanilhaNormalizer.FASES_CANONICAS).hasSize(7);
        assertThat(FasePlanilhaNormalizer.FASES_CANONICAS.get(0)).isEqualTo("Ag. Documentos");
        assertThat(FasePlanilhaNormalizer.FASES_CANONICAS.get(6)).isEqualTo("Em Andamento");
    }
}
