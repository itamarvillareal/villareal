package br.com.vilareal.notificacao.application;

import br.com.vilareal.agendamento.infrastructure.persistence.entity.MovimentacaoMonitoradaEntity;
import br.com.vilareal.notificacao.config.NotificacaoEmailProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class NotificacaoMovimentacaoEmailRendererTest {

    private NotificacaoMovimentacaoEmailRenderer renderer;

    @BeforeEach
    void setUp() {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setSuffix(".html");
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCharacterEncoding("UTF-8");
        SpringTemplateEngine engine = new SpringTemplateEngine();
        engine.setTemplateResolver(resolver);
        NotificacaoEmailProperties props = new NotificacaoEmailProperties();
        props.setAssuntoPrefixo("[Monitor]");
        renderer = new NotificacaoMovimentacaoEmailRenderer(engine, props);
    }

    @Test
    void renderCorpoHtml_listaMovimentacoes() {
        MovimentacaoMonitoradaEntity m = new MovimentacaoMonitoradaEntity();
        m.setNumero(42);
        m.setLegenda("Juntada de petição");
        m.setDataMovimentacao(LocalDateTime.of(2026, 6, 4, 15, 30));

        String html = renderer.renderCorpoHtml(
                "5059346-36.2026.8.09.0007", "Maria", "Digittos Ltda", "Condomínio Torres", List.of(m));

        assertThat(html).contains("5059346-36.2026.8.09.0007");
        assertThat(html).contains("Maria");
        assertThat(html).contains("Digittos Ltda");
        assertThat(html).contains("Condomínio Torres");
        assertThat(html).contains("Parte autora");
        assertThat(html).contains("Parte ré");
        assertThat(html).contains("Juntada de petição");
        assertThat(html).contains("04/06/2026 15:30");
        assertThat(html).contains("PROJUDI");
    }

    @Test
    void montarAssunto_usaAutorEReuQuandoDisponiveis() {
        assertThat(renderer.montarAssunto("CNJ-1", "Cliente X", "Autor A", "Ré B"))
                .isEqualTo("[Monitor] Nova movimentação — CNJ-1 (Autor A × Ré B)");
    }

    @Test
    void montarAssunto_caiParaClienteSemPartes() {
        assertThat(renderer.montarAssunto("CNJ-1", "Cliente X", "", ""))
                .isEqualTo("[Monitor] Nova movimentação — CNJ-1 (Cliente X)");
    }

    @Test
    void montarAssunto_formatoEsperadoLegado() {
        assertThat(renderer.montarAssunto("CNJ-1", "Cliente X", null, null))
                .isEqualTo("[Monitor] Nova movimentação — CNJ-1 (Cliente X)");
    }
}
