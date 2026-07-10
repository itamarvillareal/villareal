package br.com.vilareal.agenda;

import br.com.vilareal.agenda.application.ProcessoAudienciaAgendaSyncService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProcessoAudienciaAgendaSyncServiceTest {

    @Test
    void montarDescricaoAgendaAudiencia_formataComoFront() {
        ProcessoEntity p = new ProcessoEntity();
        p.setAudienciaTipo("Conciliação");
        p.setNumeroCnj("5508759-50.2026.8.09.0007");
        p.setCompetencia("1º JUIZADO ESPECIAL CIVEL de ANÁPOLIS");

        String desc = ProcessoAudienciaAgendaSyncService.montarDescricaoAgendaAudiencia(
                p,
                java.util.List.of());

        assertThat(desc)
                .isEqualTo(
                        "Conciliação (CLIENTE x PARTE OPOSTA) Autos nº 5508759.50.2026, no 1º JUIZADO ESPECIAL CIVEL de ANÁPOLIS");
    }

    @Test
    void formatarResumoCnjParaLinhaAgenda_reduzDigitos() {
        assertThat(ProcessoAudienciaAgendaSyncService.formatarResumoCnjParaLinhaAgenda("55087595020268090007"))
                .isEqualTo("5508759.50.2026");
    }

    @Test
    void montarProcessoRefAgenda_usaCodigoOitoDigitos() {
        ProcessoEntity p = new ProcessoEntity();
        p.setNumeroInterno(3);
        var cliente = new br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity();
        cliente.setCodigoCliente("928");
        p.setCliente(cliente);

        assertThat(ProcessoAudienciaAgendaSyncService.montarProcessoRefAgenda(p)).isEqualTo("00000928|3");
    }
}
