package br.com.vilareal.imovel.application;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ContratoLocacaoFiadorSupportTest {

    @Test
    void serializarEExtrairPessoaIds() {
        String json = ContratoLocacaoFiadorSupport.serializarPessoaIds(List.of(10L, 20L, 10L));
        assertThat(json).isEqualTo("[{\"pessoaId\":10},{\"pessoaId\":20}]");
        assertThat(ContratoLocacaoFiadorSupport.extrairPessoaIds(json)).containsExactly(10L, 20L);
    }

    @Test
    void extrairPessoaIds_jsonVazio() {
        assertThat(ContratoLocacaoFiadorSupport.extrairPessoaIds(null)).isEmpty();
        assertThat(ContratoLocacaoFiadorSupport.extrairPessoaIds("[]")).isEmpty();
    }
}
