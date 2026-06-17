package br.com.vilareal.documento.tema;

import br.com.vilareal.documento.infrastructure.persistence.entity.DocumentoModeloEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.documento.infrastructure.persistence.repository.DocumentoModeloRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.model.TipoUsuario;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentoTemaResolverTest {

    @Mock
    private ProcessoRepository processoRepository;

    @Mock
    private DocumentoModeloRepository documentoModeloRepository;

    @Mock
    private DocumentoModeloMapper documentoModeloMapper;

    private DocumentoTemaResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new DocumentoTemaResolver(processoRepository, documentoModeloRepository, documentoModeloMapper);
    }

    @Test
    void semProcesso_retornaPadrao() {
        assertThat(resolver.resolverSemProcesso().id()).isEqualTo(TemaDocumento.ID_PADRAO);
        assertThat(resolver.resolverPorProcessoId(null).id()).isEqualTo(TemaDocumento.ID_PADRAO);
    }

    @Test
    void processoSemResponsavel_retornaPadrao() {
        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(10L);
        when(processoRepository.findByIdForJuliaEnactment(10L)).thenReturn(Optional.of(processo));

        assertThat(resolver.resolverPorProcessoId(10L).id()).isEqualTo(TemaDocumento.ID_PADRAO);
    }

    @Test
    void processoComResponsavelSemModeloAtivo_retornaPadraoSemErro() {
        UsuarioEntity karla = usuario(2L, "karla.pedroza");
        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(21L);
        processo.setUsuarioResponsavel(karla);
        when(processoRepository.findByIdForJuliaEnactment(21L)).thenReturn(Optional.of(processo));
        when(documentoModeloRepository.findByUsuarioResponsavelIdAndAtivoTrue(2L)).thenReturn(Optional.empty());

        assertThat(resolver.resolverPorProcessoId(21L).id()).isEqualTo(TemaDocumento.ID_PADRAO);
    }

    @Test
    void processoComResponsavelComModeloAtivo_usaModeloDoBanco() {
        UsuarioEntity karla = usuario(2L, "karla.pedroza");
        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(22L);
        processo.setUsuarioResponsavel(karla);
        DocumentoModeloEntity modelo = new DocumentoModeloEntity();
        modelo.setId(5L);
        TemaDocumento temaKarla = TemaDocumento.personalizado(
                "modelo.5", null, null, null, null, "Dra. Karla", "OAB/GO 00.000");

        when(processoRepository.findByIdForJuliaEnactment(22L)).thenReturn(Optional.of(processo));
        when(documentoModeloRepository.findByUsuarioResponsavelIdAndAtivoTrue(2L)).thenReturn(Optional.of(modelo));
        when(documentoModeloMapper.toTemaDocumento(modelo)).thenReturn(temaKarla);

        assertThat(resolver.resolverPorProcessoId(22L).advogadoNomeEfetivo()).isEqualTo("Dra. Karla");
    }

    private static UsuarioEntity usuario(Long id, String login) {
        UsuarioEntity u = new UsuarioEntity();
        u.setId(id);
        u.setLogin(login);
        u.setNome(login);
        u.setTipo(TipoUsuario.HUMANO);
        u.setAtivo(true);
        return u;
    }
}
