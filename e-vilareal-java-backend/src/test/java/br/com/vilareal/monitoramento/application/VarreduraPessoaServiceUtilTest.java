package br.com.vilareal.monitoramento.application;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class VarreduraPessoaServiceUtilTest {

    @Test
    void sequencialDvCompletaComZerosAEsquerda() {
        assertEquals("543215335", VarreduraPessoaService.sequencialDv("5432153-35"));
        assertEquals("001874397", VarreduraPessoaService.sequencialDv("18743-97"));
        assertEquals("713853554", VarreduraPessoaService.sequencialDv("7138535-54"));
    }

    @Test
    void sequencialDvRejeitaFormatosInvalidos() {
        assertNull(VarreduraPessoaService.sequencialDv(null));
        assertNull(VarreduraPessoaService.sequencialDv("5432153"));
        assertNull(VarreduraPessoaService.sequencialDv("5432153-3"));
        assertNull(VarreduraPessoaService.sequencialDv("54321535-35"));
        assertNull(VarreduraPessoaService.sequencialDv("abc-de"));
    }

    @Test
    void anoDoCnjExtraiPosicoes10a13() {
        assertEquals(2011, VarreduraPessoaService.anoDoCnj("7138535-54.2011.8.09.0007"));
        assertEquals(2026, VarreduraPessoaService.anoDoCnj("5059346-36.2026.8.09.0007"));
        assertEquals(0, VarreduraPessoaService.anoDoCnj("201100026988"));
        assertEquals(0, VarreduraPessoaService.anoDoCnj(null));
    }
}
