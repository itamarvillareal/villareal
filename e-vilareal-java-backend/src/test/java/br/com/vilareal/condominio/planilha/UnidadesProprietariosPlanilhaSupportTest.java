package br.com.vilareal.condominio.planilha;

import br.com.vilareal.condominio.api.dto.PlanilhaEnderecoDto;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class UnidadesProprietariosPlanilhaSupportTest {

    @Test
    void montarEndereco_parseCidadeUf() {
        PlanilhaEnderecoDto e = UnidadesProprietariosPlanilhaSupport.montarEndereco("", "Rua X", "10", "B", "", "Anápolis - GO");
        assertEquals("Anápolis", e.cidade());
        assertEquals("GO", e.uf());
    }

    @Test
    void montarRua_concatenaNumero() {
        PlanilhaEnderecoDto e =
                UnidadesProprietariosPlanilhaSupport.montarEndereco("", "Rua X", "10", "", "", "Cidade - DF");
        assertEquals("Rua X, 10", UnidadesProprietariosPlanilhaSupport.montarRuaParaPersistencia(e));
    }
}
