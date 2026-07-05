package br.com.vilareal.whatsapp.dto;

public record WhatsAppGrupoMaterializacaoEmAndamentoResponse(String mensagem) {

    public static WhatsAppGrupoMaterializacaoEmAndamentoResponse padrao() {
        return new WhatsAppGrupoMaterializacaoEmAndamentoResponse(
                "Materialização já em andamento; tente em instantes.");
    }
}
