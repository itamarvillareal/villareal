package br.com.vilareal.projudi.application;

import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiPeticaoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Service
public class ProjudiPeticaoProtocoloEstadoService {

    static final String STATUS_ASSINADA = "ASSINADA";
    static final String STATUS_PROTOCOLADA = "PROTOCOLADA";
    static final String STATUS_ERRO = "ERRO";

    private final ProjudiPeticaoRepository peticaoRepository;

    public ProjudiPeticaoProtocoloEstadoService(ProjudiPeticaoRepository peticaoRepository) {
        this.peticaoRepository = peticaoRepository;
    }

    @Transactional
    public Optional<String> tentarClaim(Long peticaoId) {
        Optional<ProjudiPeticaoEntity> existente = peticaoRepository.findById(peticaoId);
        if (existente.isEmpty()) {
            return Optional.of("petição não encontrada");
        }
        int afetadas = peticaoRepository.claimParaProtocolo(peticaoId);
        if (afetadas == 0) {
            String statusAtual = existente.get().getStatus();
            return Optional.of("status atual: " + statusAtual + " (esperado " + STATUS_ASSINADA + ")");
        }
        return Optional.empty();
    }

    @Transactional
    public void finalizarProtocolada(Long peticaoId, String mensagem) {
        peticaoRepository.finalizarProtocolo(
                peticaoId, STATUS_PROTOCOLADA, truncarMensagem(mensagem), Instant.now());
    }

    /**
     * Em caso de falha no protocolo, devolve a petição para {@code ASSINADA} (frame "2. Protocolar"),
     * preservando a mensagem do erro para diagnóstico. Permite reenvio imediato sem passar pelo Histórico.
     */
    @Transactional
    public void devolverParaProtocolar(Long peticaoId, String mensagem) {
        peticaoRepository.finalizarProtocolo(peticaoId, STATUS_ASSINADA, truncarMensagem(mensagem), null);
    }

    @Transactional
    public void resetarParaRetentativa(Long peticaoId) {
        ProjudiPeticaoEntity peticao = peticaoRepository
                .findByIdWithArquivos(peticaoId)
                .orElseThrow(() -> new IllegalArgumentException("Petição não encontrada: " + peticaoId));
        if (!STATUS_ERRO.equals(peticao.getStatus())) {
            throw new IllegalArgumentException(
                    "Só é possível reabrir petição em ERRO (atual: " + peticao.getStatus() + ").");
        }
        boolean todosAssinados = peticao.getArquivos().stream()
                .allMatch(a -> "ASSINADO".equals(a.getStatus()));
        if (!todosAssinados) {
            throw new IllegalArgumentException("Petição com arquivos incompletos — não pode reabrir para protocolo.");
        }
        peticao.setStatus(STATUS_ASSINADA);
        peticao.setProtocoloMensagem(null);
        peticao.setProtocoladoEm(null);
        peticaoRepository.save(peticao);
    }

    static String truncarMensagem(String msg) {
        if (msg == null) {
            return "";
        }
        int max = 4000;
        return msg.length() <= max ? msg : msg.substring(0, max) + "...[truncado]";
    }
}
