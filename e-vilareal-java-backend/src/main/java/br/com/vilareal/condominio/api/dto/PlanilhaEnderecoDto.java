package br.com.vilareal.condominio.api.dto;

/**
 * Endereço da unidade na planilha (antes de montar {@code rua} completa na importação).
 */
public record PlanilhaEnderecoDto(
        String cep,
        String logradouro,
        String numero,
        String bairro,
        String complemento,
        String cidadeUfBruto,
        String cidade,
        String uf) {}
