package br.com.vilareal.whatsapp.service;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.pessoa.application.TelefoneBuscaSupport;
import br.com.vilareal.pessoa.infrastructure.persistence.projection.PessoaTelefoneIndiceBatchRow;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.whatsapp.config.WhatsAppNomeExibicaoCacheConfig;
import com.github.benmanes.caffeine.cache.Cache;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Resolve {@code pessoa.nome} por telefone para exibição na inbox WhatsApp (comportamento "agenda").
 *
 * <p>Reutiliza {@link TelefoneBuscaSupport} — mesma tolerância do modal «Vínculos pelo telefone».</p>
 *
 * <p><strong>Precedência do nome exibido:</strong> cadastro ({@code pessoa.nome}) &gt; profile.name Meta
 * (salvo na mensagem) &gt; {@code null} (front formata o número).</p>
 *
 * <p>Cliente vinculado <strong>não</strong> é pré-requisito: basta casar telefone com {@code pessoa}
 * (campo principal ou contato tipo telefone).</p>
 *
 * <p>Desempate quando várias pessoas casam: menor {@code pessoa.id} (estável e previsível).</p>
 */
@Service
public class WhatsAppNomeExibicaoService {

    private final PessoaRepository pessoaRepository;
    private final Cache<String, Optional<String>> cache;

    public WhatsAppNomeExibicaoService(
            PessoaRepository pessoaRepository, Cache<String, Optional<String>> whatsAppNomeCadastroPorTelefoneCache) {
        this.pessoaRepository = pessoaRepository;
        this.cache = whatsAppNomeCadastroPorTelefoneCache;
    }

    /**
     * Nomes do cadastro por telefone canônico ({@link WhatsAppService#formatPhoneNumber}). Telefones sem
     * match não entram no mapa.
     */
    @Transactional(readOnly = true)
    public Map<String, String> resolverNomesPorTelefone(List<String> telefones) {
        Map<String, String> out = new LinkedHashMap<>();
        if (telefones == null || telefones.isEmpty()) {
            return out;
        }

        Map<String, TelefoneIndice> indicesPorCanonico = new LinkedHashMap<>();
        List<String> pendentes = new ArrayList<>();

        for (String raw : telefones) {
            String canonico = canonicalizarSeguro(raw);
            if (canonico == null || indicesPorCanonico.containsKey(canonico)) {
                continue;
            }
            Optional<String> cached = cache.getIfPresent(canonico);
            if (cached != null) {
                cached.filter(StringUtils::hasText).ifPresent(nome -> out.put(canonico, nome));
                indicesPorCanonico.put(canonico, null);
                continue;
            }
            String digits = TelefoneBuscaSupport.normalizar(canonico);
            if (digits == null) {
                cache.put(canonico, Optional.empty());
                indicesPorCanonico.put(canonico, null);
                continue;
            }
            indicesPorCanonico.put(canonico, new TelefoneIndice(canonico, digits));
            pendentes.add(canonico);
        }

        if (pendentes.isEmpty()) {
            return out;
        }

        Set<String> allVariants = new LinkedHashSet<>();
        Set<String> allSufixos = new LinkedHashSet<>();
        for (String canonico : pendentes) {
            TelefoneIndice idx = indicesPorCanonico.get(canonico);
            if (idx == null) {
                continue;
            }
            allVariants.addAll(idx.variantes());
            if (StringUtils.hasText(idx.sufixoLocal())) {
                allSufixos.add(idx.sufixoLocal());
            }
        }

        List<PessoaTelefoneIndiceBatchRow> candidatos = buscarCandidatosBatch(allVariants, allSufixos);

        for (String canonico : pendentes) {
            TelefoneIndice idx = indicesPorCanonico.get(canonico);
            if (idx == null) {
                continue;
            }
            Optional<String> nome = resolverNomeParaIndice(idx, candidatos);
            if (nome.isEmpty()) {
                nome = resolverNomePessoaPorIndice(idx);
            }
            cache.put(canonico, nome);
            nome.filter(StringUtils::hasText).ifPresent(n -> out.put(canonico, n));
        }

        return out;
    }

    /**
     * Nome para exibição com precedência cadastro &gt; Meta &gt; null.
     *
     * @param loteCadastro mapa opcional de {@link #resolverNomesPorTelefone} (evita reconsulta na mesma request)
     */
    public String resolverNomeExibido(String telefone, String metaProfileName, Map<String, String> loteCadastro) {
        String canonico = canonicalizarSeguro(telefone);
        if (canonico == null) {
            return nomeMetaUtil(metaProfileName) ? metaProfileName.trim() : null;
        }

        String cadastro = loteCadastro != null ? loteCadastro.get(canonico) : null;
        if (!StringUtils.hasText(cadastro)) {
            cadastro = resolverNomesPorTelefone(List.of(canonico)).get(canonico);
        }
        if (StringUtils.hasText(cadastro)) {
            return cadastro;
        }
        if (nomeMetaUtil(metaProfileName)) {
            return metaProfileName.trim();
        }
        return null;
    }

