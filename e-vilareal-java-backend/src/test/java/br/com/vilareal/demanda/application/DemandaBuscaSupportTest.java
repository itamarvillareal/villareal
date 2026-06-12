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
        assertTrue(DemandaBuscaSupport.matches(demanda, "Ana  Paula"));
        assertFalse(DemandaBuscaSupport.matches(demanda, "outro bairro"));
    }

    @Test
    void buscaEncontraPeloEnderecoQuandoCondominioVazio() {
        ImovelEntity imovel = new ImovelEntity();
        imovel.setEnderecoCompleto("Rua Pérola, loteamento Jardim Ana Paula, Anápolis");

        DemandaEntity demanda = new DemandaEntity();
        demanda.setDescricao("Vistoria");
        demanda.setImovel(imovel);

        assertTrue(DemandaBuscaSupport.matches(demanda, "ana paula"));
        assertTrue(DemandaBuscaSupport.matches(demanda, "anapolis"));
    }

    @Test
    void buscaEncontraPeloNumeroPlanilha() {
        ImovelEntity imovel = new ImovelEntity();
        imovel.setNumeroPlanilha(56);
        imovel.setCondominio("Outro nome");

        DemandaEntity demanda = new DemandaEntity();
        demanda.setDescricao("Item");
        demanda.setImovel(imovel);

        assertTrue(DemandaBuscaSupport.matches(demanda, "56"));
    }
}
