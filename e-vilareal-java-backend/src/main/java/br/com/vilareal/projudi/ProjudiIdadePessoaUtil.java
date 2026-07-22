package br.com.vilareal.projudi;

import java.time.LocalDate;

/** Regras de idade para protocolo de inicial PROJUDI. */
final class ProjudiIdadePessoaUtil {

    private ProjudiIdadePessoaUtil() {}

    static boolean maiorDe60Anos(LocalDate dataNascimento) {
        if (dataNascimento == null) {
            return false;
        }
        return !dataNascimento.plusYears(60).isAfter(LocalDate.now());
    }
}
