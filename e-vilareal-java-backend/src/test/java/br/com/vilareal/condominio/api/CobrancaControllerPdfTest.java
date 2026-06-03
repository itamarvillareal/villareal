package br.com.vilareal.condominio.api;

import br.com.vilareal.condominio.application.CobrancaAutomaticaApplicationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class CobrancaControllerPdfTest {

    @Mock
    private CobrancaAutomaticaApplicationService service;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new CobrancaController(service)).build();
    }

    @Test
    void relatorioPdf_contentTypeApplicationPdf_eCorpoNaoVazio() throws Exception {
        byte[] pdf = "%PDF-1.4 fake".getBytes();
        when(service.gerarRelatorioPdf("imp-99")).thenReturn(pdf);

        mockMvc.perform(get("/api/cobranca/relatorio/imp-99/pdf"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"relatorio-cobranca-imp-99.pdf\""))
                .andExpect(content().bytes(pdf));
    }
}
