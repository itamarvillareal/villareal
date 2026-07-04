package br.com.vilareal.whatsapp.service;

import br.com.vilareal.whatsapp.dto.WhatsAppGrupoDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppConversaClienteRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppGrupoListServiceTest {

    @Mock
    private WhatsAppConversaClienteRepository conversaClienteRepository;

    @InjectMocks
    private WhatsAppGrupoListService service;

    @Test
    void listarGrupos_retornaCodigoNomeEQtd() {
        when(conversaClienteRepository.listarGruposComContagem())
                .thenReturn(List.of(row("00000001", "Farol", 5L), row("00000002", "Terra Mundi", 3L)));

        List<WhatsAppGrupoDTO> grupos = service.listarGrupos();

        assertThat(grupos).hasSize(2);
        assertThat(grupos.get(0).codigo()).isEqualTo("00000001");
        assertThat(grupos.get(0).nome()).isEqualTo("Farol");
        assertThat(grupos.get(0).qtdConversas()).isEqualTo(5L);
    }

    @Test
    void normalizarFiltroClienteCodigo_vazioQuandoAusente() {
        assertThat(WhatsAppGrupoListService.normalizarFiltroClienteCodigo(null)).isEmpty();
        assertThat(WhatsAppGrupoListService.normalizarFiltroClienteCodigo("  ")).isEmpty();
        assertThat(WhatsAppGrupoListService.normalizarFiltroClienteCodigo("1")).isEqualTo("00000001");
    }

    private static WhatsAppConversaClienteRepository.GrupoClienteRow row(
            String codigo, String nome, Long qtd) {
        return new WhatsAppConversaClienteRepository.GrupoClienteRow() {
            @Override
            public String getClienteCodigo() {
                return codigo;
            }

            @Override
            public String getClienteNome() {
                return nome;
            }

            @Override
            public Long getQtdConversas() {
                return qtd;
            }
        };
    }
}
