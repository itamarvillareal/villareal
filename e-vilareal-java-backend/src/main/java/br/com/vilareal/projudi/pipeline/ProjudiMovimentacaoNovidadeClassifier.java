package br.com.vilareal.projudi.pipeline;

import br.com.vilareal.projudi.ProjudiTeorService.MovimentacaoProjudi;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Classifica movimentações PROJUDI com documento em novas (hash inexistente) vs já conhecidas,
 * com o mesmo cap {@code maxMovimentacoesComDoc} do modo completo do orquestrador.
 */
@Component
public class ProjudiMovimentacaoNovidadeClassifier {

    private static final Logger log = LoggerFactory.getLogger(ProjudiMovimentacaoNovidadeClassifier.class);

    private final PublicacaoRepository publicacaoRepository;

    public ProjudiMovimentacaoNovidadeClassifier(PublicacaoRepository publicacaoRepository) {
        this.publicacaoRepository = publicacaoRepository;
    }

    /**
     * @param movsComDocumento sequência já filtrada (com documento), na ordem PROJUDI — sem reordenar
     */
    public ClassificacaoNovidade classificar(
            String numeroCnj,
            List<MovimentacaoProjudi> movsComDocumento,
            Integer maxMovimentacoesComDoc) {
        int teoresNovos = 0;
        int teoresJaExistentes = 0;
        int movComDocProcessadas = 0;
        List<MovimentacaoProjudi> novas = new ArrayList<>();

        if (movsComDocumento == null || movsComDocumento.isEmpty()) {
            return new ClassificacaoNovidade(List.of(), 0, 0);
        }

        for (MovimentacaoProjudi mov : movsComDocumento) {
            movComDocProcessadas++;
            if (maxMovimentacoesComDoc != null && maxMovimentacoesComDoc > 0
                    && movComDocProcessadas > maxMovimentacoesComDoc) {
                break;
            }

            String hashConteudo = ProjudiMovimentacaoHashUtil.hashConteudoMovimentacao(numeroCnj, mov.idMovi());
            boolean hashJaExiste = publicacaoRepository.existsByHashConteudo(hashConteudo);
            log.info("PROJUDI dedup hash={} existe={}", hashConteudo, hashJaExiste);
            if (hashJaExiste) {
                teoresJaExistentes++;
                continue;
            }

            teoresNovos++;
            novas.add(mov);
        }

        return new ClassificacaoNovidade(List.copyOf(novas), teoresNovos, teoresJaExistentes);
    }

    public record ClassificacaoNovidade(
            List<MovimentacaoProjudi> novas,
            int teoresNovos,
            int teoresJaExistentes) {}
}
