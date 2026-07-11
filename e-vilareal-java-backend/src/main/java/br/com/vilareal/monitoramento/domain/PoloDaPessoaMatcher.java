package br.com.vilareal.monitoramento.domain;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Determina o polo da pessoa monitorada num processo descoberto, comparando o nome dela
 * contra as partes das células "Polo Ativo"/"Polo Passivo" da lista do PROJUDI.
 *
 * <p><b>Regra ASSIMÉTRICA, deliberada:</b> o nome da parte muda ao longo do tempo sob o
 * mesmo CNPJ (ex.: "Se77E Telecom Eireli" → "Sette Telecom Ltda"), então o não-casamento
 * NÃO é evidência de ausência. {@link PoloDaPessoa#INDETERMINADO} e {@link PoloDaPessoa#AMBOS}
 * nunca são descartados automaticamente — falso positivo custa um clique; falso negativo
 * custa uma citação perdida.</p>
 */
public final class PoloDaPessoaMatcher {

    /**
     * Sufixos societários inequívocos: removidos quando são TOKEN FINAL isolado (precedidos
     * de espaço, fim da string) — nunca por substring ("ROSANA SANTOS" e "CASA" ficam
     * intactos). "S A" é "S.A" após a normalização trocar pontuação por espaço.
     */
    private static final Set<String> SUFIXOS_FORTES = Set.of("LTDA", "EIRELI", "SA", "S A");

    /**
     * Sufixos AMBÍGUOS ("ME", "EPP" — porte da empresa, mas "Me" pode ser sobrenome): só
     * removidos quando o que sobra termina em sufixo forte (padrão real "X LTDA - ME").
     * "CASA GRANDE ME" fica intacto.
     */
    private static final Set<String> SUFIXOS_AMBIGUOS = Set.of("ME", "EPP");

    private PoloDaPessoaMatcher() {}

    public static PoloDaPessoa determinar(
            String nomePessoa, List<String> partesAtivo, List<String> partesPassivo) {
        boolean casaAtivo = casaEmAlguma(nomePessoa, partesAtivo);
        boolean casaPassivo = casaEmAlguma(nomePessoa, partesPassivo);
        if (casaAtivo && casaPassivo) {
            return PoloDaPessoa.AMBOS;
        }
        if (casaAtivo) {
            return PoloDaPessoa.ATIVO;
        }
        if (casaPassivo) {
            return PoloDaPessoa.PASSIVO;
        }
        return PoloDaPessoa.INDETERMINADO;
    }

    /**
     * Único descarte automático permitido: pessoa vigiada SÓ como réu ({@code poloMonitorado=
     * PASSIVO}) e polo detectado com certeza {@code ATIVO}. Qualquer dúvida (INDETERMINADO,
     * AMBOS) vira alerta.
     */
    public static boolean descartarAutomaticamente(String poloMonitorado, PoloDaPessoa poloDetectado) {
        return "PASSIVO".equalsIgnoreCase(poloMonitorado) && poloDetectado == PoloDaPessoa.ATIVO;
    }

    static boolean casaEmAlguma(String nomePessoa, List<String> partes) {
        String alvo = normalizar(nomePessoa);
        if (alvo.isBlank() || partes == null) {
            return false;
        }
        for (String parte : partes) {
            String p = normalizar(parte);
            if (p.isBlank()) {
                continue;
            }
            // Igualdade após normalização, ou continência (a lista às vezes traz o nome
            // truncado/incompleto — ex.: "Leila Carla Silva E Ribeiro" para
            // "LEILA CARLA SILVA E RIBEIRO BORGES"). Guarda de tamanho evita continência
            // trivial de nomes muito curtos.
            if (p.equals(alvo)) {
                return true;
            }
            if (p.length() >= 10 && alvo.length() >= 10 && (alvo.contains(p) || p.contains(alvo))) {
                return true;
            }
        }
        return false;
    }

    /** Maiúsculas, sem acento, sem pontuação, sem sufixo societário final, espaços colapsados. */
    static String normalizar(String nome) {
        if (nome == null) {
            return "";
        }
        String s = Normalizer.normalize(nome, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        boolean removeu = true;
        while (removeu) {
            removeu = false;
            for (String sufixo : SUFIXOS_FORTES) {
                String semSufixo = removerTokenFinal(s, sufixo);
                if (semSufixo != null) {
                    s = semSufixo;
                    removeu = true;
                }
            }
            for (String sufixo : SUFIXOS_AMBIGUOS) {
                String semSufixo = removerTokenFinal(s, sufixo);
                if (semSufixo != null && terminaComSufixoForte(semSufixo)) {
                    s = semSufixo;
                    removeu = true;
                }
            }
        }
        return s;
    }

    /** Remove o sufixo APENAS como token final isolado; null se não for o token final. */
    private static String removerTokenFinal(String s, String sufixo) {
        if (!s.endsWith(" " + sufixo)) {
            return null;
        }
        return s.substring(0, s.length() - sufixo.length() - 1).trim();
    }

    private static boolean terminaComSufixoForte(String s) {
        for (String forte : SUFIXOS_FORTES) {
            if (s.endsWith(" " + forte)) {
                return true;
            }
        }
        return false;
    }
}
