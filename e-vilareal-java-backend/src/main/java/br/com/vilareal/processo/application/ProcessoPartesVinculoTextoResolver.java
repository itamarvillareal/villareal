package br.com.vilareal.processo.application;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.processo.api.dto.ProcessoPartesVinculoTexto;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Resolve textos «parte cliente» × «parte oposta» a partir de {@code processo.papel_cliente}
 * e {@code processo_parte} — mesma regra da tela Processos e listagens (Publicações, etc.).
 */
public final class ProcessoPartesVinculoTextoResolver {

    private ProcessoPartesVinculoTextoResolver() {}

    public static ProcessoPartesVinculoTexto resolverTextos(
            ProcessoEntity processo, List<ProcessoParteEntity> partes) {
        List<String> porQualificacaoCliente = new ArrayList<>();
        List<String> porQualificacaoOposta = new ArrayList<>();
        if (partes != null) {
            for (ProcessoParteEntity p : partes) {
                String q = normalizarQualificacaoParte(p.getQualificacao());
                String rotulo = rotuloParteListagem(p);
                if (!StringUtils.hasText(rotulo)) {
                    continue;
                }
                if (q.contains("PARTE CLIENTE")) {
                    porQualificacaoCliente.add(rotulo);
                } else if (q.contains("PARTE OPOSTA")) {
                    porQualificacaoOposta.add(rotulo);
                }
            }
        }
        if (!porQualificacaoCliente.isEmpty()) {
            String pc = formatarListaComConjuncaoE(porQualificacaoCliente);
            String po = !porQualificacaoOposta.isEmpty()
                    ? formatarListaComConjuncaoE(porQualificacaoOposta)
                    : montarTextoParteOpostaListagemPorPapelJuridico(processo, partes);
            return new ProcessoPartesVinculoTexto(pc, po);
        }
        if (importPoloJuridicoInvertidoParteCliente(processo, partes)) {
            return montarTextosPorMarcadorParteCliente(partes);
        }
        return new ProcessoPartesVinculoTexto(
                montarTextoParteClienteListagemPorPapelJuridico(processo, partes),
                montarTextoParteOpostaListagemPorPapelJuridico(processo, partes));
    }

    public static String parteCliente(ProcessoEntity processo, List<ProcessoParteEntity> partes) {
        return resolverTextos(processo, partes).getParteCliente();
    }

    public static String parteOposta(ProcessoEntity processo, List<ProcessoParteEntity> partes) {
        return resolverTextos(processo, partes).getParteOposta();
    }

    /** Primeira pessoa cadastrada no lado «parte cliente» do processo (contratante de honorários). */
    public static Long primeiraPessoaIdParteCliente(ProcessoEntity processo, List<ProcessoParteEntity> partes) {
        if (partes == null || partes.isEmpty()) {
            return null;
        }
        for (ProcessoParteEntity p : partes) {
            String q = normalizarQualificacaoParte(p.getQualificacao());
            if (q.contains("PARTE CLIENTE") && p.getPessoa() != null) {
                return p.getPessoa().getId();
            }
        }
        if (importPoloJuridicoInvertidoParteCliente(processo, partes)) {
            for (ProcessoParteEntity p : partes) {
                if (temMarcadorParteClienteImport(p) && p.getPessoa() != null) {
                    return p.getPessoa().getId();
                }
            }
        }
        boolean ladoAutor = poloJuridicoEscritorioEhAutor(processo, partes);
        for (ProcessoParteEntity p : partes) {
            String poloNorm = normalizarPoloParaComparacao(p.getPolo());
            if (poloEhLadoEscritorio(poloNorm, ladoAutor) && p.getPessoa() != null) {
                return p.getPessoa().getId();
            }
        }
        return null;
    }

    /**
     * Nome da subpasta Drive após {@code Proc. NN}: primeiro nome da parte oposta;
     * se houver mais de um, sufixo {@code e outros} (evita nomes longos demais).
     */
    public static String parteOpostaParaNomePasta(ProcessoEntity processo, List<ProcessoParteEntity> partes) {
        List<String> nomes = listarNomesParteOposta(processo, partes);
        if (nomes.isEmpty()) {
            return "";
        }
        if (nomes.size() == 1) {
            return nomes.get(0);
        }
        return nomes.get(0) + " e outros";
    }

