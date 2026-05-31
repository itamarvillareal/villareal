package br.com.vilareal.publicacao.application;

import br.com.vilareal.processo.application.ProcessoDiagnosticoNumeroBuscaUtil;
import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Marca publicações importadas por e-mail quando o robô PROJUDI conclui o modo somente Drive.
 */
@Service
public class PublicacaoDriveAndamentosService {

    private static final Logger log = LoggerFactory.getLogger(PublicacaoDriveAndamentosService.class);

    private static final String DRIVE_FOLDER_URL_PREFIX = "https://drive.google.com/drive/folders/";

    private final PublicacaoRepository publicacaoRepository;

    public PublicacaoDriveAndamentosService(PublicacaoRepository publicacaoRepository) {
        this.publicacaoRepository = publicacaoRepository;
    }

    /** Não-fatal: falha só gera WARN e não propaga. */
    public void tentarMarcarAndamentosNoDrivePorCnj(String cnj, String pastaMovimentacoesFolderId, int qtdArquivos) {
        try {
            marcarAndamentosNoDrivePorCnj(cnj, pastaMovimentacoesFolderId, qtdArquivos);
        } catch (Exception e) {
            log.warn(
                    "Falha ao marcar andamentos no Drive na publicação de e-mail (cnj={}): {}",
                    cnj,
                    e.getMessage());
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int marcarAndamentosNoDrivePorCnj(String cnj, String pastaMovimentacoesFolderId, int qtdArquivos) {
        if (!StringUtils.hasText(cnj) || !StringUtils.hasText(pastaMovimentacoesFolderId)) {
            return 0;
        }
        String norm = ProcessoDiagnosticoNumeroBuscaUtil.normalizarSomenteDigitos(cnj);
        if (norm.length() < 20) {
            return 0;
        }
        List<PublicacaoEntity> publicacoes = publicacaoRepository.findImportadasPorEmailPorCnjNormalizado(norm);
        if (publicacoes.isEmpty()) {
            return 0;
        }
        String driveFolderUrl = DRIVE_FOLDER_URL_PREFIX + pastaMovimentacoesFolderId.trim();
        LocalDateTime agora = LocalDateTime.now();
        for (PublicacaoEntity pub : publicacoes) {
            pub.setAndamentosNoDrive(true);
            pub.setDriveFolderUrl(driveFolderUrl);
            pub.setAndamentosNoDriveEm(agora);
            pub.setQtdArquivosDrive(qtdArquivos);
        }
        publicacaoRepository.saveAll(publicacoes);
        log.info(
                "Publicações de e-mail marcadas com andamentos no Drive: cnj={}, linhas={}",
                cnj,
                publicacoes.size());
        return publicacoes.size();
    }
}
