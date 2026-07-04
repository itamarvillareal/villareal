package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppConversaClienteEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversaClienteRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppGrupoMaterializacaoServiceTest {

    private static final Instant NOW = Instant.parse("2026-07-04T12:00:00Z");
    private static final String PHONE = "5562999887766";

    @Mock
    private WhatsAppMessageRepository messageRepository;

    @Mock
    private WhatsAppConversaClienteRepository conversaClienteRepository;

    @Mock
    private WhatsAppVinculoService vinculoService;

    @Mock
    private TransactionTemplate transactionTemplate;

    private WhatsAppGrupoMaterializacaoService service;

    @BeforeEach
    void setUp() {
        service = new WhatsAppGrupoMaterializacaoService(
                messageRepository,
                conversaClienteRepository,
                vinculoService,
                transactionTemplate,
                Clock.fixed(NOW, ZoneOffset.UTC));

        when(transactionTemplate.execute(any()))
                .thenAnswer(invocation -> {
                    TransactionCallback<?> callback = invocation.getArgument(0);
                    return callback.doInTransaction(org.mockito.Mockito.mock(TransactionStatus.class));
                });
    }

    @Test
    void telefoneComDoisClientesGeraDuasLinhas() {
        when(messageRepository.findDistinctPhoneNumbers()).thenReturn(List.of(PHONE));
        when(vinculoService.resolverClientesPorTelefone(PHONE))
                .thenReturn(List.of(
                        new WhatsAppVinculoService.ClienteVinculoResumo("00000001", "Cliente A"),
                        new WhatsAppVinculoService.ClienteVinculoResumo("00000002", "Cliente B")));

        var result = service.executarRodada();

        assertThat(result.telefonesProcessados()).isEqualTo(1);
        assertThat(result.linhasClientes()).isEqualTo(2);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<WhatsAppConversaClienteEntity>> captor = ArgumentCaptor.forClass(List.class);
        verify(conversaClienteRepository).deleteByPhoneNumber(PHONE);
        verify(conversaClienteRepository).saveAll(captor.capture());

        List<WhatsAppConversaClienteEntity> salvas = captor.getValue();
        assertThat(salvas).hasSize(2);
        assertThat(salvas)
                .extracting(WhatsAppConversaClienteEntity::getClienteCodigo)
                .containsExactly("00000001", "00000002");
        assertThat(salvas).allMatch(e -> PHONE.equals(e.getPhoneNumber()));
        assertThat(salvas).allMatch(e -> NOW.equals(e.getAtualizadoEm()));
    }

    @Test
    void telefoneSemClienteRemoveLinhasAnteriores() {
        when(messageRepository.findDistinctPhoneNumbers()).thenReturn(List.of(PHONE));
        when(vinculoService.resolverClientesPorTelefone(PHONE)).thenReturn(List.of());

        var result = service.executarRodada();

        assertThat(result.telefonesProcessados()).isEqualTo(1);
        assertThat(result.linhasClientes()).isZero();
        verify(conversaClienteRepository).deleteByPhoneNumber(PHONE);
        verify(conversaClienteRepository, times(0)).saveAll(any());
    }

    @Test
    void rodadaIdempotente() {
        when(messageRepository.findDistinctPhoneNumbers()).thenReturn(List.of(PHONE));
        when(vinculoService.resolverClientesPorTelefone(PHONE))
                .thenReturn(List.of(new WhatsAppVinculoService.ClienteVinculoResumo("00000001", "Cliente A")));

        service.executarRodada();
        service.executarRodada();

        verify(conversaClienteRepository, times(2)).deleteByPhoneNumber(PHONE);
        verify(conversaClienteRepository, times(2)).saveAll(any());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<WhatsAppConversaClienteEntity>> captor = ArgumentCaptor.forClass(List.class);
        verify(conversaClienteRepository, times(2)).saveAll(captor.capture());
        List<List<WhatsAppConversaClienteEntity>> todas = captor.getAllValues();
        assertThat(todas.get(0)).usingRecursiveComparison().isEqualTo(todas.get(1));
    }
}
