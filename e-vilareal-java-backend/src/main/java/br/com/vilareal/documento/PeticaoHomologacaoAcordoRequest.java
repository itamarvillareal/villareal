package br.com.vilareal.documento;

import java.time.LocalDate;
import java.util.List;

/** Request da geração da petição interlocutória de homologação de acordo. */
public record PeticaoHomologacaoAcordoRequest(
        Long processoId,
        String numeroCnj,
        String enderecamento,
        LocalDate data,
        String unidade,
        /** Total geral exatamente como exibido na tela de cálculos (INV1). */
        String totalGeral,
        List<PeticaoExecucaoRequest.TituloDto> titulos,
        List<BoletoParcelaDto> boletos,
        ClausulasHomologacaoDto clausulas,
        /** Texto HTML editado na prévia (substitui a montagem automática do corpo). */
        PeticaoHomologacaoAcordoConteudoPreview conteudoEditado) {

    public record BoletoParcelaDto(String valorParcela, String vencimento) {}

    public record ClausulasHomologacaoDto(
            String multaPercent,
            String jurosPercent,
            String honorariosPercent,
            String formaPagamentoTexto,
            Boolean incluirArt1335,
            Boolean incluirIrrevogavel,
            Boolean incluirDesistenciaRecursos,
            Boolean incluirCustas90,
            Boolean incluirArt922,
            Boolean incluirDesbloqueioContas,
            /** EXECUTADO ou EXEQUENTE. */
            String destinatarioDesbloqueio) {}
}
