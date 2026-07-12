package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.financeiro.api.dto.AcertoClienteConfigWriteRequest;
import br.com.vilareal.financeiro.api.dto.AcertoConferenciaResponse;
import br.com.vilareal.financeiro.api.dto.AcertoConferirProcessoRequest;
import br.com.vilareal.financeiro.api.dto.AcertoConferirRequest;
import br.com.vilareal.financeiro.api.dto.AcertoResumoProcessosResponse;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.AcertoClienteConfigEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.AcertoClienteConfigRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.AcertoFechamentoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.mensalista.infrastructure.persistence.repository.MensalistaRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AcertoTrabalhoApplicationServiceTest {

    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;
    @Mock
    private ContaBancariaApplicationService contaBancariaApplicationService;
    @Mock
    private FinanceiroExtratoAcessoService extratoAcessoService;
    @Mock
    private AcertoClienteConfigRepository configRepository;
    @Mock
    private AcertoFechamentoRepository fechamentoRepository;
    @Mock
    private MensalistaRepository mensalistaRepository;
    @Mock
    private ClienteRepository clienteRepository;
    @Mock
    private UsuarioRepository usuarioRepository;

    @InjectMocks
    private AcertoTrabalhoApplicationService service;

    @AfterEach
    void limparContexto() {
        SecurityContextHolder.clearContext();
    }

    private void autenticar(UsuarioEntity usuario) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(usuario.getLogin(), "x", List.of()));
        when(usuarioRepository.findWithPerfilByLoginIgnoreCase(usuario.getLogin()))
                .thenReturn(Optional.of(usuario));
    }

    private static UsuarioEntity usuario() {
        UsuarioEntity u = new UsuarioEntity();
        u.setId(7L);
        u.setNome("Itamar");
        u.setLogin("itamar");
        return u;
    }

    @Test
    void resumoProcessos_agregaProgressoDeConferenciaEFiltraPendentes() {
        when(contaBancariaApplicationService.exigeSomaZero(19)).thenReturn(true);
        // proc 1: tudo conferido e compensado; proc 2: pendências e não conferidos
        Object[] proc1 = {
            10L, 234, "SE77E x DEVEDOR A", 3L, new BigDecimal("300.00"), new BigDecimal("300.00"),
            new BigDecimal("0.00"), 0L, 0L, Timestamp.from(Instant.parse("2026-07-10T12:00:00Z")),
            Date.valueOf(LocalDate.of(2024, 1, 1)), Date.valueOf(LocalDate.of(2026, 1, 1))
        };
        Object[] proc2 = {
            11L, 567, "SE77E x DEVEDOR B", 2L, new BigDecimal("100.00"), BigDecimal.ZERO,
            new BigDecimal("100.00"), 2L, 2L, null,
            Date.valueOf(LocalDate.of(2025, 5, 1)), Date.valueOf(LocalDate.of(2025, 6, 1))
        };
        when(lancamentoRepository.resumoAcertoPorProcesso(19, 729L, null, null, null, null, null))
                .thenReturn(List.of(proc1, proc2));

        AcertoResumoProcessosResponse r = service.resumoProcessos(
                19, 729L, null, null, null, null, true, null);

        assertThat(r.getTotalProcessos()).isEqualTo(2);
        assertThat(r.getProcessosConferidos()).isEqualTo(1);
        assertThat(r.getTotalLancamentos()).isEqualTo(5);
        assertThat(r.getLancamentosNaoConferidos()).isEqualTo(2);
        // apenasPendentes=true: só o proc 2 entra na lista
        assertThat(r.getProcessos()).hasSize(1);
        assertThat(r.getProcessos().get(0).getNumeroInterno()).isEqualTo(567);
        assertThat(r.getProcessos().get(0).getSaldo()).isEqualByComparingTo("100.00");
    }

    @Test
    void resumoProcessos_exigeVinculo() {
        when(contaBancariaApplicationService.exigeSomaZero(19)).thenReturn(true);
        assertThatThrownBy(() -> service.resumoProcessos(19, null, null, null, null, null, null, null))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("clienteId ou pessoaRefId");
    }

    @Test
    void resumoProcessos_rejeitaContaSemSomaZero() {
        when(contaBancariaApplicationService.exigeSomaZero(1)).thenReturn(false);
        assertThatThrownBy(() -> service.resumoProcessos(1, 729L, null, null, null, null, null, null))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("conta de acerto");
    }

    @Test
    void conferirLancamentos_marcaComUsuarioEData() {
        UsuarioEntity u = usuario();
        autenticar(u);
        when(lancamentoRepository.atualizarConferenciaPorIds(anyCollection(), any(Instant.class), eq(7L)))
                .thenReturn(3);

        AcertoConferirRequest req = new AcertoConferirRequest();
        req.setLancamentoIds(List.of(1L, 2L, 3L));
        req.setConferido(true);
        AcertoConferenciaResponse r = service.conferirLancamentos(req);

        assertThat(r.getAtualizados()).isEqualTo(3);
        assertThat(r.getConferidoEm()).isNotNull();
        assertThat(r.getConferidoPorNome()).isEqualTo("Itamar");
    }

    @Test
    void conferirLancamentos_desmarcaSemUsuario() {
        when(lancamentoRepository.atualizarConferenciaPorIds(anyCollection(), isNull(), isNull()))
                .thenReturn(2);

        AcertoConferirRequest req = new AcertoConferirRequest();
        req.setLancamentoIds(List.of(1L, 2L));
        req.setConferido(false);
        AcertoConferenciaResponse r = service.conferirLancamentos(req);

        assertThat(r.getAtualizados()).isEqualTo(2);
        assertThat(r.getConferidoEm()).isNull();
        assertThat(r.getConferidoPorNome()).isNull();
        verify(usuarioRepository, never()).findWithPerfilByLoginIgnoreCase(any());
    }

    @Test
    void conferirProcesso_cascataNoRecorteDoCliente() {
        when(contaBancariaApplicationService.exigeSomaZero(19)).thenReturn(true);
        UsuarioEntity u = usuario();
        autenticar(u);
        when(lancamentoRepository.atualizarConferenciaPorProcesso(
                        eq(19), eq(729L), isNull(), eq(10L), any(Instant.class), eq(7L)))
                .thenReturn(4);

        AcertoConferirProcessoRequest req = new AcertoConferirProcessoRequest();
        req.setNumeroBanco(19);
        req.setClienteId(729L);
        req.setProcessoId(10L);
        req.setConferido(true);
        AcertoConferenciaResponse r = service.conferirProcesso(req);

        assertThat(r.getAtualizados()).isEqualTo(4);
        assertThat(r.getConferidoPorNome()).isEqualTo("Itamar");
    }

    @Test
    void salvarConfig_validaPercentual() {
        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(729L);
        when(clienteRepository.findById(729L)).thenReturn(Optional.of(cliente));

        AcertoClienteConfigWriteRequest req = new AcertoClienteConfigWriteRequest();
        req.setClienteId(729L);
        req.setPercentualRepasse(new BigDecimal("150"));
        assertThatThrownBy(() -> service.salvarConfig(req))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("entre 0 e 100");
    }

    @Test
    void salvarConfig_upsertPreservaFichaExistente() {
        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(729L);
        when(clienteRepository.findById(729L)).thenReturn(Optional.of(cliente));

        AcertoClienteConfigEntity existente = new AcertoClienteConfigEntity();
        existente.setId(3L);
        existente.setCliente(cliente);
        when(configRepository.findByCliente_Id(729L)).thenReturn(Optional.of(existente));
        when(mensalistaRepository.findByCliente_IdWithDetalhes(729L)).thenReturn(Optional.empty());

        AcertoClienteConfigWriteRequest req = new AcertoClienteConfigWriteRequest();
        req.setClienteId(729L);
        req.setPercentualRepasse(new BigDecimal("80.00"));
        req.setObservacoes("  Repasse 80/20 desde 2024.  ");
        service.salvarConfig(req);

        assertThat(existente.getPercentualRepasse()).isEqualByComparingTo("80.00");
        assertThat(existente.getObservacoes()).isEqualTo("Repasse 80/20 desde 2024.");
        verify(configRepository).save(existente);
    }
}
