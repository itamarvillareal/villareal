package br.com.vilareal.condominio.application;

import br.com.vilareal.calculo.application.ResultadoMerge;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.condominio.api.dto.CobrancaProcessarErroDto;
import br.com.vilareal.condominio.api.dto.CobrancaUnidadeRequestDto;
import br.com.vilareal.condominio.api.dto.InadimplenciaCobrancaDto;
import br.com.vilareal.condominio.api.dto.RelatorioCabecalhoDto;
import br.com.vilareal.condominio.api.dto.RelatorioDebitoIgnoradoDto;
import br.com.vilareal.condominio.api.dto.RelatorioDebitoInseridoDto;
import br.com.vilareal.condominio.api.dto.RelatorioExecucaoCobranca;
import br.com.vilareal.condominio.api.dto.RelatorioRegraInicioDto;
import br.com.vilareal.condominio.api.dto.RelatorioItemUnidadeDto;
import br.com.vilareal.condominio.api.dto.RelatorioTotaisDocumentoDto;
import br.com.vilareal.condominio.api.dto.RelatorioTotaisExecucaoDto;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class CobrancaRelatorioMontador {

    public RelatorioExecucaoCobranca montar(
            String importacaoId,
            Instant criadoEm,
            String clienteCodigo,
            String clienteNome,
            String arquivoNome,
            String usuario,
            List<CobrancaUnidadeRequestDto> unidadesAcionadas,
            RelatorioRegraInicioDto regraInicio,
            List<UnidadeProcessamentoResult> sucessos,
            List<CobrancaProcessarErroDto> erros) {

        RelatorioCabecalhoDto cabecalho = new RelatorioCabecalhoDto(
                importacaoId,
                criadoEm.toString(),
                clienteCodigo,
                Utf8MojibakeUtil.corrigir(clienteNome),
                arquivoNome,
                usuario);

        int titulosDocumento = contarTitulosDocumento(unidadesAcionadas);
        RelatorioTotaisDocumentoDto totaisDocumento =
                new RelatorioTotaisDocumentoDto(unidadesAcionadas.size(), titulosDocumento);

        List<RelatorioItemUnidadeDto> itens = new ArrayList<>();
        int titulosInseridos = 0;
        int titulosIgnorados = 0;
        int processosCriados = 0;
        int processosReutilizados = 0;
        int pessoasCriadas = 0;
        int revisoes = 0;

        for (UnidadeProcessamentoResult u : sucessos) {
            RelatorioItemUnidadeDto item = toItem(u);
            itens.add(item);
            titulosInseridos += item.debitosInseridos();
            titulosIgnorados += item.debitosIgnorados();
            if (item.processoCriado()) {
                processosCriados++;
            } else {
                processosReutilizados++;
            }
            if (item.pessoaCriada()) {
                pessoasCriadas++;
            }
            if (item.revisaoTrocaDono()) {
                revisoes++;
            }
        }

        int titulosFalhados = contarTitulosUnidadesComErro(unidadesAcionadas, erros);
        int unidadesComErro = erros.size();

        RelatorioTotaisExecucaoDto totaisExecucao = new RelatorioTotaisExecucaoDto(
                sucessos.size(),
                unidadesComErro,
                titulosInseridos,
                titulosIgnorados,
                titulosFalhados,
                processosCriados,
                processosReutilizados,
                pessoasCriadas,
                revisoes);

        List<String> pontos = derivarPontosAtencao(totaisDocumento, totaisExecucao, regraInicio);

        return new RelatorioExecucaoCobranca(
                importacaoId, cabecalho, totaisDocumento, totaisExecucao, regraInicio, itens, erros, pontos);
    }

    static List<String> derivarPontosAtencao(
            RelatorioTotaisDocumentoDto doc,
            RelatorioTotaisExecucaoDto exec,
            RelatorioRegraInicioDto regraInicio) {
        List<String> out = new ArrayList<>();
        if (regraInicio != null && regraInicio.devedoresDescartados() > 0) {
            out.add(regraInicio.devedoresDescartados()
                    + " devedor(es) não atingiram a regra "
                    + regraInicio.regraAplicada()
                    + " e foram descartados (não importados).");
        }
        int soma = exec.titulosInseridos() + exec.titulosIgnorados() + exec.titulosFalhados();
        if (doc.titulos() != soma) {
            out.add("DIVERGÊNCIA: soma de títulos não fecha.");
        }
        if (exec.revisoesTrocaDono() > 0) {
            out.add(exec.revisoesTrocaDono()
                    + " unidade(s) com troca de dono: débitos em processo NOVO aguardando avaliação.");
        }
        if (exec.unidadesComErro() > 0) {
            out.add(exec.unidadesComErro() + " unidade(s) falharam: ver Erros.");
        }
        if (exec.processosCriados() > 0) {
            out.add(exec.processosCriados()
                    + " processo(s) criados: confirmar se não deveriam já existir (mismatch de unidade?).");
        }
        if (exec.titulosIgnorados() > 0) {
            out.add(exec.titulosIgnorados()
                    + " título(s) ignorados por já existirem (esperado em reprocessamento).");
        }
        return out;
    }

    static boolean reconciliacaoFecha(RelatorioTotaisDocumentoDto doc, RelatorioTotaisExecucaoDto exec) {
        return doc.titulos() == exec.titulosInseridos() + exec.titulosIgnorados() + exec.titulosFalhados();
    }

    private static RelatorioItemUnidadeDto toItem(UnidadeProcessamentoResult u) {
        CobrancaUnidadeRequestDto un = u.unidade();
        ResolucaoUnidade res = u.resolucao();
        ResultadoMerge merge = u.merge();

        List<RelatorioDebitoInseridoDto> inseridos = new ArrayList<>();
        if (merge.dimensoesTocadas() != null) {
            for (ResultadoMerge.DimensaoTocada dim : merge.dimensoesTocadas()) {
                if (dim.insercoes() == null) {
                    continue;
                }
                for (ResultadoMerge.InsercaoDebito ins : dim.insercoes()) {
                    inseridos.add(new RelatorioDebitoInseridoDto(
                            ins.debito().vencimento(),
                            formatBrl(ins.debito().valorCentavos()),
                            ins.dimensao(),
                            ins.posicao()));
                }
            }
        }

        List<RelatorioDebitoIgnoradoDto> ignorados = new ArrayList<>();
        if (merge.debitosIgnorados() != null) {
            for (ResultadoMerge.DebitoIgnorado ig : merge.debitosIgnorados()) {
                ignorados.add(new RelatorioDebitoIgnoradoDto(
                        ig.vencimento(),
                        formatBrl(ig.valorCentavos()),
                        ig.dimensaoExistente(),
                        ig.motivo(),
                        res.numeroInterno()));
            }
        }

        int titulosNaUnidade = inseridos.size() + ignorados.size();
        int dim = CobrancaAndamentoService.dimensaoPrincipal(merge) != null
                ? CobrancaAndamentoService.dimensaoPrincipal(merge)
                : 0;

        return new RelatorioItemUnidadeDto(
                un.codigoUnidadeNormalizada().trim().toUpperCase(Locale.ROOT),
                un.proprietarioNome().trim(),
                CobrancaRelatorioXlsParser.somenteDigitos(un.proprietarioDocDigitos()),
                res.pessoaCriada(),
                res.processoId(),
                res.numeroInterno(),
                res.processoCriado(),
                titulosNaUnidade,
                inseridos.size(),
                ignorados.size(),
                dim,
                res.revisaoTrocaDono(),
                res.pessoaIdReuAnterior(),
                inseridos,
                ignorados);
    }

    static int contarTitulosDocumento(List<CobrancaUnidadeRequestDto> unidades) {
        int n = 0;
        for (CobrancaUnidadeRequestDto u : unidades) {
            n += contarCobrancas(u);
        }
        return n;
    }

    static int contarTitulosUnidadesComErro(
            List<CobrancaUnidadeRequestDto> unidades, List<CobrancaProcessarErroDto> erros) {
        int n = 0;
        for (CobrancaProcessarErroDto e : erros) {
            String cod = e.codigoUnidade() != null ? e.codigoUnidade().trim().toUpperCase(Locale.ROOT) : "";
            for (CobrancaUnidadeRequestDto u : unidades) {
                if (u.codigoUnidadeNormalizada() != null
                        && u.codigoUnidadeNormalizada().trim().equalsIgnoreCase(cod)) {
                    n += contarCobrancas(u);
                    break;
                }
            }
        }
        return n;
    }

    private static int contarCobrancas(CobrancaUnidadeRequestDto u) {
        if (u.cobrancas() == null) {
            return 0;
        }
        int n = 0;
        for (InadimplenciaCobrancaDto c : u.cobrancas()) {
            if (c != null && c.vencimento() != null && !c.vencimento().isBlank()) {
                n++;
            }
        }
        return n;
    }

    static String formatBrl(long centavos) {
        BigDecimal bd = BigDecimal.valueOf(centavos, 2);
        DecimalFormatSymbols sym = DecimalFormatSymbols.getInstance(Locale.forLanguageTag("pt-BR"));
        DecimalFormat df = new DecimalFormat("#,##0.00", sym);
        return df.format(bd);
    }
}
