package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TipoDocumentoPessoaTest {

    @Test
    void deTipoDocumento_mapeiaProcuracaoContratoDeclaracao() {
        assertThat(TipoDocumentoPessoa.deTipoDocumento(TipoDocumento.PROCURACAO))
                .isEqualTo(TipoDocumentoPessoa.PROCURACOES);
        assertThat(TipoDocumentoPessoa.deTipoDocumento(TipoDocumento.CONTRATO))
                .isEqualTo(TipoDocumentoPessoa.CONTRATOS);
        assertThat(TipoDocumentoPessoa.deTipoDocumento(TipoDocumento.DECLARACAO))
                .isEqualTo(TipoDocumentoPessoa.DECLARACOES);
    }

    @Test
    void parse_aceitaNomeEnumEPasta() {
        assertThat(TipoDocumentoPessoa.parse("ASSINADOS")).isEqualTo(TipoDocumentoPessoa.ASSINADOS);
        assertThat(TipoDocumentoPessoa.parse("Assinados")).isEqualTo(TipoDocumentoPessoa.ASSINADOS);
        assertThat(TipoDocumentoPessoa.parse("Procurações")).isEqualTo(TipoDocumentoPessoa.PROCURACOES);
    }

    @Test
    void parse_rejeitaValorDesconhecido() {
        assertThatThrownBy(() -> TipoDocumentoPessoa.parse("invalido"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
