package br.com.vilareal.documento;

import java.util.ArrayList;
import java.util.List;

/** Texto fixo das cláusulas do contrato de locação — esqueleto para evolução paralela ao modelo legado. */
final class ContratoAluguelClausulas {

    private ContratoAluguelClausulas() {}

    static List<String> montarClausulas() {
        List<String> clausulas = new ArrayList<>(3);
        clausulas.add(
                "Cláusula 1ª. O LOCADOR concede ao(s) LOCATÁRIO(S) o uso do imóvel objeto deste contrato, "
                        + "nas condições e prazo a serem detalhados nas cláusulas seguintes do modelo definitivo.");
        clausulas.add(
                "Cláusula 2ª. O valor do aluguel, forma de pagamento, reajuste, encargos e demais "
                        + "condições locatícias serão definidos conforme o modelo de contrato de locação do escritório.");
        clausulas.add(
                "Cláusula 3ª. Fica eleito o foro da Comarca de Anápolis, Estado de Goiás, para dirimir "
                        + "quaisquer dúvidas oriundas do presente instrumento.");
        return clausulas;
    }

    static String montarFecho() {
        return ContratoFechoTexto.montarFechoAluguel(ContratoFormaAssinatura.DUAS_VIAS);
    }
}
