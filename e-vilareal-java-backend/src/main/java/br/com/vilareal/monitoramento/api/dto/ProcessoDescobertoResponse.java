package br.com.vilareal.monitoramento.api.dto;

import br.com.vilareal.monitoramento.domain.RotuloProcessoDescoberto;
import br.com.vilareal.monitoramento.infrastructure.persistence.entity.ProcessoDescobertoEntity;

import java.time.Instant;
import java.time.LocalDateTime;

/**
 * Item de processo descoberto para a tela de monitoramento.
 *
 * <p>{@code rotulo} é derivado AQUI ({@link RotuloProcessoDescoberto}); a tela exibe o rótulo
 * pronto e nunca interpreta {@code situacao} para fins de exibição — o enum cru segue no
 * payload apenas para filtros e ações (Ignorar/Cadastrar).</p>
 */
public record ProcessoDescobertoResponse(
        Long id,
        PessoaRef pessoa,
        String numeroReduzido,
        Integer anoDistribuicao,
        LocalDateTime dataDistribuicao,
        String numeroCnj,
        String classe,
        String serventia,
        String poloDaPessoa,
        String partesAtivo,
        String partesPassivo,
        String situacao,
        Long processoId,
        String rotulo,
        Instant primeiroVistoEm) {

    public record PessoaRef(Long id, String nome) {}

    public static ProcessoDescobertoResponse de(ProcessoDescobertoEntity d) {
        Long processoId = d.getProcesso() == null ? null : d.getProcesso().getId();
        return new ProcessoDescobertoResponse(
                d.getId(),
                new PessoaRef(d.getPessoa().getId(), d.getPessoa().getNome()),
                d.getNumeroReduzido(),
                d.getAnoDistribuicao(),
                d.getDataDistribuicao(),
                d.getNumeroCnj(),
                d.getClasse(),
                d.getServentia(),
                d.getPoloDaPessoa().name(),
                d.getPartesAtivo(),
                d.getPartesPassivo(),
                d.getSituacao().name(),
                processoId,
                RotuloProcessoDescoberto.derivar(d.getSituacao(), processoId != null),
                d.getPrimeiroVistoEm());
    }
}
