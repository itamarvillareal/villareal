package br.com.vilareal.pje.application;

/**
 * Operações pós-login no PJe TRT18 (fora de {@link PjeBrowserDriver}).
 * Implementada por {@code PlaywrightPjeBrowserDriver} quando Playwright está habilitado.
 */
public interface PjeTrt18ProcessoAutomation {

    /** Navega ao acervo-geral do CNJ (press Enter no combobox). */
    void buscarProcessoPorCnj(String numeroCnj);

    /**
     * Clica cópia integral, captura download blob via contexto (até 3 tentativas).
     *
     * @return bytes do PDF
     */
    byte[] baixarCopiaIntegralPdf(String numeroCnj);

    boolean playwrightAtivo();
}
