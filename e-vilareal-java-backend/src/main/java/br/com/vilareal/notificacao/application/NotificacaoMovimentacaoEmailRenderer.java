package br.com.vilareal.notificacao.application;

import br.com.vilareal.agendamento.infrastructure.persistence.entity.MovimentacaoMonitoradaEntity;
import br.com.vilareal.notificacao.config.NotificacaoEmailProperties;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class NotificacaoMovimentacaoEmailRenderer {

    private static final String TEMPLATE = "notificacao/movimentacao-nova";
    private static final DateTimeFormatter DATA_MOV =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", Locale.forLanguageTag("pt-BR"));

    private final SpringTemplateEngine templateEngine;
    private final NotificacaoEmailProperties properties;

    public NotificacaoMovimentacaoEmailRenderer(
            SpringTemplateEngine templateEngine, NotificacaoEmailProperties properties) {
        this.templateEngine = templateEngine;
        this.properties = properties;
    }

    public String montarAssunto(String numeroCnj, String nomeCliente, String parteAutora, String parteRe) {
        String prefixo = properties.getAssuntoPrefixo() != null ? properties.getAssuntoPrefixo().trim() : "";
        String cnj = StringUtils.hasText(numeroCnj) ? numeroCnj.trim() : "—";
        String rotulo = montarRotuloProcesso(nomeCliente, parteAutora, parteRe);
        String titulo = prefixo + " Nova movimentação — " + cnj + " (" + rotulo + ")";
        return titulo.strip();
    }

    public String renderCorpoHtml(
            String numeroCnj,
            String nomeCliente,
            String parteAutora,
            String parteRe,
            List<MovimentacaoMonitoradaEntity> novas) {
        Context context = new Context(Locale.forLanguageTag("pt-BR"));
        context.setVariable("numeroCnj", StringUtils.hasText(numeroCnj) ? numeroCnj.trim() : "—");
        context.setVariable("nomeCliente", StringUtils.hasText(nomeCliente) ? nomeCliente.trim() : "Cliente");
        context.setVariable("parteAutora", textoOuTraco(parteAutora));
        context.setVariable("parteRe", textoOuTraco(parteRe));
        context.setVariable("movimentacoes", montarLinhas(novas));
        context.setVariable("quantidade", novas != null ? novas.size() : 0);
        return templateEngine.process(TEMPLATE, context);
    }

    static String montarRotuloProcesso(String nomeCliente, String parteAutora, String parteRe) {
        if (StringUtils.hasText(parteAutora) && StringUtils.hasText(parteRe)) {
            return parteAutora.trim() + " × " + parteRe.trim();
        }
        if (StringUtils.hasText(parteAutora)) {
            return parteAutora.trim();
        }
        if (StringUtils.hasText(parteRe)) {
            return parteRe.trim();
        }
        return StringUtils.hasText(nomeCliente) ? nomeCliente.trim() : "Cliente";
    }

    private static String textoOuTraco(String valor) {
        return StringUtils.hasText(valor) ? valor.trim() : "—";
    }

    static List<MovimentacaoEmailLinha> montarLinhas(List<MovimentacaoMonitoradaEntity> novas) {
        List<MovimentacaoEmailLinha> linhas = new ArrayList<>();
        if (novas == null) {
            return linhas;
        }
        for (MovimentacaoMonitoradaEntity m : novas) {
            if (m == null) {
                continue;
            }
            String data = m.getDataMovimentacao() != null ? DATA_MOV.format(m.getDataMovimentacao()) : "—";
            linhas.add(new MovimentacaoEmailLinha(
                    m.getNumero() != null ? String.valueOf(m.getNumero()) : "—",
                    StringUtils.hasText(m.getLegenda()) ? m.getLegenda().trim() : "—",
                    data));
        }
        return linhas;
    }

    public record MovimentacaoEmailLinha(String numero, String legenda, String dataMovimentacao) {}
}
