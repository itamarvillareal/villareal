package br.com.vilareal.demanda.application;

import br.com.vilareal.demanda.infrastructure.persistence.entity.DemandaEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DemandaBuscaSupportTest {

    @Test
    void buscaEncontraDemandaPeloCondominioDoImovelMesmoSemUnidade() {
        ImovelEntity imovel = new ImovelEntity();
        imovel.setCondominio("Jardim Ana Paula");
        imovel.setUnidade(null);

        DemandaEntity demanda = new DemandaEntity();
        demanda.setDescricao("Troca de fechadura");
        demanda.setImovel(imovel);

        assertTrue(DemandaBuscaSupport.matches(demanda, "ana paula"));
        assertTrue(DemandaBuscaSupport.matches(demanda, "jardim"));
        assertFalse(DemandaBuscaSupport.matches(demanda, "outro bairro"));
    }
}
