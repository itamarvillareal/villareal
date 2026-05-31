package br.com.vilareal.projudi;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

/** TEMP — dump JSON dos PDFs Movimentações para prototipar triagem. */
@SpringBootTest
class ProjudiDrivePdfTextoDiagnosticoIT {

    @Autowired
    private ProjudiDrivePdfTextoDiagnosticoService service;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void dumpTextosPdfMovimentacoes() throws Exception {
        List<String> cnjs = List.of(
                "5252435-24.2026.8.09.0007",
                "5161328-98.2023.8.09.0007");
        List<ProjudiDrivePdfTextoDiagnosticoService.ItemDrivePdfTexto> itens = service.extrairTextos(cnjs);
        objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
        System.out.println(objectMapper.writeValueAsString(itens));
    }
}
