package br.com.vilareal.assinatura.cms;

import java.util.List;

/**
 * Relatório estrutural de um .p7s — sem expor subject/CN/CPF do signatário.
 */
public record CmsStructureReport(
        boolean cmsValido,
        boolean attached,
        String eContentTypeOid,
        String digestAlgorithmOid,
        String signatureAlgorithmOid,
        List<String> signedAttributeOids,
        List<String> forbiddenAttributeOidsPresentes,
        List<String> icpBrasilPolicyOidsPresentes,
        int certificateCount,
        List<String> certificateIssuerSha256,
        int signerPublicKeyBits,
        byte[] embeddedPdf,
        boolean assinaturaCriptograficamenteValida,
        String motivoFalha) {

    public static CmsStructureReport invalido(String motivo) {
        return new CmsStructureReport(
                false,
                false,
                null,
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                0,
                List.of(),
                0,
                null,
                false,
                motivo);
    }
}
