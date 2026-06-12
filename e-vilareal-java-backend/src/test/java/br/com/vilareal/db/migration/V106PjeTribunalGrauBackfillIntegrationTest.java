package br.com.vilareal.db.migration;

import br.com.vilareal.AbstractIntegrationTest;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

/** Valida o backfill do V106 em MySQL real (Testcontainers). */
class V106PjeTribunalGrauBackfillIntegrationTest extends AbstractIntegrationTest {

    private static final String V106_BACKFILL =
            """
            UPDATE processo
            SET pje_tribunal = 'PJE_TRT18',
                pje_grau = 'PRIMEIRO_GRAU'
            WHERE UPPER(TRIM(tramitacao)) = 'PJE'
            """;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ProcessoRepository processoRepository;

    @Autowired
    private PessoaRepository pessoaRepository;

    @Autowired
    private ClienteRepository clienteRepository;

    @Test
    @Transactional
    void backfill_pjeLegado_preencheTribunalEGrau() {
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setNome("Titular V106");
        pessoa = pessoaRepository.save(pessoa);

        ClienteEntity cliente = new ClienteEntity();
        cliente.setPessoa(pessoa);
        cliente.setCodigoCliente("99999001");
        cliente = clienteRepository.save(cliente);

        ProcessoEntity processo = new ProcessoEntity();
        processo.setPessoa(pessoa);
        processo.setCliente(cliente);
        processo.setNumeroInterno(99);
        processo.setTramitacao("PJe");
        processo = processoRepository.save(processo);

        jdbcTemplate.update(V106_BACKFILL);

        ProcessoEntity atualizado = processoRepository.findById(processo.getId()).orElseThrow();
        assertThat(atualizado.getPjeTribunal()).hasToString("PJE_TRT18");
        assertThat(atualizado.getPjeGrau()).hasToString("PRIMEIRO_GRAU");
    }
}
