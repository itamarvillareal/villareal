package br.com.vilareal.pessoa.application;

import br.com.vilareal.pessoa.importacao.CadastroPessoasPlanilhaImportSupport;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaComplementarEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaContatoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEnderecoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaComplementarRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaEnderecoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Acrescenta contatos e endereços sem duplicar (chave tipo+valor ou linha completa do endereço) e preenche RG
 * complementar apenas se ainda estiver vazio.
 */
@Service
public class PessoaMergeService {

    public static final String TIPO_CONTATO_EMAIL = "email";
    public static final String TIPO_CONTATO_TELEFONE = "telefone";

    private static final String USUARIO_IMPORT = "importacao-unidades-xls";

    private final PessoaContatoRepository contatoRepository;
    private final PessoaEnderecoRepository enderecoRepository;
    private final PessoaComplementarRepository complementarRepository;

    public PessoaMergeService(
            PessoaContatoRepository contatoRepository,
            PessoaEnderecoRepository enderecoRepository,
            PessoaComplementarRepository complementarRepository) {
        this.contatoRepository = contatoRepository;
        this.enderecoRepository = enderecoRepository;
        this.complementarRepository = complementarRepository;
    }

    @Transactional
    public int mergeContatos(PessoaEntity pessoa, List<ContatoPar> contatos) {
        return mergeContatos(pessoa, contatos, null);
    }

    @Transactional
    public int mergeContatos(PessoaEntity pessoa, List<ContatoPar> contatos, String importacaoId) {
        if (contatos == null || contatos.isEmpty()) {
            return 0;
        }
        List<PessoaContatoEntity> existentes = contatoRepository.findByPessoa_IdOrderByIdAsc(pessoa.getId());
        Set<String> chaves = new HashSet<>();
        for (PessoaContatoEntity c : existentes) {
            chaves.add(chaveContato(c.getTipo(), c.getValor()));
        }
        Instant now = Instant.now();
        int added = 0;
        for (ContatoPar par : contatos) {
            if (par.tipo() == null || par.valor() == null) {
                continue;
            }
            String tipo = par.tipo().trim();
            String valor = par.valor().trim();
            if (tipo.isEmpty() || valor.isEmpty()) {
                continue;
            }
            String ch = chaveContato(tipo, valor);
            if (chaves.contains(ch)) {
                continue;
            }
            chaves.add(ch);
            PessoaContatoEntity n = new PessoaContatoEntity();
            n.setPessoa(pessoa);
            n.setTipo(tipo);
            n.setValor(valor);
            n.setDataLancamento(now);
            n.setDataAlteracao(now);
            n.setUsuarioLancamento(USUARIO_IMPORT);
            if (StringUtils.hasText(importacaoId)) {
                n.setImportacaoId(importacaoId.trim());
            }
            contatoRepository.save(n);
            added++;
        }
        return added;
    }

    @Transactional
    public int mergeEnderecos(PessoaEntity pessoa, List<EnderecoMergeLinha> linhas) {
        return mergeEnderecos(pessoa, linhas, null);
    }

    @Transactional
    public int mergeEnderecos(PessoaEntity pessoa, List<EnderecoMergeLinha> linhas, String importacaoId) {
        if (linhas == null || linhas.isEmpty()) {
            return 0;
        }
        List<PessoaEnderecoEntity> existentes = enderecoRepository.findByPessoa_IdOrderByNumeroOrdemAsc(pessoa.getId());
        Set<String> chaves = new HashSet<>();
        for (PessoaEnderecoEntity e : existentes) {
            chaves.add(chaveEndereco(e));
        }
        int ordemBase = existentes.stream().mapToInt(PessoaEnderecoEntity::getNumeroOrdem).max().orElse(0);
        int added = 0;
        for (EnderecoMergeLinha linha : linhas) {
            if (linha == null || linha.ruaObrigatoria() == null || linha.ruaObrigatoria().isBlank()) {
                continue;
            }
            PessoaEnderecoEntity phantom = new PessoaEnderecoEntity();
            phantom.setRua(CadastroPessoasPlanilhaImportSupport.truncate(linha.ruaObrigatoria(), 255));
            phantom.setBairro(trimToNull(linha.bairro()));
            phantom.setEstado(trimToNull(linha.estado()));
            phantom.setCidade(trimToNull(linha.cidade()));
            phantom.setCep(trimToNull(linha.cep()));
            phantom.setComplemento(trimToNull(linha.complemento()));
            String ch = chaveEndereco(phantom);
            if (chaves.contains(ch)) {
                continue;
            }
            chaves.add(ch);
            PessoaEnderecoEntity n = new PessoaEnderecoEntity();
            n.setPessoa(pessoa);
            n.setNumeroOrdem(++ordemBase);
            n.setRua(phantom.getRua());
            n.setBairro(phantom.getBairro());
            n.setEstado(phantom.getEstado());
            n.setCidade(phantom.getCidade());
            n.setCep(phantom.getCep());
            n.setComplemento(phantom.getComplemento());
            n.setAutoPreenchido(false);
            if (StringUtils.hasText(importacaoId)) {
                n.setImportacaoId(importacaoId.trim());
            }
            enderecoRepository.save(n);
            added++;
        }
        return added;
    }

    @Transactional
    public void mergeRgSeVazio(PessoaEntity pessoa, String rgBruto) {
        if (rgBruto == null || rgBruto.isBlank()) {
            return;
        }
        String rg = CadastroPessoasPlanilhaImportSupport.truncate(rgBruto.trim(), 40);
        PessoaComplementarEntity e = complementarRepository
                .findById(pessoa.getId())
                .orElseGet(() -> {
                    PessoaComplementarEntity x = new PessoaComplementarEntity();
                    x.setPessoa(pessoa);
                    return x;
                });
        if (e.getRg() == null || e.getRg().isBlank()) {
            e.setRg(rg);
            complementarRepository.save(e);
        }
    }

    private static String chaveContato(String tipo, String valor) {
        return tipo.trim() + "\0" + valor.trim();
    }

    private static String chaveEndereco(PessoaEnderecoEntity e) {
        return String.join(
                "\0",
                Objects.toString(e.getRua(), ""),
                Objects.toString(e.getBairro(), ""),
                Objects.toString(e.getEstado(), ""),
                Objects.toString(e.getCidade(), ""),
                Objects.toString(e.getCep(), ""),
                Objects.toString(e.getComplemento(), ""));
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    public record ContatoPar(String tipo, String valor) {}

    public record EnderecoMergeLinha(
            String ruaObrigatoria, String bairro, String estado, String cidade, String cep, String complemento) {}
}
