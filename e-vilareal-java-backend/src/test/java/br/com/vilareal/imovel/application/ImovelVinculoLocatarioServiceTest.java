package br.com.vilareal.imovel.application;

import br.com.vilareal.imovel.api.dto.ImovelVinculoLocatarioWriteRequest;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelVinculoLocatarioEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelVinculoLocatarioRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ImovelVinculoLocatarioServiceTest {

    @Mock private ImovelVinculoLocatarioRepository vinculoLocatarioRepository;
    @Mock private ImovelRepository imovelRepository;
    @Mock private ProcessoRepository processoRepository;

    private ImovelVinculoLocatarioService service;

    @BeforeEach
    void setUp() {
        service = new ImovelVinculoLocatarioService(vinculoLocatarioRepository, imovelRepository, processoRepository);
    }

    @Test
    void salvarPorVinculo_criaOuAtualizaSnapshot() {
        when(vinculoLocatarioRepository.findByNumeroPlanilhaAndCodigoClienteAndNumeroInterno(24, "00000793", 42))
                .thenReturn(Optional.empty());
        when(vinculoLocatarioRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ImovelVinculoLocatarioWriteRequest req = new ImovelVinculoLocatarioWriteRequest();
        req.setCodigoCliente("793");
        req.setNumeroInterno(42);
        req.setCamposExtrasJson("{\"inquilino\":\"Carlos\"}");

        var out = service.salvarPorVinculo(24, req);

        assertThat(out.getNumeroPlanilha()).isEqualTo(24);
        assertThat(out.getCodigoCliente()).isEqualTo("00000793");
        assertThat(out.getNumeroInterno()).isEqualTo(42);
        assertThat(out.getCamposExtrasJson()).contains("Carlos");

        ArgumentCaptor<ImovelVinculoLocatarioEntity> cap = ArgumentCaptor.forClass(ImovelVinculoLocatarioEntity.class);
        verify(vinculoLocatarioRepository).save(cap.capture());
        assertThat(cap.getValue().getCodigoCliente()).isEqualTo("00000793");
    }
}
