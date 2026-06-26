package br.com.vilareal.processo.application;

import br.com.vilareal.importacao.infrastructure.persistence.repository.PlanilhaPasta1ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClienteCodigoPessoaResolverExibicaoProcessoTest {

    @Mock
    private PlanilhaPasta1ClienteRepository planilhaPasta1ClienteRepository;

    @Mock
    private ClienteRepository clienteRepository;

    private ClienteCodigoPessoaResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new ClienteCodigoPessoaResolver(planilhaPasta1ClienteRepository, clienteRepository);
    }

    @Test
    void codigoClienteExibicaoParaProcesso_usaClienteContratanteNaoTitular() {
        PessoaEntity titular = new PessoaEntity();
        titular.setId(6794L);
        titular.setNome("MARIA DAS DORES");

        PessoaEntity pessoaCliente = new PessoaEntity();
        pessoaCliente.setId(999L);
        pessoaCliente.setNome("FABIO GONCALVES");

        ClienteEntity cliente = new ClienteEntity();
        cliente.setCodigoCliente("00000703");
        cliente.setPessoa(pessoaCliente);

        ProcessoEntity processo = new ProcessoEntity();
        processo.setPessoa(titular);
        processo.setCliente(cliente);

        assertThat(resolver.codigoClienteExibicaoParaProcesso(processo)).isEqualTo("00000703");
    }

    @Test
    void codigoClienteExibicaoParaProcesso_semClienteUsaTitular() {
        PessoaEntity titular = new PessoaEntity();
        titular.setId(6794L);

        ProcessoEntity processo = new ProcessoEntity();
        processo.setPessoa(titular);
        processo.setCliente(null);

        when(planilhaPasta1ClienteRepository.count()).thenReturn(0L);

        assertThat(resolver.codigoClienteExibicaoParaProcesso(processo)).isEqualTo("00006794");
    }
}
