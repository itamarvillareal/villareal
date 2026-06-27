package br.com.vilareal.projudi.application;

import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiPeticaoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
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

    /**
     * Grava a etapa atual do robô (ex.: "Buscando o processo…", "Enviando arquivo 1 de 2…") em uma
     * transação própria que commita de imediato, para que o polling da UI veja o progresso ao vivo.
     * Só afeta petições em PROTOCOLANDO (evita sobrescrever estado final por chamada tardia).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registrarEtapa(List<Long> peticaoIds, String etapa) {
        if (peticaoIds == null || peticaoIds.isEmpty()) {
            return;
        }
        String texto = etapa == null ? null : etapa.length() <= 160 ? etapa : etapa.substring(0, 160);
        peticaoRepository.atualizarEtapa(peticaoIds, texto);
    }

    /** Limpa mensagem/etapa de tentativa anterior, para um novo protocolo começar com estado limpo. */
    @Transactional
    public void limparEstadoFila(List<Long> peticaoIds) {
        if (peticaoIds == null || peticaoIds.isEmpty()) {
            return;
        }
        peticaoRepository.limparEstadoFila(peticaoIds);
    }

    /** Grava mensagem na fila (ASSINADA) sem mudar status — ex.: robô ocupado/timeout do lock. */
    @Transactional
    public void registrarMensagemFila(List<Long> peticaoIds, String mensagem) {
        if (peticaoIds == null || peticaoIds.isEmpty()) {
            return;
        }
        peticaoRepository.registrarMensagemFila(peticaoIds, truncarMensagem(mensagem));
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
        // Falha no protocolo: remove agendamento vencido para a UI mostrar o erro em «Prontas»,
        // em vez de repetir tentativa a cada minuto sem feedback visível.
        peticaoRepository.limparAgendamento(List.of(peticaoId));
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
