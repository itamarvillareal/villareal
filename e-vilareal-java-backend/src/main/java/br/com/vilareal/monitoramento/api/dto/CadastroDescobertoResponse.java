package br.com.vilareal.monitoramento.api.dto;

import java.util.List;

/**
 * Resultado do cadastro de um clique. {@code resultado}:
 *
 * <ul>
 *   <li>{@code JA_CADASTRADO} — o CNJ já existe no acervo; NENHUM processo foi criado, o
 *       descoberto foi vinculado ao existente.</li>
 *   <li>{@code PENDENTE_CONFIRMACAO} — falta o usuário escolher cliente e/ou número interno;
 *       nada foi criado. {@code clientesCandidatos}/{@code numeroInternoSugerido} orientam o
 *       modal (sugestão pode ser null = campo em branco para o usuário preencher).</li>
 *   <li>{@code CRIADO} — processo novo criado e descoberto vinculado.</li>
 * </ul>
 */
public record CadastroDescobertoResponse(
        String resultado,
        String mensagem,
        Long processoId,
        Integer numeroInterno,
        Long clienteIdUsado,
        List<ClienteCandidato> clientesCandidatos,
        Integer numeroInternoSugerido,
        ProcessoDescobertoResponse descoberto) {

    public record ClienteCandidato(Long id, String codigoCliente, String rotulo) {}
}
