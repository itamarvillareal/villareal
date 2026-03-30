package br.com.vilareal.importacao;

import br.com.vilareal.importacao.infrastructure.persistence.entity.PlanilhaPasta1ClienteEntity;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PlanilhaPasta1MapeamentoUtilTest {

    @Test
    void duasChavesMesmoCliente6_prefereLinhaMaisRecenteComPessoa1895() {
        PlanilhaPasta1ClienteEntity linhaErrada = new PlanilhaPasta1ClienteEntity();
        linhaErrada.setChaveCliente("00000006");
        linhaErrada.setPessoaId(6L);
        linhaErrada.setUpdatedAt(Instant.parse("2020-01-01T00:00:00Z"));

        PlanilhaPasta1ClienteEntity linhaCerta = new PlanilhaPasta1ClienteEntity();
        linhaCerta.setChaveCliente("6");
        linhaCerta.setPessoaId(1895L);
        linhaCerta.setUpdatedAt(Instant.parse("2025-01-01T00:00:00Z"));

        assertThat(
                        PlanilhaPasta1MapeamentoUtil.escolherMelhorMapeamento(
                                List.of(linhaErrada, linhaCerta), "00000006"))
                .isPresent()
                .get()
                .extracting(PlanilhaPasta1ClienteEntity::getPessoaId)
                .isEqualTo(1895L);
    }

    @Test
    void mesmoInstante_preferePessoaDiferenteDoNumeroCliente() {
        Instant t = Instant.parse("2025-01-01T00:00:00Z");
        PlanilhaPasta1ClienteEntity identidade = new PlanilhaPasta1ClienteEntity();
        identidade.setChaveCliente("6");
        identidade.setPessoaId(6L);
        identidade.setUpdatedAt(t);

        PlanilhaPasta1ClienteEntity mapeado = new PlanilhaPasta1ClienteEntity();
        mapeado.setChaveCliente("00000006");
        mapeado.setPessoaId(1895L);
        mapeado.setUpdatedAt(t);

        assertThat(
                        PlanilhaPasta1MapeamentoUtil.escolherMelhorMapeamento(
                                List.of(identidade, mapeado), "00000006"))
                .isPresent()
                .get()
                .extracting(PlanilhaPasta1ClienteEntity::getPessoaId)
                .isEqualTo(1895L);
    }
}
