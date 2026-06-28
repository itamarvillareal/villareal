package br.com.vilareal.projudi;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjudiProcessoCivelInicialCorpoUtilTest {

    @Test
    void montarCorpoConcluirAnexos_listaTodosArquivosComTipoOutros() {
        String corpo = ProjudiProcessoCivelInicialCorpoUtil.montarCorpoConcluirAnexos(
                List.of("a.pdf.p7s", "b.pdf.p7s", "c.pdf.p7s"));
        assertTrue(corpo.contains("PassoEditar=6"));
        assertTrue(corpo.contains("Passo1=Passo+1+OK"));
        assertTrue(corpo.contains("Passo2=Passo+2"));
        assertTrue(corpo.contains("Passo3="));
        assertTrue(corpo.contains("assinado=true"));
        assertTrue(corpo.contains("gerarAssinatura=false"));
        assertTrue(corpo.contains("ArquivoTipo=Outros"));
        assertTrue(corpo.contains("Id_ArquivoTipo=1"));
        assertTrue(corpo.contains("files%5B%5D=a.pdf.p7s"));
        assertTrue(corpo.contains("files%5B%5D=b.pdf.p7s"));
        assertTrue(corpo.contains("files%5B%5D=c.pdf.p7s"));
        assertTrue(corpo.contains("imgConcluir=Concluir"));
        assertFalse(corpo.contains("Id_ArquivoTipo=2"));
    }

    @Test
    void montarCorpoEstado_incluiDependenciaProcesso2() {
        String corpo = ProjudiProcessoCivelInicialCorpoUtil.montarCorpoAvancarAnexos("1.294,57");
        assertTrue(corpo.contains("dependenciaProcesso=2"));
        assertTrue(corpo.contains("custaTipo=3"));
        assertTrue(corpo.contains("grauProcesso=1"));
        assertTrue(corpo.contains("tipoProcesso=1"));
        assertTrue(corpo.contains("assistenciaProcesso=3"));
        assertTrue(corpo.contains("Passo1=Passo+1"));
        assertTrue(corpo.contains("dependente=false"));
        assertTrue(corpo.contains("imgInserir=Avan%E7ar"));
    }

    @Test
    void montarCorpoCustas_comarcaVazia() {
        String corpo = ProjudiProcessoCivelInicialCorpoUtil.montarCorpoCustasSemDependencia();
        assertTrue(corpo.contains("dependenciaProcesso=2"));
        assertTrue(corpo.contains("custaTipo=3"));
        assertTrue(corpo.contains("Comarca=&Id_Comarca="));
    }
}
