package br.com.vilareal.imovel.api.dto;

import br.com.vilareal.financeiro.domain.ConfiancaSugestao;

import java.math.BigDecimal;
import java.util.List;

/** Obrigações de condomínio detectadas no extrato — agrupadas por condomínio/imóvel. */
public record DespesaCondominioCandidatosResponse(
        int quantidadeGrupos,
        int gruposImovelUnico,
        int gruposCondominioCompartilhado,
        int gruposSemMatch,
        List<GrupoDespesaCondominio> grupos) {

    public record SerieExtratoItem(String mes, BigDecimal valor, String grafia) {}

    public record GrupoDespesaCondominio(
            String obrigacaoChave,
            String condominioNome,
            List<String> grafias,
            String descricaoExemplo,
            BigDecimal valorEstimado,
            int diaTipico,
            int ocorrencias,
            List<String> mesesCobertos,
            List<SerieExtratoItem> serieExtrato,
            boolean grafiasMesmaObrigacao,
            ConfiancaSugestao confianca,
            Long imovelSugeridoId,
            Integer imovelSugeridoNumeroPlanilha,
            String imovelSugeridoRotulo,
            List<ImovelCandidato> unidadesCandidatas,
            boolean historicoDespesaConfirmado) {}

    public record ImovelCandidato(
            Long imovelId,
            Integer numeroPlanilha,
            String unidade,
            String condominio,
            String enderecoResumo) {}
}
