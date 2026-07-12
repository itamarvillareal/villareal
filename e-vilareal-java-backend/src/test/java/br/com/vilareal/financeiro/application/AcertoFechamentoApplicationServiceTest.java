package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.financeiro.api.dto.AcertoFechamentoResponse;
import br.com.vilareal.financeiro.api.dto.AcertoFechamentoWriteRequest;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.AcertoFechamentoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.AcertoFechamentoGrupoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.AcertoFechamentoGrupoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.AcertoFechamentoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AcertoFechamentoApplicationServiceTest {

    @Mock
    private AcertoFechamentoRepository fechamentoRepository;
    @Mock
    private AcertoFechamentoGrupoRepository grupoRepository;
    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;
    @Mock
    private ClienteRepository clienteRepository;
    @Mock
    private AcertoTrabalhoApplicationService acertoTrabalhoService;
    @Mock
    private AcertoPdfService acertoPdfService;

    @InjectMocks
    private AcertoFechamentoApplicationService service;

    private ClienteEntity cliente;
    private UsuarioEntity usuario;

    @BeforeEach
    void setUp() {
        cliente = new ClienteEntity();
        cliente.setId(729L);
        cliente.setCodigoCliente("00000728");
        usuario = new UsuarioEntity();
        usuario.setId(7L);
        usuario.setNome("Itamar");
        lenient().when(acertoTrabalhoService.usuarioAtual()).thenReturn(usuario);
        lenient().when(fechamentoRepository.save(any(AcertoFechamentoEntity.class)))
                .thenAnswer(inv -> {
                    AcertoFechamentoEntity e = inv.getArgument(0);
                    if (e.getId() == null) {
                        e.setId(55L);
                    }
                    return e;
                });
    }

    @Test
    void iniciar_bloqueiaSegundoRascunho() {
        when(clienteRepository.findById(729L)).thenReturn(Optional.of(cliente));
        when(fechamentoRepository.existsByCliente_IdAndNumeroBancoAndStatus(
                        729L, 19, AcertoFechamentoEntity.STATUS_RASCUNHO))
                .thenReturn(true);

        AcertoFechamentoWriteRequest req = new AcertoFechamentoWriteRequest();
        req.setClienteId(729L);
        req.setNumeroBanco(19);
        assertThatThrownBy(() -> service.iniciar(req))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("rascunho");
        verify(fechamentoRepository, never()).save(any());
    }

    @Test
    void iniciar_criaRascunhoComCriador() {
        when(clienteRepository.findById(729L)).thenReturn(Optional.of(cliente));
        when(fechamentoRepository.existsByCliente_IdAndNumeroBancoAndStatus(
                        729L, 19, AcertoFechamentoEntity.STATUS_RASCUNHO))
                .thenReturn(false);
        when(grupoRepository.countByAcertoFechamento_Id(any())).thenReturn(0L);

        AcertoFechamentoWriteRequest req = new AcertoFechamentoWriteRequest();
        req.setClienteId(729L);
        req.setNumeroBanco(19);
        req.setPeriodoInicio(LocalDate.of(2024, 2, 1));
        req.setPeriodoFim(LocalDate.of(2026, 7, 1));
        AcertoFechamentoResponse r = service.iniciar(req);

        assertThat(r.getStatus()).isEqualTo(AcertoFechamentoEntity.STATUS_RASCUNHO);
        assertThat(r.getCriadoPorNome()).isEqualTo("Itamar");
        assertThat(r.getClienteId()).isEqualTo(729L);
    }

    @Test
    void iniciar_validaPeriodoInvertido() {
        when(clienteRepository.findById(729L)).thenReturn(Optional.of(cliente));
        when(fechamentoRepository.existsByCliente_IdAndNumeroBancoAndStatus(any(), any(), anyString()))
                .thenReturn(false);

        AcertoFechamentoWriteRequest req = new AcertoFechamentoWriteRequest();
        req.setClienteId(729L);
        req.setNumeroBanco(19);
        req.setPeriodoInicio(LocalDate.of(2026, 7, 1));
        req.setPeriodoFim(LocalDate.of(2026, 6, 1));
        assertThatThrownBy(() -> service.iniciar(req))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Período");
    }

    @Test
    void fechar_gravaSaldoVinculaGruposEArquivaPdf() throws Exception {
        AcertoFechamentoEntity rascunho = new AcertoFechamentoEntity();
        rascunho.setId(55L);
        rascunho.setCliente(cliente);
        rascunho.setNumeroBanco(19);
        rascunho.setStatus(AcertoFechamentoEntity.STATUS_RASCUNHO);
        when(fechamentoRepository.findById(55L)).thenReturn(Optional.of(rascunho));
        when(lancamentoRepository.sumSaldoPendentePorClienteEConta(19, 729L))
                .thenReturn(new BigDecimal("155127.02"));
        when(grupoRepository.findGruposVinculadosPorClienteEConta(729L, 19))
                .thenReturn(List.of("CZ-ANTIGO"));
        when(lancamentoRepository.findGruposCompensacaoPorClienteEConta(19, 729L))
                .thenReturn(List.of("CZ-ANTIGO", "CZ-NOVO-1", "CZ-NOVO-2"));
        when(lancamentoRepository.findAll(any(Specification.class), any(Sort.class)))
                .thenReturn(List.of());
        when(acertoPdfService.gerarESalvar(any(), any(), any(), any(), any()))
                .thenReturn("acertos/55/acerto.pdf");
        when(grupoRepository.countByAcertoFechamento_Id(55L)).thenReturn(2L);

        AcertoFechamentoResponse r = service.fechar(55L);

        assertThat(r.getStatus()).isEqualTo(AcertoFechamentoEntity.STATUS_FECHADO);
        assertThat(r.getSaldoFinal()).isEqualByComparingTo("155127.02");
        assertThat(r.getDataFechamento()).isNotNull();
        assertThat(r.getFechadoPorNome()).isEqualTo("Itamar");
        assertThat(r.isTemPdf()).isTrue();

        ArgumentCaptor<AcertoFechamentoGrupoEntity> grupoCaptor =
                ArgumentCaptor.forClass(AcertoFechamentoGrupoEntity.class);
        verify(grupoRepository, org.mockito.Mockito.times(2)).save(grupoCaptor.capture());
        assertThat(grupoCaptor.getAllValues())
                .extracting(AcertoFechamentoGrupoEntity::getGrupoCompensacao)
                .containsExactlyInAnyOrder("CZ-NOVO-1", "CZ-NOVO-2");
    }

    @Test
    void fechar_rejeitaAcertoJaFechado() {
        AcertoFechamentoEntity fechado = new AcertoFechamentoEntity();
        fechado.setId(56L);
        fechado.setCliente(cliente);
        fechado.setNumeroBanco(19);
        fechado.setStatus(AcertoFechamentoEntity.STATUS_FECHADO);
        when(fechamentoRepository.findById(56L)).thenReturn(Optional.of(fechado));

        assertThatThrownBy(() -> service.fechar(56L))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("rascunho");
    }

    @Test
    void excluir_soRascunho() {
        AcertoFechamentoEntity fechado = new AcertoFechamentoEntity();
        fechado.setId(56L);
        fechado.setCliente(cliente);
        fechado.setStatus(AcertoFechamentoEntity.STATUS_FECHADO);
        when(fechamentoRepository.findById(56L)).thenReturn(Optional.of(fechado));

        assertThatThrownBy(() -> service.excluir(56L))
                .isInstanceOf(BusinessRuleException.class);
        verify(fechamentoRepository, never()).delete(any());
    }
}
