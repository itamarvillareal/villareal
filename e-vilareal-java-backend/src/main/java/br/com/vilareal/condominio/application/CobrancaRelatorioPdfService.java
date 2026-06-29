package br.com.vilareal.condominio.application;

import br.com.vilareal.condominio.api.dto.RelatorioDebitoIgnoradoDto;
import br.com.vilareal.condominio.api.dto.RelatorioExecucaoCobranca;
import br.com.vilareal.condominio.api.dto.RelatorioItemUnidadeDto;
import org.springframework.stereotype.Service;
import org.thymeleaf.spring6.SpringTemplateEngine;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class CobrancaRelatorioPdfService {

    private static final String TEMPLATE = "cobranca/relatorio-execucao";

    private final SpringTemplateEngine templateEngine;

    public CobrancaRelatorioPdfService(SpringTemplateEngine templateEngine) {
        this.templateEngine = templateEngine;
    }

    public byte[] gerarPdf(RelatorioExecucaoCobranca relatorio) {
        Map<String, Object> vars = montarVariaveis(relatorio);
        String html = renderizarHtml(vars);
        return converterHtmlParaPdf(html);
    }

    private String renderizarHtml(Map<String, Object> variables) {
        org.thymeleaf.context.Context context = new org.thymeleaf.context.Context(java.util.Locale.forLanguageTag("pt-BR"));
        variables.forEach(context::setVariable);
        return templateEngine.process(TEMPLATE, context);
    }

    private byte[] converterHtmlParaPdf(String html) {
        try (ByteArrayOutputStream os = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, "/");
            builder.toStream(os);
            builder.run();
            return os.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao gerar PDF do relatório de cobrança", e);
        }
    }

    static Map<String, Object> montarVariaveis(RelatorioExecucaoCobranca r) {
        Map<String, Object> m = new HashMap<>();
        var cab = r.cabecalho();
        var doc = r.totaisDocumento();
        var exec = r.totaisExecucao();

        m.put("importacaoId", r.importacaoId());
        m.put("clienteCodigo", cab.clienteCodigo());
        m.put("clienteNome", cab.clienteNome());
        m.put("criadoEmIso", cab.criadoEmIso());
        m.put("arquivoNome", cab.arquivoNome());
        m.put("usuario", cab.usuario());

        m.put("unidadesDocumento", doc.unidades());
        m.put("titulosDocumento", doc.titulos());
        m.put("titulosInseridos", exec.titulosInseridos());
        m.put("titulosIgnorados", exec.titulosIgnorados());
        m.put("titulosFalhados", exec.titulosFalhados());
        m.put("processosCriados", exec.processosCriados());
        m.put("processosReutilizados", exec.processosReutilizados());
        m.put("pessoasCriadas", exec.pessoasCriadas());
        m.put("revisoesTrocaDono", exec.revisoesTrocaDono());
        m.put("regraInicio", r.regraInicio());

        boolean ok = CobrancaRelatorioMontador.reconciliacaoFecha(doc, exec);
        m.put("reconciliacaoOk", ok);

        m.put("pontosAtencao", r.pontosAtencao() != null ? r.pontosAtencao() : List.of());
        m.put("itens", r.itens() != null ? r.itens() : List.of());
        m.put("erros", r.erros() != null ? r.erros() : List.of());

        List<Map<String, Object>> ignoradosFlat = new ArrayList<>();
        List<Map<String, Object>> processosCriados = new ArrayList<>();
        List<Map<String, Object>> trocaDono = new ArrayList<>();

        for (RelatorioItemUnidadeDto it : r.itens() != null ? r.itens() : List.<RelatorioItemUnidadeDto>of()) {
            if (it.ignorados() != null) {
                for (RelatorioDebitoIgnoradoDto ig : it.ignorados()) {
                    Map<String, Object> row = new HashMap<>();
                    row.put("codigoUnidade", it.codigoUnidade());
                    row.put("numeroInterno", ig.numeroInterno() != null ? ig.numeroInterno() : it.numeroInterno());
                    row.put("vencimento", ig.vencimento());
                    row.put("valor", ig.valor());
                    row.put("dimensaoExistente", ig.dimensaoExistente());
                    row.put("motivo", ig.motivo());
                    ignoradosFlat.add(row);
                }
            }
            if (it.processoCriado()) {
                Map<String, Object> row = new HashMap<>();
                row.put("codigoUnidade", it.codigoUnidade());
                row.put("numeroInterno", it.numeroInterno());
                row.put("processoId", it.processoId());
                processosCriados.add(row);
            }
            if (it.revisaoTrocaDono()) {
                Map<String, Object> row = new HashMap<>();
                row.put("codigoUnidade", it.codigoUnidade());
                row.put("numeroInterno", it.numeroInterno());
                row.put("pessoaIdReuAnterior", it.pessoaIdReuAnterior());
                trocaDono.add(row);
            }
        }

        m.put("ignoradosFlat", ignoradosFlat);
        m.put("processosCriadosLista", processosCriados);
        m.put("trocaDonoLista", trocaDono);
        return m;
    }
}
