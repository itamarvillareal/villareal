package br.com.vilareal.documento;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Resolve partes do processo por polo (autor = locador; réu = locatário no contrato de aluguel). */
@Service
public class ContratoPartesProcessoResolver {

    private final ProcessoRepository processoRepository;
    private final ProcessoParteRepository processoParteRepository;
    private final QualificacaoPessoaUtil qualificacaoPessoaUtil;

    public ContratoPartesProcessoResolver(
            ProcessoRepository processoRepository,
            ProcessoParteRepository processoParteRepository,
            QualificacaoPessoaUtil qualificacaoPessoaUtil) {
        this.processoRepository = processoRepository;
        this.processoParteRepository = processoParteRepository;
        this.qualificacaoPessoaUtil = qualificacaoPessoaUtil;
    }

    @Transactional(readOnly = true)
    public PartesContratoAluguel resolverPartesAluguel(Long processoId) {
        if (processoId == null) {
            throw new IllegalArgumentException("processoId é obrigatório para o contrato de aluguel");
        }
        ProcessoEntity processo = processoRepository
                .findById(processoId)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));

        List<ProcessoParteEntity> partes =
                processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(processo.getId());
        List<ProcessoParteEntity> autores = new ArrayList<>();
        List<ProcessoParteEntity> reus = new ArrayList<>();
        for (ProcessoParteEntity parte : partes) {
            if (poloEhAutor(parte.getPolo())) {
                autores.add(parte);
            } else if (poloEhReu(parte.getPolo())) {
                reus.add(parte);
            }
        }
        if (autores.isEmpty()) {
            throw new IllegalArgumentException(
                    "Nenhuma parte autora encontrada no processo " + processoId + " para o locador.");
        }
        if (reus.isEmpty()) {
            throw new IllegalArgumentException(
                    "Nenhuma parte oposta (réu) encontrada no processo " + processoId + " para o locatário.");
        }

        List<String> qualificacoesLocador = qualificarPartes(autores);
        List<String> qualificacoesLocatario = qualificarPartes(reus);
        List<String> nomesLocador = nomesPartes(autores);
        List<String> nomesLocatario = nomesPartes(reus);

        return new PartesContratoAluguel(
                processoId,
                qualificacoesLocador,
                qualificacoesLocatario,
                nomesLocador,
                nomesLocatario);
    }

    private List<String> qualificarPartes(List<ProcessoParteEntity> partes) {
        List<String> out = new ArrayList<>(partes.size());
        for (ProcessoParteEntity parte : partes) {
            if (parte.getPessoa() != null && parte.getPessoa().getId() != null) {
                out.add(qualificacaoPessoaUtil.gerarQualificacaoContratoContratantePorProcessoParte(parte));
            } else {
                out.add(escapeHtml(nomeParte(parte)));
            }
        }
        return out;
    }

    private static List<String> nomesPartes(List<ProcessoParteEntity> partes) {
        List<String> nomes = new ArrayList<>(partes.size());
        for (ProcessoParteEntity parte : partes) {
            String nome = nomeParte(parte);
            if (!nome.isBlank()) {
                nomes.add(ContratoHonorariosClausulas.normalizarNomeAssinatura(nome));
            }
        }
        return nomes;
    }

    private static String nomeParte(ProcessoParteEntity parte) {
        if (parte.getPessoa() != null && parte.getPessoa().getNome() != null) {
            return parte.getPessoa().getNome().trim();
        }
        return parte.getNomeLivre() != null ? parte.getNomeLivre().trim() : "";
    }

    static boolean poloEhAutor(String polo) {
        String p = normalizarPolo(polo);
        return p.contains("AUTOR") || p.contains("REQUERENTE");
    }

    static boolean poloEhReu(String polo) {
        String p = normalizarPolo(polo);
        return p.contains("REU") || p.contains("REQUERIDO");
    }

    private static String normalizarPolo(String polo) {
        return Normalizer.normalize(String.valueOf(polo != null ? polo : ""), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toUpperCase(Locale.ROOT);
    }

    private static String escapeHtml(String texto) {
        if (texto == null) {
            return "";
        }
        return texto
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    public record PartesContratoAluguel(
            Long processoId,
            List<String> qualificacoesLocador,
            List<String> qualificacoesLocatario,
            List<String> nomesLocador,
            List<String> nomesLocatario) {}
}