    static List<String> listarNomesParteOposta(ProcessoEntity processo, List<ProcessoParteEntity> partes) {
        List<String> porQualificacaoCliente = new ArrayList<>();
        List<String> porQualificacaoOposta = new ArrayList<>();
        if (partes != null) {
            for (ProcessoParteEntity p : partes) {
                String q = normalizarQualificacaoParte(p.getQualificacao());
                String rotulo = rotuloParteListagem(p);
                if (!StringUtils.hasText(rotulo)) {
                    continue;
                }
                if (q.contains("PARTE CLIENTE")) {
                    porQualificacaoCliente.add(rotulo);
                } else if (q.contains("PARTE OPOSTA")) {
                    porQualificacaoOposta.add(rotulo);
                }
            }
        }
        if (!porQualificacaoCliente.isEmpty()) {
            if (!porQualificacaoOposta.isEmpty()) {
                return porQualificacaoOposta;
            }
            return coletarNomesPartesListagem(processo, partes, !poloJuridicoEscritorioEhAutor(processo, partes));
        }
        if (importPoloJuridicoInvertidoParteCliente(processo, partes)) {
            List<String> nomesOposta = new ArrayList<>();
            for (ProcessoParteEntity p : partes) {
                String rotulo = rotuloParteListagem(p);
                if (!StringUtils.hasText(rotulo)) {
                    continue;
                }
                if (!temMarcadorParteClienteImport(p)) {
                    nomesOposta.add(rotulo);
                }
            }
            return nomesOposta;
        }
        return coletarNomesPartesListagem(processo, partes, !poloJuridicoEscritorioEhAutor(processo, partes));
    }

    private static String montarTextoParteClienteListagemPorPapelJuridico(
            ProcessoEntity processo, List<ProcessoParteEntity> partes) {
        return montarTextoPartesListagem(processo, partes, poloJuridicoEscritorioEhAutor(processo, partes));
    }

    private static String montarTextoParteOpostaListagemPorPapelJuridico(
            ProcessoEntity processo, List<ProcessoParteEntity> partes) {
        return montarTextoPartesListagem(processo, partes, !poloJuridicoEscritorioEhAutor(processo, partes));
    }

    /**
     * {@code true} = escritório no polo jurídico autor/requerente; {@code false} = réu/requerido.
     * REQUERIDO → parte cliente no polo REU; REQUERENTE → parte cliente no polo AUTOR.
     */
    static boolean poloJuridicoEscritorioEhAutor(ProcessoEntity processo, List<ProcessoParteEntity> partes) {
        return "REQUERENTE".equals(resolverPapelClienteEfetivo(processo, partes));
    }

    /**
     * REQUERENTE → parte cliente no polo jurídico AUTOR; REQUERIDO → parte cliente no polo REU.
     * Usa {@code processo.papel_cliente} do cadastro; se ausente, infere pela qualificação das partes.
     */
    public static String resolverPapelClienteEfetivo(ProcessoEntity processo, List<ProcessoParteEntity> partes) {
        String papel = normalizarPapelCliente(processo != null ? processo.getPapelCliente() : null);
        if (papel != null) {
            return papel;
        }
        if (partes != null) {
            for (ProcessoParteEntity p : partes) {
                String q = normalizarQualificacaoParte(p.getQualificacao());
                if (!q.contains("PARTE CLIENTE")) {
                    continue;
                }
                String polo = normalizarPoloParaComparacao(p.getPolo());
                if (polo.contains("REU") || polo.contains("REQUERIDO")) {
                    return "REQUERIDO";
                }
                if (polo.contains("AUTOR") || polo.contains("REQUERENTE") || polo.contains("CLIENTE")) {
                    return "REQUERENTE";
                }
            }
        }
        return "REQUERENTE";
    }

    private static boolean importPoloJuridicoInvertidoParteCliente(
            ProcessoEntity processo, List<ProcessoParteEntity> partes) {
        if (!"REQUERIDO".equals(resolverPapelClienteEfetivo(processo, partes))) {
            return false;
        }
        if (partes == null || partes.isEmpty()) {
            return false;
        }
        boolean marcadorNoAutor = false;
        boolean marcadorNoReu = false;
        for (ProcessoParteEntity p : partes) {
            if (!temMarcadorParteClienteImport(p)) {
                continue;
            }
            String polo = normalizarPoloParaComparacao(p.getPolo());
            if (polo.contains("REU") || polo.contains("REQUERIDO")) {
                marcadorNoReu = true;
            }
            if (polo.contains("AUTOR") || polo.contains("REQUERENTE") || polo.contains("CLIENTE")) {
                marcadorNoAutor = true;
            }
        }
        return marcadorNoAutor && !marcadorNoReu;
    }

    private static ProcessoPartesVinculoTexto montarTextosPorMarcadorParteCliente(List<ProcessoParteEntity> partes) {
        List<String> nomesCliente = new ArrayList<>();
        List<String> nomesOposta = new ArrayList<>();
        for (ProcessoParteEntity p : partes) {
            String rotulo = rotuloParteListagem(p);
            if (!StringUtils.hasText(rotulo)) {
                continue;
            }
            if (temMarcadorParteClienteImport(p)) {
                nomesCliente.add(rotulo);
            } else {
                nomesOposta.add(rotulo);
            }
        }
        return new ProcessoPartesVinculoTexto(
                formatarListaComConjuncaoE(nomesCliente), formatarListaComConjuncaoE(nomesOposta));
    }

