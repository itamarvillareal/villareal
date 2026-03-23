package br.com.vilareal.api.service;

import br.com.vilareal.api.dto.AuditoriaAtividadeRequest;
import br.com.vilareal.api.dto.AuditoriaAtividadeResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;

public interface AuditoriaAtividadeService {

    AuditoriaAtividadeResponse registrar(AuditoriaAtividadeRequest request);

    /**
     * Uso interno (ex.: serviços de domínio durante uma requisição HTTP com {@code UsuarioContext} preenchido).
     */
    void registrarInterno(String tipoAcao, String modulo, String tela, String descricao,
                          String registroAfetadoId, String registroAfetadoNome, String observacoesTecnicas);

    Page<AuditoriaAtividadeResponse> buscar(
            LocalDate dataInicio,
            LocalDate dataFim,
            String usuarioId,
            String modulo,
            String tipoAcao,
            String registroAfetadoId,
            String textoLivre,
            Pageable pageable);
}
