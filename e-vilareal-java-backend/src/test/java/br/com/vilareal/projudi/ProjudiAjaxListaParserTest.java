package br.com.vilareal.projudi;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProjudiAjaxListaParserTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void parseFormatoComarcaIgnoraSentinelas() {
        String json =
                """
                [{"desc1":2,"id":"-50000"},{"desc1":"0","id":"-60000"},\
                {"desc1":"ANÁPOLIS","id":"2"},{"desc1":"GOIANÁPOLIS","id":"91"}]
                """;
        var lista = ProjudiAjaxListaParser.parse(json, objectMapper);
        assertThat(lista).hasSize(2);
        assertThat(lista.get(0).id()).isEqualTo(2);
        assertThat(lista.get(0).label()).isEqualTo("ANÁPOLIS");
    }

    @Test
    void resolverCampoMatchExato() {
        var candidatos = java.util.List.of(
                new ProjudiAjaxListaParser.CandidatoProjudi(226, "ANÁPOLIS"),
                new ProjudiAjaxListaParser.CandidatoProjudi(300, "GOIANÉSIA"));
        var res = ProjudiParteResolverService.resolverCampo("Anapolis", candidatos, "cidade 'ANAPOLIS'");
        assertThat(res.nivel()).isEqualTo(ProjudiParteResolverService.NivelResolucao.RESOLVIDO);
        assertThat(res.idProjudi()).isEqualTo(226);
    }
}
