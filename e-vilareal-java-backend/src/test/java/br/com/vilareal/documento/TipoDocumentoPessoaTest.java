package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TipoDocumentoPessoaTest {

    @Test
    void deTipoDocumento_sempreDocumentosParaPdfGerado() {
        assertThat(TipoDocumentoPessoa.deTipoDocumento(TipoDocumento.PROCURACAO))
                .isEqualTo(TipoDocumentoPessoa.DOCUMENTOS);
        assertThat(TipoDocumentoPessoa.deTipoDocumento(TipoDocumento.PETICAO))
                .isEqualTo(TipoDocumentoPessoa.DOCUMENTOS);
    }

    @Test
    void parse_aceitaAssinadosEDocumentos() {
        assertThat(TipoDocumentoPessoa.parse("ASSINADOS")).isEqualTo(TipoDocumentoPessoa.ASSINADOS);
        assertThat(TipoDocumentoPessoa.parse("Documentos")).isEqualTo(TipoDocumentoPessoa.DOCUMENTOS);
    }

    @Test
    void parse_mapeiaLegadoParaDocumentos() {
        assertThat(TipoDocumentoPessoa.parse("Procurações")).isEqualTo(TipoDocumentoPessoa.DOCUMENTOS);
        assertThat(TipoDocumentoPessoa.parse("CONTRATOS")).isEqualTo(TipoDocumentoPessoa.DOCUMENTOS);
    }

    @Test
    void parse_rejeitaValorDesconhecido() {
        assertThatThrownBy(() -> TipoDocumentoPessoa.parse("invalido"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
