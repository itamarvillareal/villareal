package br.com.vilareal.projudi.pipeline;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.projudi.ProjudiOrquestradorPersistenciaService;
import br.com.vilareal.projudi.ProjudiTeorService;
import br.com.vilareal.projudi.ProjudiTextoUtil;
import br.com.vilareal.publicacao.api.dto.PublicacaoWriteRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * Montagem de {@link PublicacaoWriteRequest} e gravação em {@code publicacoes} (modo completo).
 */
@Component
public class ProjudiPublicacaoMovimentacaoRegistrarService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiPublicacaoMovimentacaoRegistrarService.class);

    private final ProjudiOrquestradorPersistenciaService persistenciaService;

    public ProjudiPublicacaoMovimentacaoRegistrarService(ProjudiOrquestradorPersistenciaService persistenciaService) {
        this.persistenciaService = persistenciaService;
    }

    public void registrarMovimentacao(
            ProcessoEntity processo,
            String numeroCnj,
            ProjudiTeorService.MovimentacaoProjudi mov,
            String hashConteudo,
            List<String> detalhes) {
        String tipo = ProjudiTextoUtil.limparTexto(mov.tipo());
        String descricao = ProjudiTextoUtil.limparTexto(mov.descricao());
        String teor = StringUtils.hasText(descricao) ? tipo + " - " + descricao : tipo;
        LocalDate dataPublicacao = parseDataPublicacao(mov.dataHora());

        PublicacaoWriteRequest req = new PublicacaoWriteRequest();
        req.setNumeroProcessoEncontrado(numeroCnj);
        req.setDataPublicacao(dataPublicacao);
        req.setDataDisponibilizacao(dataPublicacao);
        req.setFonte("PROJUDI");
        req.setTitulo(capLen(tipo, 255));
        req.setTipoPublicacao(capLen(tipo, 80));
        req.setResumo(capLen(teor, 500));
        req.setTeor(teor);
        req.setHashTeor(ProjudiMovimentacaoHashUtil.sha256Hex(teor));
        req.setHashConteudo(hashConteudo);
        req.setOrigemImportacao("PROJUDI");
        req.setArquivoOrigemNome("PROJUDI mov " + mov.numero() + " [" + mov.idMovi() + "]");
        req.setStatusTratamento("PENDENTE");
        req.setLida(false);
        req.setObservacao("Importado automaticamente via PROJUDI.");

        log.info("PROJUDI salvando publicacao hash={}", hashConteudo);

        Long publicacaoId = persistenciaService.salvarPublicacaoMovimentacao(req, processo);
        if (publicacaoId != null) {
            detalhes.add(numeroCnj + " | mov " + mov.numero()
                    + " | publicação PROJUDI gravada (id=" + publicacaoId + ", hash=" + hashConteudo + ").");
        } else {
            detalhes.add(numeroCnj + " | mov " + mov.numero()
                    + " | AVISO publicação não gravada (hash duplicado em criarPublicacaoProjudi: "
                    + hashConteudo + ").");
        }
    }

    private static LocalDate parseDataPublicacao(String dataHora) {
        if (!StringUtils.hasText(dataHora)) {
            return LocalDate.now();
        }
        try {
            return LocalDateTime.parse(dataHora.trim(), DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"))
                    .toLocalDate();
        } catch (DateTimeParseException e) {
            log.warn("PROJUDI dataHora inválida ({}): {}", dataHora, e.getMessage());
            return LocalDate.now();
        }
    }

    private static String capLen(String s, int max) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.length() <= max ? t : t.substring(0, max);
    }
}
