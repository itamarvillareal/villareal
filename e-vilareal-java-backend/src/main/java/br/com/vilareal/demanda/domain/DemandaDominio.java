package br.com.vilareal.demanda.domain;

import java.util.Set;

public final class DemandaDominio {

    private DemandaDominio() {}

    public static final String STATUS_ABERTO = "ABERTO";
    public static final String STATUS_EM_ANDAMENTO = "EM_ANDAMENTO";
    public static final String STATUS_AGUARDANDO = "AGUARDANDO";
    public static final String STATUS_CONCLUIDO = "CONCLUIDO";
    public static final String STATUS_CANCELADO = "CANCELADO";

    public static final Set<String> STATUS_VALIDOS = Set.of(
            STATUS_ABERTO,
            STATUS_EM_ANDAMENTO,
            STATUS_AGUARDANDO,
            STATUS_CONCLUIDO,
            STATUS_CANCELADO);

    public static final Set<String> STATUS_ATIVOS = Set.of(STATUS_ABERTO, STATUS_EM_ANDAMENTO, STATUS_AGUARDANDO);

    public static final String CAT_MANUTENCAO = "MANUTENCAO";
    public static final String CAT_REFORMA = "REFORMA";
    public static final String CAT_JURIDICO = "JURIDICO";
    public static final String CAT_DOCUMENTACAO = "DOCUMENTACAO";
    public static final String CAT_VISTORIA = "VISTORIA";
    public static final String CAT_IMPOSTO_TAXA = "IMPOSTO_TAXA";
    public static final String CAT_SEGURO = "SEGURO";
    public static final String CAT_CONDOMINIO = "CONDOMINIO";
    public static final String CAT_COBRANCA = "COBRANCA";
    public static final String CAT_OUTRO = "OUTRO";

    public static final Set<String> CATEGORIAS_VALIDAS = Set.of(
            CAT_MANUTENCAO,
            CAT_REFORMA,
            CAT_JURIDICO,
            CAT_DOCUMENTACAO,
            CAT_VISTORIA,
            CAT_IMPOSTO_TAXA,
            CAT_SEGURO,
            CAT_CONDOMINIO,
            CAT_COBRANCA,
            CAT_OUTRO);
}
