package br.com.vilareal.julia.application;

import br.com.vilareal.julia.triagem.TriagemResultado;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JuliaTriagemServiceTest {

    @Test
    void normalizarPrazo_ativo_recomputaDataTrabalho() {
        TriagemResultado entrada = new TriagemResultado(
                "Sentença",
                "Resumo",
                "FAVORAVEL",
                "Base",
                new TriagemResultado.Prazo(
                        true, "ATIVO", "Contestação", null, 15, "2026-06-08", "2026-06-05"),
                null,
                "ALTA",
                null,
                0.9,
                null);

        JuliaTriagemService svc = new JuliaTriagemService(null, null, null, null, null, null, null, null, null, null, null, null, null, "test-model", false, 0.72);
        TriagemResultado out = svc.normalizarPrazo(entrada);

        assertThat(out.prazo().dataTrabalhoAsLocalDate()).isEqualTo(java.time.LocalDate.of(2026, 6, 3));
    }

    @Test
    void normalizarPrazo_ativo_dataRealBr_parseiaERecomputa() {
        TriagemResultado entrada = new TriagemResultado(
                "Intimação",
                "Resumo",
                "DESFAVORAVEL",
                "Base",
                new TriagemResultado.Prazo(true, "ATIVO", "Manifestação", null, 15, "01/06/2026", null),
                null,
                "URGENTE",
                null,
                0.9,
                null);

        JuliaTriagemService svc = new JuliaTriagemService(null, null, null, null, null, null, null, null, null, null, null, null, null, "test-model", false, 0.72);
        TriagemResultado out = svc.normalizarPrazo(entrada);

        assertThat(out.prioridade()).isEqualTo("URGENTE");
        assertThat(out.prazo().dataRealAsLocalDate()).isEqualTo(java.time.LocalDate.of(2026, 6, 1));
        assertThat(out.prazo().dataTrabalhoAsLocalDate()).isEqualTo(java.time.LocalDate.of(2026, 5, 27));
    }

    @Test
    void normalizarPrazo_ativo_dataRealInvalida_segueSemPrazoAtivo() {
        TriagemResultado entrada = new TriagemResultado(
                "Intimação",
                "Resumo",
                "NEUTRO",
                "Base",
                new TriagemResultado.Prazo(true, "ATIVO", "Manifestação", null, 15, "invalida", "2026-06-05"),
                null,
                "ALTA",
                null,
                0.8,
                null);

        JuliaTriagemService svc = new JuliaTriagemService(null, null, null, null, null, null, null, null, null, null, null, null, null, "test-model", false, 0.72);
        TriagemResultado out = svc.normalizarPrazo(entrada);

        assertThat(out.prazo().dataRealAsLocalDate()).isNull();
        assertThat(out.prazo().dataTrabalhoAsLocalDate()).isNull();
    }

    @Test
    void normalizarPrazo_condicional_zeraDataTrabalho() {
        TriagemResultado entrada = new TriagemResultado(
                "Acordo",
                "Resumo",
                "NEUTRO",
                "Base",
                new TriagemResultado.Prazo(
                        true, "CONDICIONAL", "Pagamento", "Em caso de descumprimento", 15, "2026-07-01", "2026-06-28"),
                null,
                "MEDIA",
                null,
                0.7,
                null);

        JuliaTriagemService svc = new JuliaTriagemService(null, null, null, null, null, null, null, null, null, null, null, null, null, "test-model", false, 0.72);
        TriagemResultado out = svc.normalizarPrazo(entrada);

        assertThat(out.prazo().dataTrabalhoAsLocalDate()).isNull();
    }

    @Test
    void normalizarPrazo_ativo_sabadoRolaDataRealParaSegunda() {
        TriagemResultado entrada = new TriagemResultado(
                "Intimação",
                "Resumo",
                "NEUTRO",
                "Base",
                new TriagemResultado.Prazo(true, "ATIVO", "Manifestação", null, 15, "2026-06-20", null),
                null,
                "MEDIA",
                null,
                0.8,
                null);

        JuliaTriagemService svc = new JuliaTriagemService(null, null, null, null, null, null, null, null, null, null, null, null, null, "test-model", false, 0.72);
        TriagemResultado out = svc.normalizarPrazo(entrada);

        assertThat(out.prazo().dataRealAsLocalDate()).isEqualTo(java.time.LocalDate.of(2026, 6, 22));
        assertThat(out.prazo().dataTrabalhoAsLocalDate()).isEqualTo(java.time.LocalDate.of(2026, 6, 17));
    }

    @Test
    void deveAtualizarPrazoFatalCabecalho_quandoVazioOuMaisCedo() {
        java.time.LocalDate existente = java.time.LocalDate.of(2026, 6, 10);
        java.time.LocalDate maisCedo = java.time.LocalDate.of(2026, 6, 5);
        java.time.LocalDate maisTarde = java.time.LocalDate.of(2026, 6, 15);

        assertThat(JuliaTriagemService.deveAtualizarPrazoFatalCabecalho(null, maisCedo)).isTrue();
        assertThat(JuliaTriagemService.deveAtualizarPrazoFatalCabecalho(existente, maisCedo)).isTrue();
        assertThat(JuliaTriagemService.deveAtualizarPrazoFatalCabecalho(existente, existente)).isFalse();
        assertThat(JuliaTriagemService.deveAtualizarPrazoFatalCabecalho(existente, maisTarde)).isFalse();
    }

    @Test
    void montarDetalheAndamento_concatenaSecoesLegiveis() {
        TriagemResultado r = new TriagemResultado(
                "Homologação",
                "Acordo homologado.",
                "FAVORAVEL",
                "Sentença favorável ao cliente.",
                null,
                "Nenhuma providência imediata",
                "MEDIA",
                "Acompanhar cumprimento.",
                0.8,
                null);

        String detalhe = JuliaTriagemService.montarDetalheAndamento(r);

        assertThat(detalhe)
                .contains("Resumo: Acordo homologado.")
                .contains("Impacto para o cliente: FAVORAVEL")
                .contains("Base do impacto: Sentença favorável ao cliente.")
                .contains("Ação sugerida: Acompanhar cumprimento.");
    }

    @Test
    void normalizarPrioridade_aceitaUrgenteENormalizaMedia() {
        assertThat(JuliaTriagemService.normalizarPrioridade("urgente")).isEqualTo("URGENTE");
        assertThat(JuliaTriagemService.normalizarPrioridade("Média")).isEqualTo("MEDIA");
    }

    @Test
    void tituloAndamento_prefereResumoQuandoClassificacaoGenerica() {
        TriagemResultado r = new TriagemResultado(
                "Informação de intimação/citação",
                "Designada audiência de instrução e julgamento para 13/07/2026 às 13:30, por Zoom.",
                "NEUTRO",
                "Base",
                null,
                null,
                "MEDIA",
                null,
                0.9,
                null);

        String titulo = JuliaTriagemService.tituloAndamento(r);

        assertThat(titulo).contains("Designada audiência");
        assertThat(titulo).doesNotContain("Informação de intimação/citação — Informação");
    }

    @Test
    void truncarClassificacao_limita255ComReticencias() {
        String longa = "Intimação para manifestação (questão residual pós-extinção)".repeat(6);
        String out = JuliaTriagemService.truncarClassificacao(longa);
        assertThat(out).hasSize(255);
        assertThat(out).endsWith("…");
    }
}
