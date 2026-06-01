package br.com.vilareal.projudi;

import br.com.vilareal.documento.DocumentoDrivePastaService;
import br.com.vilareal.documento.DrivePastaProcessoDto;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjudiProcessoArquivosDiagnosticoServiceTest {

    @Test
    void ehPastaProc_reconheceFormatoPadrao() {
        assertTrue(ProjudiProcessoArquivosDiagnosticoService.ehPastaProc("Proc. 100", 100));
        assertTrue(ProjudiProcessoArquivosDiagnosticoService.ehPastaProc("Proc. 00", 0));
        assertFalse(ProjudiProcessoArquivosDiagnosticoService.ehPastaProc("JOSE SILVA", 100));
    }

    @Test
    void ehMovimentacoes_primeiroSegmento() {
        assertTrue(ProjudiProcessoArquivosDiagnosticoService.ehMovimentacoes("Movimentações/arquivo.pdf"));
        assertFalse(ProjudiProcessoArquivosDiagnosticoService.ehMovimentacoes("Petição/rascunho.docx"));
    }

    @Test
    void resolverPastaVarredura_quandoJaEhProc_naoSobe() throws Exception {
        var svc = new ProjudiProcessoArquivosDiagnosticoService(null, null, null);
        var dto = new DrivePastaProcessoDto("id-proc", null, "Proc. 100", "cli / Proc. 100");
        var v = svc.resolverPastaVarredura(dto, 100);
        assertFalse(v.subiuDoNivelReu());
        assertTrue(ProjudiProcessoArquivosDiagnosticoService.ehPastaProc(v.nomePasta(), 100));
    }
}
