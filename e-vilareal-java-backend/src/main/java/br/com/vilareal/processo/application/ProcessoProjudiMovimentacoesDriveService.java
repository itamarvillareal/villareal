package br.com.vilareal.processo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.email.ProjudiMovimentacoesAcervoIntegralEstado;
import br.com.vilareal.processo.api.dto.ProcessoProjudiMovimentacoesDriveResponse;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.projudi.ProjudiOrquestradorService;
import br.com.vilareal.projudi.ProjudiTeorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
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
    private final ProjudiTeorService teorService;
    private final ProjudiMovimentacoesAcervoIntegralEstado acervoIntegralEstado;
    private final Long credencialIdPadrao;

    public ProcessoProjudiMovimentacoesDriveService(
            ProcessoRepository processoRepository,
            ProjudiOrquestradorService orquestradorService,
            ProjudiTeorService teorService,
            @Autowired(required = false) ProjudiMovimentacoesAcervoIntegralEstado acervoIntegralEstado,
            @Value("${projudi.orquestrador.credencial-id-padrao:1}") Long credencialIdPadrao) {
        this.processoRepository = processoRepository;
        this.orquestradorService = orquestradorService;
        this.teorService = teorService;
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

        LocalDate dataProtocoloAntes = processo.getDataProtocolo();
        ProjudiOrquestradorService.ResultadoSomenteDriveProcesso resultado =
                orquestradorService.executarSomenteDriveProgressivo(
                        credencialIdPadrao, processo, new ArrayList<>());

        LocalDate dataDistribuicao = resultado.dataDistribuicaoProjudi();
        if (dataDistribuicao == null) {
            dataDistribuicao =
                    teorService.consultarProcesso(credencialIdPadrao, processo.getNumeroCnj().trim())
                            .dataDistribuicao();
        }

        LocalDate dataProtocolo = sincronizarDataProtocoloSeVazio(processo, dataDistribuicao);
        boolean dataProtocoloSincronizada = dataProtocoloAntes == null && dataProtocolo != null;
        LocalDate dataProtocoloResposta = dataProtocoloSincronizada ? dataProtocolo : null;

        if (acervoIntegralEstado != null) {
            acervoIntegralEstado.atualizarAposExecucaoDrive(processoId, resultado);
        }

        if (resultado.erro() != null) {
            return new ProcessoProjudiMovimentacoesDriveResponse(
                    0,
                    resultado.totalComDocumento(),
                    resultado.totalArquivadasDrive(),
                    false,
                    montarMensagemErro(resultado, dataProtocoloSincronizada),
                    resumoSelecao(resultado),
                    resultado.erro(),
                    dataProtocoloResposta);
        }

        String mensagem = montarMensagem(resultado, dataProtocoloSincronizada);
        return new ProcessoProjudiMovimentacoesDriveResponse(
                resultado.arquivosBaixados(),
                resultado.totalComDocumento(),
                resultado.totalArquivadasDrive(),
                resultado.temMais(),
                mensagem,
                resumoSelecao(resultado),
                null,
                dataProtocoloResposta);
    }

    private LocalDate sincronizarDataProtocoloSeVazio(
            ProcessoEntity processo, LocalDate dataDistribuicaoProjudi) {
        if (processo.getDataProtocolo() != null || dataDistribuicaoProjudi == null) {
            return processo.getDataProtocolo();
        }
        processo.setDataProtocolo(dataDistribuicaoProjudi);
        processoRepository.save(processo);
        return dataDistribuicaoProjudi;
    }

    private static String resumoSelecao(ProjudiOrquestradorService.ResultadoSomenteDriveProcesso resultado) {
        Object s = resultado.toRelatorioMap().get("selecao");
        return s != null ? String.valueOf(s) : null;
    }

    private static String montarMensagemErro(
            ProjudiOrquestradorService.ResultadoSomenteDriveProcesso resultado,
            boolean dataProtocoloSincronizada) {
        String base = String.valueOf(resultado.erro());
        if (dataProtocoloSincronizada) {
            base += " Data do protocolo preenchida a partir do Projudi.";
        }
        return base;
    }

    private static String montarMensagem(
            ProjudiOrquestradorService.ResultadoSomenteDriveProcesso resultado,
            boolean dataProtocoloSincronizada) {
        int baixados = resultado.arquivosBaixados();
        String base;
        if (baixados <= 0) {
            if (resultado.totalComDocumento() <= 0) {
                base = "Nenhuma movimentação com documento encontrada no PROJUDI.";
            } else if (!resultado.temMais()) {
                base = "Todas as movimentações com documento já estão no Drive ("
                        + resultado.totalComDocumento()
                        + " com arquivo no PROJUDI). "
                        + "Intimações/publicações só no portal, sem PDF anexo, não entram na pasta.";
            } else {
                base = "Nenhum arquivo novo enviado neste passo. Clique novamente para continuar o arquivamento.";
            }
        } else {
            base = baixados + " arquivo(s) enviado(s) ao Drive.";
            if (resultado.temMais()) {
                base += " Clique novamente para buscar mais movimentações.";
            }
        }
        if (dataProtocoloSincronizada) {
            base += " Data do protocolo preenchida a partir do Projudi.";
        }
        return base;
    }
}
