package br.com.vilareal.documento.tema;

import br.com.vilareal.documento.infrastructure.persistence.entity.DocumentoModeloEntity;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoModeloMapperTest {

    private final DocumentoModeloMapper mapper = new DocumentoModeloMapper();

    @Test
    void toTemaDocumento_mapeiaCamposDoModelo() {
        DocumentoModeloEntity entity = new DocumentoModeloEntity();
        entity.setId(7L);
        entity.setAdvogadoNome("Dra. Ana Luísa");
        entity.setAdvogadoOab("OAB/GO 11.111");
        entity.setRodapeTexto("Linha um\nLinha dois");

        TemaDocumento tema = mapper.toTemaDocumento(entity);

        assertThat(tema.id()).isEqualTo("modelo.7");
        assertThat(tema.advogadoNomeEfetivo()).isEqualTo("Dra. Ana Luísa");
        assertThat(tema.advogadoOabEfetivo()).isEqualTo("OAB/GO 11.111");
        assertThat(tema.rodapePrimeiraHtmlEfetivo()).contains("Linha um");
        assertThat(tema.logoCabecalhoBase64Efetivo()).isNull();
    }
}
