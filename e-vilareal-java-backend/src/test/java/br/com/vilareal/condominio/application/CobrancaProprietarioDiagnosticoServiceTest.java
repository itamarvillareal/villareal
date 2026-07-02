package br.com.vilareal.condominio.application;

import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoRodadaRepository;
import br.com.vilareal.condominio.api.dto.CobrancaProprietarioDiagnosticoRequest;
import br.com.vilareal.condominio.api.dto.CobrancaProprietarioDiagnosticoResponse;
import br.com.vilareal.condominio.api.dto.CobrancaUnidadeRequestDto;
import br.com.vilareal.condominio.api.dto.InadimplenciaCobrancaDto;
import br.com.vilareal.condominio.api.dto.PlanilhaEnderecoDto;
import br.com.vilareal.condominio.api.dto.PlanilhaPessoaDto;
import br.com.vilareal.condominio.api.dto.UnidadePlanilhaLinhaDto;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CobrancaProprietarioDiagnosticoServiceTest {

    private static final long CLIENTE_ID = 928L;
    private static final String COD8 = "00000928";

    @Mock
    private ProcessoUnidadeClienteLookupService processoUnidadeLookup;

    @Mock
    private ProcessoParteRepository processoParteRepository;

    @Mock
    private PessoaRepository pessoaRepository;

    @Mock
    private CalculoRodadaRepository calculoRodadaRepository;

    @InjectMocks
    private CobrancaProprietarioDiagnosticoService service;

    @Test
    void diagnosticar_classificaTrocaDonoQuandoPlanilhaDivergeDoLegado() {
        ProcessoEntity proc = new ProcessoEntity();
        proc.setId(10L);
        proc.setNumeroInterno(41);
        when(processoUnidadeLookup.listarTodosPorCodigoUnidade(CLIENTE_ID, "QD01-LT01"))
                .thenReturn(List.of(proc));

        PessoaEntity legado = new PessoaEntity();
        legado.setId(1L);
        legado.setNome("Antigo Dono");
        legado.setCpf("11111111111");
        ProcessoParteEntity parte = new ProcessoParteEntity();
        parte.setPessoa(legado);
        when(processoParteRepository.findByProcesso_IdAndPoloReuOrderByOrdemAscIdAsc(10L))
                .thenReturn(List.of(parte));
        when(pessoaRepository.findById(1L)).thenReturn(Optional.of(legado));
        when(calculoRodadaRepository.findByCodigoClienteAndNumeroProcessoAndDimensao(COD8, 41, 0))
                .thenReturn(Optional.empty());

        PlanilhaPessoaDto propPlan = new PlanilhaPessoaDto(
                "Novo Dono", "22222222222", "22222222222", "", List.of(), List.of());
        UnidadePlanilhaLinhaDto linPlan = new UnidadePlanilhaLinhaDto(
                "QD01-LT01",
                propPlan,
                new PlanilhaPessoaDto("", "", "", "", List.of(), List.of()),
                new PlanilhaEnderecoDto("", "", "", "", "", "", "", ""),
                "EXISTE",
                "PENDENTE");

        CobrancaUnidadeRequestDto unidade = new CobrancaUnidadeRequestDto(
                "QD01-LT01",
                "Novo Dono",
                "22222222222",
                List.of(new InadimplenciaCobrancaDto("Ord", "1", "04/2026", "10/04/2026", "100", 10000L, "")),
                "Antigo Dono",
                "11111111111");

        CobrancaProprietarioDiagnosticoResponse res = service.diagnosticar(
                CLIENTE_ID,
                COD8,
                new CobrancaProprietarioDiagnosticoRequest(COD8, List.of(unidade), List.of(linPlan)));

        assertThat(res.itens()).hasSize(1);
        assertThat(res.itens().getFirst().classe()).isEqualTo(CobrancaProprietarioDiagnosticoService.CLASSE_TROCA_DONO);
        assertThat(res.resumo().trocaDono()).isEqualTo(1);
    }
}