    /** Atalho para uma conversa / feed de mensagens. */
    public String resolverNomeExibido(String telefone, String metaProfileName) {
        return resolverNomeExibido(telefone, metaProfileName, null);
    }

    private List<PessoaTelefoneIndiceBatchRow> buscarCandidatosBatch(Set<String> variants, Set<String> sufixos) {
        if (variants.isEmpty() && sufixos.isEmpty()) {
            return List.of();
        }
        List<String> digitosList = variants.isEmpty() ? List.of("__none__") : new ArrayList<>(variants);
        List<String> sufixosList = sufixos.isEmpty() ? List.of("__none__") : new ArrayList<>(sufixos);
        return pessoaRepository.findTelefoneIndiceBatch(digitosList, sufixosList);
    }

    private static Optional<String> resolverNomeParaIndice(
            TelefoneIndice indice, List<PessoaTelefoneIndiceBatchRow> candidatos) {
        return candidatos.stream()
                .filter(row -> casaIndiceComLinha(indice, row))
                .min(Comparator.comparing(PessoaTelefoneIndiceBatchRow::getPessoaId))
                .map(PessoaTelefoneIndiceBatchRow::getNome)
                .map(WhatsAppNomeExibicaoService::normalizarNomePessoa)
                .filter(StringUtils::hasText);
    }

    /**
     * Fallback quando o batch não trouxe linha casável: resolve ids por índice e retorna
     * {@code pessoa.nome} do menor id — sem exigir cliente.
     */
    private Optional<String> resolverNomePessoaPorIndice(TelefoneIndice indice) {
        List<String> variantes = indice.variantes();
        String sufixo = indice.sufixoLocal();
        List<Long> ids = pessoaRepository.findIdsByTelefoneIndice(
                variantes, StringUtils.hasText(sufixo) ? sufixo : "", "");
        return ids.stream()
                .min(Long::compareTo)
                .flatMap(pessoaRepository::findById)
                .map(p -> p.getNome())
                .map(WhatsAppNomeExibicaoService::normalizarNomePessoa)
                .filter(StringUtils::hasText);
    }

    private static boolean casaIndiceComLinha(TelefoneIndice indice, PessoaTelefoneIndiceBatchRow row) {
        Set<String> variantesSet = new LinkedHashSet<>(indice.variantes());
        if (variantesSet.contains(safeDigits(row.getTelefoneDigitos()))
                || variantesSet.contains(safeDigits(row.getContatoDigitos()))) {
            return true;
        }
        String sufixo = indice.sufixoLocal();
        if (!StringUtils.hasText(sufixo)) {
            return false;
        }
        return sufixo.equals(safeDigits(row.getTelefoneSufixo8()))
                || sufixo.equals(safeDigits(row.getContatoSufixo8()));
    }

    private static String safeDigits(String raw) {
        if (!StringUtils.hasText(raw)) {
            return "";
        }
        return raw.replaceAll("\\D", "");
    }

    private static String normalizarNomePessoa(String nome) {
        if (!StringUtils.hasText(nome)) {
            return null;
        }
        return Utf8MojibakeUtil.corrigir(nome.trim());
    }

    private static String canonicalizarSeguro(String telefone) {
        if (!StringUtils.hasText(telefone)) {
            return null;
        }
        try {
            return WhatsAppService.formatPhoneNumber(telefone.trim());
        } catch (IllegalArgumentException e) {
            String digits = TelefoneBuscaSupport.normalizar(telefone);
            return StringUtils.hasText(digits) ? digits : null;
        }
    }

    /** Profile.name da Meta quando útil (ignora placeholders como "."). */
    static boolean nomeMetaUtil(String metaProfileName) {
        if (!StringUtils.hasText(metaProfileName)) {
            return false;
        }
        String t = metaProfileName.trim();
        return !t.equals(".") && !t.equals("-") && !t.equals("—");
    }

    /** TTL configurado (documentação / testes). */
    public static java.time.Duration cacheTtl() {
        return WhatsAppNomeExibicaoCacheConfig.CACHE_TTL;
    }

    private record TelefoneIndice(String canonico, String digits) {

        List<String> variantes() {
            return TelefoneBuscaSupport.variantes(digits);
        }

        String sufixoLocal() {
            return TelefoneBuscaSupport.sufixoLocal(digits);
        }
    }
}
