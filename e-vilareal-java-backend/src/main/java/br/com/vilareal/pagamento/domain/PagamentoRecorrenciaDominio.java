package br.com.vilareal.pagamento.domain;

import java.util.Set;

public final class PagamentoRecorrenciaDominio {

    private PagamentoRecorrenciaDominio() {}

    public static final Set<String> CATEGORIAS_VALIDAS = Set.of(
            "CONDOMINIO",
            "ALUGUEL",
            "TRIBUTO",
            "IMPOSTO",
            "ACORDO",
            "PARCELAMENTO",
            "CLIENTE",
            "FORNECEDOR",
            "PROCESSO_JUDICIAL",
            "FUNCIONARIO",
            "ENERGIA",
            "AGUA",
            "INTERNET",
            "SISTEMA_SOFTWARE",
            "ESCRITORIO",
            "VEICULO",
            "OBRA_REFORMA",
            "OUTROS");

    public static final Set<String> FORMAS_PAGAMENTO_VALIDAS = Set.of(
            "BOLETO",
            "PIX",
            "TRANSFERENCIA",
            "TED_DOC",
            "CARTAO",
            "DEBITO_AUTOMATICO",
            "GUIA_JUDICIAL",
            "DEPOSITO_JUDICIAL",
            "DARF",
            "DAE",
            "GPS",
            "GRU",
            "OUTRO");

    public static final Set<String> PRIORIDADES_VALIDAS = Set.of("BAIXA", "NORMAL", "ALTA", "URGENTE");
}
