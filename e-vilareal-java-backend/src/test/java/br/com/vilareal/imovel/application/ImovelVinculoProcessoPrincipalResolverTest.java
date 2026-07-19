package br.com.vilareal.imovel.application;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelProcessoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelVinculoProcessoPrincipalEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelProcessoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelVinculoProcessoPrincipalRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ImovelVinculoProcessoPrincipalResolverTest {

    private static final int NUMERO_PLANILHA = 39;

    @Mock private ImovelVinculoProcessoPrincipalRepository vinculoPrincipalRepository;
    @Mock private ClienteRepository clienteRepository;
    @Mock private ProcessoRepository processoRepository;
    @Mock private ImovelProcessoRepository imovelProcessoRepository;

    private ImovelVinculoProcessoPrincipalResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new ImovelVinculoProcessoPrincipalResolver(
                vinculoPrincipalRepository, clienteRepository, processoRepository, imovelProcessoRepository);
    }

    @Test
    void contratoUsaVinculoPrincipalQuandoPersistido() {
        ProcessoEntity principal = processo(16052L, 52);
        ProcessoEntity legado = processo(10474L, 4);
        ContratoLocacaoEntity contrato = contratoComImovel(17L, NUMERO_PLANILHA, legado);

        ImovelVinculoProcessoPrincipalEntity pref = new ImovelVinculoProcessoPrincipalEntity();
        pref.setNumeroPlanilha(NUMERO_PLANILHA);
        pref.setCodigoCliente("00000938");
        pref.setNumeroInterno(52);
        when(vinculoPrincipalRepository.findById(NUMERO_PLANILHA)).thenReturn(Optional.of(pref));
        stubBuscaProcesso938Proc52(principal);

        assertThat(resolver.resolverProcessoDoContrato(contrato)).contains(principal);
    }

    @Test
    void contratoCaiNoNnAtivoQuandoNaoHaPrincipal() {
        ProcessoEntity legado = processo(10474L, 4);
        ContratoLocacaoEntity contrato = contratoComImovel(17L, NUMERO_PLANILHA, legado);

        when(vinculoPrincipalRepository.findById(NUMERO_PLANILHA)).thenReturn(Optional.empty());
        ImovelProcessoEntity ip = new ImovelProcessoEntity();
        ip.setProcesso(legado);
        when(imovelProcessoRepository.findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(17L))
                .thenReturn(Optional.of(ip));

        assertThat(resolver.resolverProcessoDoContrato(contrato)).contains(legado);
    }

    private void stubBuscaProcesso938Proc52(ProcessoEntity principal) {
        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(938L);
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setId(900L);
        cliente.setPessoa(pessoa);
        when(clienteRepository.findByCodigoCliente("00000938")).thenReturn(Optional.of(cliente));
        when(processoRepository.findAllByCliente_IdAndNumeroInternoOrderByIdDesc(938L, 52))
                .thenReturn(List.of(principal));
    }

    private static ContratoLocacaoEntity contratoComImovel(Long imovelId, int planilha, ProcessoEntity escalar) {
        ImovelEntity imovel = new ImovelEntity();
        imovel.setId(imovelId);
        imovel.setNumeroPlanilha(planilha);
        imovel.setProcesso(escalar);
        ContratoLocacaoEntity contrato = new ContratoLocacaoEntity();
        contrato.setId(39L);
        contrato.setImovel(imovel);
        return contrato;
    }

    private static ProcessoEntity processo(Long id, int numeroInterno) {
        ProcessoEntity p = new ProcessoEntity();
        p.setId(id);
        p.setNumeroInterno(numeroInterno);
        return p;
    }
}