    private static String montarTextoPartesListagem(
            ProcessoEntity processo, List<ProcessoParteEntity> partes, boolean ladoCliente) {
        return formatarListaComConjuncaoE(coletarNomesPartesListagem(processo, partes, ladoCliente));
    }

    private static List<String> coletarNomesPartesListagem(
            ProcessoEntity processo, List<ProcessoParteEntity> partes, boolean ladoCliente) {
        if (partes == null || partes.isEmpty()) {
            return List.of();
        }
        List<String> nomes = new ArrayList<>();
        for (ProcessoParteEntity p : partes) {
            String poloNorm = normalizarPoloParaComparacao(p.getPolo());
            if (!poloEhLadoEscritorio(poloNorm, ladoCliente)) {
                continue;
            }
            String rotulo = rotuloParteListagem(p);
            if (StringUtils.hasText(rotulo)) {
                nomes.add(rotulo);
            }
        }
        return nomes;
    }

    /** {@code ladoClienteAutor}: polo jurídico autor/requerente é o lado do escritório. */
    private static boolean poloEhLadoEscritorio(String poloNorm, boolean ladoClienteAutor) {
        if (!StringUtils.hasText(poloNorm)) {
            return false;
        }
        boolean poloAutor = poloNorm.contains("AUTOR")
                || poloNorm.contains("REQUERENTE")
                || poloNorm.contains("CLIENTE");
        boolean poloReu = poloNorm.contains("REU") || poloNorm.contains("REQUERIDO");
        if (ladoClienteAutor) {
            return poloAutor && !poloReu;
        }
        return poloReu;
    }

    private static boolean temMarcadorParteClienteImport(ProcessoParteEntity p) {
        String q = normalizarQualificacaoParte(p.getQualificacao());
        return q.contains("ENDERECO") || q.contains("PARTE CLIENTE");
    }

    static String normalizarPapelCliente(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String n = Normalizer.normalize(raw.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toUpperCase(Locale.ROOT);
        if (n.contains("REQUERIDO") || n.equals("REU")) {
            return "REQUERIDO";
        }
        if (n.contains("REQUERENTE") || n.equals("AUTOR")) {
            return "REQUERENTE";
        }
        return null;
    }

    private static String normalizarQualificacaoParte(String raw) {
        if (!StringUtils.hasText(raw)) {
            return "";
        }
        String nfd = Normalizer.normalize(raw.trim(), Normalizer.Form.NFD);
        return nfd.replaceAll("\\p{M}+", "").toUpperCase(Locale.ROOT);
    }

    static String normalizarPoloParaComparacao(String polo) {
        if (!StringUtils.hasText(polo)) {
            return "";
        }
        String nfd = Normalizer.normalize(polo.trim(), Normalizer.Form.NFD);
        String semAcentos = nfd.replaceAll("\\p{M}+", "");
        return semAcentos.toUpperCase(Locale.ROOT);
    }

    static String rotuloParteListagem(ProcessoParteEntity p) {
        if (p == null) {
            return "";
        }
        if (p.getPessoa() != null) {
            PessoaEntity pes = p.getPessoa();
            String nomeApi = "";
            if (StringUtils.hasText(pes.getNome())) {
                nomeApi = Utf8MojibakeUtil.corrigir(pes.getNome().trim());
            }
            if (!StringUtils.hasText(nomeApi) && StringUtils.hasText(p.getNomeLivre())) {
                nomeApi = Utf8MojibakeUtil.corrigir(p.getNomeLivre().trim());
            }
            if (StringUtils.hasText(nomeApi)) {
                return nomeApi;
            }
            return "Pessoa nº " + pes.getId();
        }
        if (StringUtils.hasText(p.getNomeLivre())) {
            return Utf8MojibakeUtil.corrigir(p.getNomeLivre().trim());
        }
        return "";
    }

    static String formatarListaComConjuncaoE(List<String> itens) {
        List<String> lista = (itens == null ? List.<String>of() : itens).stream()
                .map(s -> s == null ? "" : s.trim())
                .filter(StringUtils::hasText)
                .toList();
        if (lista.isEmpty()) {
            return "";
        }
        if (lista.size() == 1) {
            return lista.get(0);
        }
        if (lista.size() == 2) {
            return lista.get(0) + " e " + lista.get(1);
        }
        return String.join(", ", lista.subList(0, lista.size() - 1)) + " e " + lista.get(lista.size() - 1);
    }
}
