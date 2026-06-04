package br.com.vilareal.email;

import br.com.vilareal.projudi.ProjudiOrquestradorService;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Memória usada <strong>somente</strong> pelo pipeline automático ({@code pipeline_projudi_movimentacoes}):
 * processos cuja última passagem indicou cópia integral ({@code temMais=false}). Evita reconsultas
 * no loop até um novo e-mail reativar o processo.
 *
 * <p>A consulta manual em {@link br.com.vilareal.processo.application.ProcessoProjudiMovimentacoesDriveService}
 * (botão «Obter movimentações») <strong>não</strong> consulta {@link #estaCompleto(Long)} e sempre chama o PROJUDI.
 */
@Component
public class ProjudiMovimentacoesAcervoIntegralEstado {

    private final Set<Long> processosComAcervoIntegral = ConcurrentHashMap.newKeySet();

    public boolean estaCompleto(Long processoId) {
        return processoId != null && processosComAcervoIntegral.contains(processoId);
    }

    public void marcarCompleto(Long processoId) {
        if (processoId != null) {
            processosComAcervoIntegral.add(processoId);
        }
    }

    public void reviver(Long processoId) {
        if (processoId != null) {
            processosComAcervoIntegral.remove(processoId);
        }
    }

    public int quantidadeCompletos() {
        return processosComAcervoIntegral.size();
    }

    /** Todos os elegíveis da janela já estão com acervo integral marcado. */
    public boolean todosElegiveisCompletos(Collection<Long> elegiveis) {
        if (elegiveis == null || elegiveis.isEmpty()) {
            return false;
        }
        for (Long id : elegiveis) {
            if (!estaCompleto(id)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Fila Drive: primeiro processos ativados neste ciclo (e-mail novo), depois elegíveis ainda incompletos.
     */
    public static List<Long> montarFilaDrive(
            List<Long> elegiveis, Collection<Long> ativadosNoCiclo, ProjudiMovimentacoesAcervoIntegralEstado estado) {
        LinkedHashSet<Long> fila = new LinkedHashSet<>();
        if (ativadosNoCiclo != null) {
            for (Long id : ativadosNoCiclo) {
                if (id == null) {
                    continue;
                }
                if (estado != null) {
                    estado.reviver(id);
                }
                fila.add(id);
            }
        }
        if (elegiveis != null) {
            for (Long id : elegiveis) {
                if (id == null) {
                    continue;
                }
                if (estado == null || !estado.estaCompleto(id)) {
                    fila.add(id);
                }
            }
        }
        return List.copyOf(fila);
    }

    public static boolean indicaAcervoIntegralCompleto(ProjudiOrquestradorService.ResultadoSomenteDriveProcesso resultado) {
        if (resultado == null || resultado.erro() != null) {
            return false;
        }
        if (resultado.temMais()) {
            return false;
        }
        int comDoc = resultado.totalComDocumento();
        if (comDoc <= 0) {
            return false;
        }
        return resultado.totalArquivadasDrive() >= comDoc;
    }

    public void atualizarAposExecucaoDrive(Long processoId, ProjudiOrquestradorService.ResultadoSomenteDriveProcesso resultado) {
        if (processoId == null || resultado == null) {
            return;
        }
        if (indicaAcervoIntegralCompleto(resultado)) {
            marcarCompleto(processoId);
        } else if (resultado.erro() == null && resultado.totalComDocumento() > 0) {
            reviver(processoId);
        }
    }
}
