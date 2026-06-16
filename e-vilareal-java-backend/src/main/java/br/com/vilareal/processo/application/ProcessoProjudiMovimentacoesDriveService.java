package br.com.vilareal.processo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.email.ProjudiMovimentacoesAcervoIntegralEstado;
import br.com.vilareal.processo.api.dto.ProcessoProjudiMovimentacoesDriveResponse;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.projudi.ProjudiOrquestradorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;

/**
 * Consulta manual PROJUDI → Drive (UI «Obter movimentações»). Independente do desarme do pipeline:
 * sempre executa {@link ProjudiOrquestradorService#executarSomenteDriveProgressivo}, mesmo que o acervo
 * integral já esteja completo (pode retornar zero arquivos novos).
 */
@Service
public class ProcessoProjudiMovimentacoesDriveService {

    private final ProcessoRepository processoRepository;
    private final ProjudiOrquestradorService orquestradorService;
    private final ProjudiMovimentacoesAcervoIntegralEstado acervoIntegralEstado;
    private final Long credencialIdPadrao;

    public ProcessoProjudiMovimentacoesDriveService(
            ProcessoRepository processoRepository,
            ProjudiOrquestradorService orquestradorService,
            @Autowired(required = false) ProjudiMovimentacoesAcervoIntegralEstado acervoIntegralEstado,
            @Value("${projudi.orquestrador.credencial-id-padrao:1}") Long credencialIdPadrao) {
        this.processoRepository = processoRepository;
        this.orquestradorService = orquestradorService;
        this.acervoIntegralEstado = acervoIntegralEstado;
        this.credencialIdPadrao = credencialIdPadrao;
    }

    public ProcessoProjudiMovimentacoesDriveResponse executar(Long processoId) {
        ProcessoEntity processo = processoRepository
                .findByIdWithClienteAndPessoa(processoId)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));
        if (!StringUtils.hasText(processo.getNumeroCnj())) {
            throw new BusinessRuleException("Processo sem número CNJ — não é possível consultar o PROJUDI.");
        }

        ProjudiOrquestradorService.ResultadoSomenteDriveProcesso resultado =
                orquestradorService.executarSomenteDriveProgressivo(
                        credencialIdPadrao, processo, new ArrayList<>());

        if (acervoIntegralEstado != null) {
            acervoIntegralEstado.atualizarAposExecucaoDrive(processoId, resultado);
        }

        if (resultado.erro() != null) {
            return new ProcessoProjudiMovimentacoesDriveResponse(
                    0,
                    resultado.totalComDocumento(),
                    resultado.totalArquivadasDrive(),
                    false,
                    null,
                    resumoSelecao(resultado),
                    resultado.erro());
        }

        String mensagem = montarMensagem(resultado);
        return new ProcessoProjudiMovimentacoesDriveResponse(
                resultado.arquivosBaixados(),
                resultado.totalComDocumento(),
                resultado.totalArquivadasDrive(),
                resultado.temMais(),
                mensagem,
                resumoSelecao(resultado),
                null);
    }

    private static String resumoSelecao(ProjudiOrquestradorService.ResultadoSomenteDriveProcesso resultado) {
        Object s = resultado.toRelatorioMap().get("selecao");
        return s != null ? String.valueOf(s) : null;
    }

    private static String montarMensagem(ProjudiOrquestradorService.ResultadoSomenteDriveProcesso resultado) {
        int baixados = resultado.arquivosBaixados();
        if (baixados <= 0) {
            if (resultado.totalComDocumento() <= 0) {
                return "Nenhuma movimentação com documento encontrada no PROJUDI.";
            }
            // Conclusão por conjunto (temMais já reflete se ainda faltam números no Drive),
            // não por comparação de contagens.
            if (!resultado.temMais()) {
                return "Todas as movimentações com documento já estão no Drive.";
            }
            return "Nenhum arquivo novo enviado neste passo. Clique novamente para continuar o arquivamento.";
        }
        String base = baixados + " arquivo(s) enviado(s) ao Drive.";
        if (resultado.temMais()) {
            return base + " Clique novamente para buscar mais movimentações.";
        }
        return base;
    }
}
