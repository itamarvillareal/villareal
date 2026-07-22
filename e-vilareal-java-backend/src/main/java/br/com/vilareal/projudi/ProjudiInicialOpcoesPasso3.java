package br.com.vilareal.projudi;

import java.util.Map;

/** Checkboxes da seção «Opções» na confirmação (Passo 3) do cadastro de inicial. */
public record ProjudiInicialOpcoesPasso3(
        boolean segredoJustica, boolean naoMarcarAudiencia, boolean juizo100Digital) {

    public static final ProjudiInicialOpcoesPasso3 PADRAO = new ProjudiInicialOpcoesPasso3(false, false, false);

    public static ProjudiInicialOpcoesPasso3 of(
            Boolean segredoJustica, Boolean naoMarcarAudiencia, Boolean juizo100Digital) {
        return new ProjudiInicialOpcoesPasso3(
                Boolean.TRUE.equals(segredoJustica),
                Boolean.TRUE.equals(naoMarcarAudiencia),
                Boolean.TRUE.equals(juizo100Digital));
    }

    /**
     * Sobrescreve os checkboxes capturados do HTML da revisão.
     * Valores conforme o formulário PROJUDI: {@code NaoMarcarAudiencia} envia {@code false} quando marcado.
     */
    public void aplicarEmCampos(Map<String, String> campos) {
        if (campos == null) {
            return;
        }
        aplicarCheckbox(campos, "SegredoJustica", segredoJustica, "true");
        aplicarCheckbox(campos, "NaoMarcarAudiencia", naoMarcarAudiencia, "false");
        aplicarCheckbox(campos, "digital100", juizo100Digital, "true");
    }

    private static void aplicarCheckbox(
            Map<String, String> campos, String name, boolean marcado, String valorQuandoMarcado) {
        campos.remove(name);
        if (marcado) {
            campos.put(name, valorQuandoMarcado);
        }
    }
}
