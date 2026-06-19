package br.com.vilareal.publicacao.application;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class PrazoSugestaoServiceTest {

    private final PrazoSugestaoService service = new PrazoSugestaoService();

    @Test
    void sugerir_diasUteisComGatilho_contaAPartirDaDataNoTeor() {
        String teor =
                "Intime-se para apresentar contrarrazões no prazo de 15 dias úteis a contar de 10/06/2026.";
        PrazoSugestaoResultado r = service.sugerir(teor, LocalDate.of(2026, 6, 1));

        assertThat(r.identificado()).isTrue();
        assertThat(r.origem()).isEqualTo(PrazoSugestaoOrigem.DIAS_UTEIS);
        assertThat(r.dias()).isEqualTo(15);
        assertThat(r.dataBase()).isEqualTo(LocalDate.of(2026, 6, 10));
        assertThat(r.dataFatal()).isEqualTo(LocalDate.of(2026, 7, 1));
        assertThat(r.explicacao()).contains("15 dias úteis").contains("10/06").contains("01/07");
    }

    @Test
    void sugerir_quarentaOitoHoras_converteParaDoisDiasUteis() {
        String teor = "Prazo de 48 horas para manifestação.";
        PrazoSugestaoResultado r = service.sugerir(teor, LocalDate.of(2026, 6, 10));

        assertThat(r.identificado()).isTrue();
        assertThat(r.origem()).isEqualTo(PrazoSugestaoOrigem.HORAS);
        assertThat(r.dias()).isEqualTo(2);
        assertThat(r.dataFatal()).isEqualTo(LocalDate.of(2026, 6, 12));
        assertThat(r.explicacao()).contains("48 horas");
    }

    @Test
    void sugerir_semPrazoNoTeor_aplicaCincoDiasUteisPadrao() {
        String teor = "Publicação informativa sem prazo específico.";
        PrazoSugestaoResultado r = service.sugerir(teor, LocalDate.of(2026, 6, 10));

        assertThat(r.identificado()).isFalse();
        assertThat(r.origem()).isEqualTo(PrazoSugestaoOrigem.DEFAULT);
        assertThat(r.dias()).isEqualTo(5);
        assertThat(r.dataFatal()).isEqualTo(LocalDate.of(2026, 6, 17));
        assertThat(r.explicacao()).contains("padrão");
    }
}
