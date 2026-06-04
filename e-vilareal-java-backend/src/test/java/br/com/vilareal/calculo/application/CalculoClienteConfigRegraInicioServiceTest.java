package br.com.vilareal.calculo.application;

import br.com.vilareal.calculo.api.dto.CalculoClienteConfigResponse;
import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoClienteConfigEntity;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoClienteConfigRepository;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoRodadaRepository;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.ClienteCodigoPessoaResolver;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CalculoClienteConfigRegraInicioServiceTest {

    private static final String COD = "00000299";

    @Mock
    private CalculoRodadaRepository rodadaRepository;

    @Mock
    private CalculoClienteConfigRepository clienteConfigRepository;

    @Mock
    private PessoaRepository pessoaRepository;

    @Mock
    private ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;

    private CalculoApplicationService service;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new CalculoApplicationService(
                rodadaRepository, clienteConfigRepository, pessoaRepository, objectMapper, clienteCodigoPessoaResolver);
    }

    @Test
    void obter_semRegistro_retornaDefault1() {
        when(clienteConfigRepository.findById(COD)).thenReturn(Optional.empty());

        CalculoClienteConfigResponse res = service.obterConfigCliente(COD);

        assertThat(res.config().get("regraInicioCobrancaDias").intValue()).isEqualTo(1);
    }

    @Test
    void salvar_e_obter_roundTrip60() {
        when(clienteCodigoPessoaResolver.resolverPessoaIdComFallbackCliente(COD)).thenReturn(Optional.of(100L));
        when(pessoaRepository.existsById(100L)).thenReturn(true);
        when(clienteConfigRepository.findById(COD)).thenReturn(Optional.empty());
        when(clienteConfigRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ObjectNode patch = objectMapper.createObjectNode();
        patch.put("regraInicioCobrancaDias", 60);
        CalculoClienteConfigResponse salvo = service.salvarConfigCliente(COD, patch);

        assertThat(salvo.config().get("regraInicioCobrancaDias").intValue()).isEqualTo(60);

        ArgumentCaptor<CalculoClienteConfigEntity> cap = ArgumentCaptor.forClass(CalculoClienteConfigEntity.class);
        verify(clienteConfigRepository).save(cap.capture());
        assertThat(cap.getValue().getRegraInicioCobrancaDias()).isEqualTo(60);
        assertThat(cap.getValue().getPayloadJson().has("regraInicioCobrancaDias")).isFalse();

        CalculoClienteConfigEntity persisted = cap.getValue();
        when(clienteConfigRepository.findById(COD)).thenReturn(Optional.of(persisted));

        CalculoClienteConfigResponse lido = service.obterConfigCliente(COD);
        assertThat(lido.config().get("regraInicioCobrancaDias").intValue()).isEqualTo(60);
    }

    @Test
    void salvar_valorInvalido_rejeita() {
        when(clienteCodigoPessoaResolver.resolverPessoaIdComFallbackCliente(COD)).thenReturn(Optional.of(100L));
        when(pessoaRepository.existsById(100L)).thenReturn(true);
        when(clienteConfigRepository.findById(COD)).thenReturn(Optional.empty());

        ObjectNode patch = objectMapper.createObjectNode();
        patch.put("regraInicioCobrancaDias", 45);

        assertThatThrownBy(() -> service.salvarConfigCliente(COD, patch)).isInstanceOf(BusinessRuleException.class);
    }
}
