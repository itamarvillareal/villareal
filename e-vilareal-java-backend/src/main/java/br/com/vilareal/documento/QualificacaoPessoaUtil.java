package br.com.vilareal.documento;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.pessoa.api.dto.PessoaComplementarPayload;
import br.com.vilareal.pessoa.api.dto.QualificacaoJuridicaResponse;
import br.com.vilareal.pessoa.api.dto.PessoaContatoItemResponse;
import br.com.vilareal.pessoa.api.dto.PessoaEnderecoItemResponse;
import br.com.vilareal.pessoa.application.PessoaApplicationService;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class QualificacaoPessoaUtil {

    private static final Pattern APENAS_DIGITOS = Pattern.compile("\\D+");

    private static final Pattern ALGARISMO_ROMANO = Pattern.compile(
            "^(?i)(M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3}))$");

    private static final Set<String> PREPOSICOES = Set.of(
            "da", "de", "do", "das", "dos", "e", "em", "a", "o", "ao", "à",
            "pela", "pelo", "para", "com", "sem", "sobre", "entre", "até");

    private static final Set<String> EXCECOES_MASCULINAS_TERMINADAS_EM_A = Set.of(
            "LUCA", "NICOLA", "JOSUA", "JOSHUA", "BARNABA", "GIANCARLA");

    private static final Set<String> FEMININOS_EXPLICITOS = Set.of(
            "RAQUEL", "MABEL", "SUELI", "JAQUELINE", "MICHELE", "BEATRIZ",
            "EDINEIDE", "MARILEIDE", "ROSINEIDE", "FRANCISCA", "TEREZA", "TERESA");

    private static final Map<String, String> TERMOS_EMPRESARIAIS = Map.of(
            "ltda", "Ltda",
            "s/a", "S/A",
            "s.a", "S.A",
            "s a", "S/A",
            "me", "ME",
            "eireli", "Eireli",
            "epp", "EPP",
            "mei", "MEI");

    private final PessoaRepository pessoaRepository;
    private final PessoaApplicationService pessoaApplicationService;

    public QualificacaoPessoaUtil(
            PessoaRepository pessoaRepository,
            PessoaApplicationService pessoaApplicationService) {
        this.pessoaRepository = pessoaRepository;
        this.pessoaApplicationService = pessoaApplicationService;
    }

    @Transactional(readOnly = true)
    public QualificacaoJuridicaResponse gerarQualificacaoJuridicaResponse(Long pessoaId) {
        return new QualificacaoJuridicaResponse(
                montarQualificacaoParaPessoa(pessoaId, false),
                montarQualificacaoParaPessoa(pessoaId, true));
    }

    @Transactional(readOnly = true)
    public String gerarQualificacaoPorPessoaId(Long pessoaId, boolean nomeEmNegrito) {
        return montarQualificacaoParaPessoa(pessoaId, nomeEmNegrito);
    }

    /**
     * Qualificação do outorgante no formato do sistema legado (Access/VB) para procuração:
     * nome em maiúsculas sem negrito, profissão sem «estado civil desconhecido», endereço com
     * abreviações Qd/Lt, CEP só com dígitos e «não utiliza endereço eletrônico» quando não há e-mail.
     */
    @Transactional(readOnly = true)
    public String gerarQualificacaoProcuracaoPorPessoaId(Long pessoaId) {
        DadosQualificacao dados = carregarDadosQualificacao(pessoaId);
        String base = gerarQualificacaoProcuracao(dados);
        if (!ehPessoaJuridica(dados)) {
            return base;
        }
        return base + montarSufixoRepresentantePj(pessoaId, dados, false);
    }

    private String montarQualificacaoParaPessoa(Long pessoaId, boolean nomeEmNegrito) {
        DadosQualificacao dados = carregarDadosQualificacao(pessoaId);
        String base = montarQualificacao(dados, nomeEmNegrito);
        if (!ehPessoaJuridica(dados)) {
            return base;
        }
        return base + montarSufixoRepresentantePj(pessoaId, dados, nomeEmNegrito);
    }

    /**
     * Sufixo "..., neste ato representad{o|a} por seu/sua {cargo} {QUALIFICAÇÃO DO REPRESENTANTE}".
     *
     * <ul>
     *   <li>{@code representad{o|a}} concorda com o gênero da <strong>PJ</strong>.</li>
     *   <li>{@code seu/sua} e o cargo concordam com o gênero do <strong>representante</strong>.</li>
     *   <li>Cargo fixo "administrador"/"administradora" — não há campo de cargo no cadastro; o vínculo
     *       é o {@code pessoa.responsavel_id} (rotulado na UI como "Administrador / representante").</li>
     *   <li>O representante é qualificado pelo mesmo núcleo ({@link #montarQualificacao}), sem
     *       reexpandir o vínculo dele (evita recursão) e <strong>sem negrito no nome</strong> — só as
     *       partes principais da ação usam {@code &lt;strong&gt;}. O modelo tem um único responsável,
     *       logo no máximo um representante.</li>
     * </ul>
     */
    private String montarSufixoRepresentantePj(Long pjId, DadosQualificacao dadosPj, boolean nomeEmNegrito) {
        PessoaEntity pj = pessoaRepository.findById(pjId).orElse(null);
        if (pj == null || pj.getResponsavel() == null) {
            return "";
        }
        Long repId = pj.getResponsavel().getId();
        if (repId == null || repId.equals(pjId)) {
            return "";
        }

        DadosQualificacao dadosRep = carregarDadosQualificacao(repId);
        String qualificacaoRepresentante = montarQualificacao(dadosRep, false);

        boolean pjFeminino = determinarFeminino(dadosPj.nome(), dadosPj.sexo());
        boolean repFeminino = determinarFeminino(dadosRep.nome(), dadosRep.sexo());
        String representado = pjFeminino ? "representada" : "representado";
        String possessivo = repFeminino ? "sua" : "seu";
        String cargo = repFeminino ? "administradora" : "administrador";

        return ", neste ato " + representado + " por " + possessivo + " " + cargo + " "
                + qualificacaoRepresentante;
    }

    private static boolean ehPessoaJuridica(DadosQualificacao dados) {
        return dados.cnpj() != null && !dados.cnpj().isBlank();
    }

    /**
     * Verdadeiro se a pessoa tem ao menos um endereço com logradouro (rua) preenchido — requisito
     * mínimo para qualificar a parte numa petição (não existe inicial sem endereço).
     */
    @Transactional(readOnly = true)
    public boolean possuiEnderecoCadastrado(Long pessoaId) {
        if (pessoaId == null) {
            return false;
        }
        List<PessoaEnderecoItemResponse> enderecos = pessoaApplicationService.listarEnderecos(pessoaId);
        if (enderecos == null) {
            return false;
        }
        for (PessoaEnderecoItemResponse e : enderecos) {
            if (e != null && e.getRua() != null && !e.getRua().isBlank()) {
                return true;
            }
        }
        return false;
    }

    private DadosQualificacao carregarDadosQualificacao(Long pessoaId) {
        PessoaEntity pessoa = pessoaRepository.findById(pessoaId)
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + pessoaId));

        PessoaComplementarPayload complementar = pessoaApplicationService.obterComplementar(pessoaId);
        List<PessoaEnderecoItemResponse> enderecos = pessoaApplicationService.listarEnderecos(pessoaId);
        PessoaEnderecoItemResponse endereco = enderecos.isEmpty() ? null : enderecos.get(0);
        List<PessoaContatoItemResponse> contatos = pessoaApplicationService.listarContatos(pessoaId);

        String email = textoOuNull(pessoa.getEmail());
        String telefone = textoOuNull(pessoa.getTelefone());
        for (PessoaContatoItemResponse contato : contatos) {
            String tipo = contato.getTipo() != null ? contato.getTipo().toLowerCase(Locale.ROOT) : "";
            String valor = textoOuNull(contato.getValor());
            if (valor == null) {
                continue;
            }
            if (email == null && (tipo.contains("email") || tipo.contains("e-mail") || valor.contains("@"))) {
                email = valor;
            }
            if (telefone == null
                    && (tipo.contains("tel") || tipo.contains("cel") || tipo.contains("fone") || tipo.contains("whats"))) {
                telefone = valor;
            }
        }

        String documento = apenasDigitos(pessoa.getCpf());
        String cpf = null;
        String cnpj = null;
        if (documento != null) {
            if (documento.length() == 14) {
                cnpj = formatarCnpj(documento);
            } else if (documento.length() == 11) {
                cpf = formatarCpf(documento);
            } else if (!documento.isBlank()) {
                cpf = pessoa.getCpf() != null ? pessoa.getCpf().trim() : documento;
            }
        }

        String ufRg = extrairUfRg(complementar != null ? complementar.getOrgaoExpedidor() : null);
        String numeroEndereco = endereco != null && endereco.getNumero() != null
                ? String.valueOf(endereco.getNumero())
                : null;

        return new DadosQualificacao(
                pessoa.getNome(),
                complementar != null ? complementar.getGenero() : null,
                complementar != null ? complementar.getNacionalidade() : null,
                complementar != null ? complementar.getEstadoCivil() : null,
                complementar != null ? complementar.getProfissao() : null,
                complementar != null ? complementar.getRg() : null,
                ufRg,
                cpf,
                cnpj,
                endereco != null ? endereco.getRua() : null,
                numeroEndereco,
                null,
                endereco != null ? endereco.getBairro() : null,
                endereco != null ? endereco.getCidade() : null,
                endereco != null ? endereco.getEstado() : null,
                endereco != null ? endereco.getCep() : null,
                email,
                telefone);
    }

    private static String montarQualificacao(DadosQualificacao dados, boolean nomeEmNegrito) {
        return gerarQualificacao(
                dados.nome(),
                dados.sexo(),
                dados.nacionalidade(),
                dados.estadoCivil(),
                dados.profissao(),
                dados.rg(),
                dados.ufRg(),
                dados.cpf(),
                dados.cnpj(),
                dados.logradouro(),
                dados.numero(),
                dados.complemento(),
                dados.bairro(),
                dados.cidade(),
                dados.uf(),
                dados.cep(),
                dados.email(),
                dados.telefone(),
                nomeEmNegrito);
    }

    private record DadosQualificacao(
            String nome,
            String sexo,
            String nacionalidade,
            String estadoCivil,
            String profissao,
            String rg,
            String ufRg,
            String cpf,
            String cnpj,
            String logradouro,
            String numero,
            String complemento,
            String bairro,
            String cidade,
            String uf,
            String cep,
            String email,
            String telefone) {}

    public static String gerarQualificacao(
            String nome,
            String sexo,
            String nacionalidade,
            String estadoCivil,
            String profissao,
            String rg,
            String ufRg,
            String cpf,
            String cnpj,
            String logradouro,
            String numero,
            String complemento,
            String bairro,
            String cidade,
            String uf,
            String cep,
            String email,
            String telefone,
            boolean nomeEmNegrito) {

        boolean feminino = determinarFeminino(nome, sexo);
        FlexaoGenero g = feminino ? FlexaoGenero.feminino() : FlexaoGenero.masculino();

        StringBuilder sb = new StringBuilder();
        String nomeNormalizado = normalizarNome(nome != null ? nome : "OUTORGANTE");
        if (nomeEmNegrito) {
            sb.append("<strong>").append(escapeHtml(nomeNormalizado.toUpperCase(Locale.ROOT))).append("</strong>");
        } else {
            sb.append(escapeHtml(nomeNormalizado));
        }

        if (cnpj != null && !cnpj.isBlank()) {
            sb.append(", pessoa jurídica de direito privado");
            sb.append(", inscrita no CNPJ sob o nº ").append(escapeHtml(cnpj));
            if (logradouro != null && !logradouro.isBlank()) {
                sb.append(", com sede na ").append(escapeHtml(normalizarEndereco(logradouro)));
                if (numero != null && !numero.isBlank()) {
                    sb.append(", nº ").append(escapeHtml(numero.trim()));
                }
                if (complemento != null && !complemento.isBlank()) {
                    sb.append(", ").append(escapeHtml(normalizarEndereco(complemento)));
                }
                if (bairro != null && !bairro.isBlank()) {
                    sb.append(", ").append(escapeHtml(normalizarBairro(bairro)));
                }
                if ((cidade != null && !cidade.isBlank()) || (uf != null && !uf.isBlank())) {
                    sb.append(", ").append(escapeHtml(formatarCidadeEstadoParaQualificacao(cidade, uf)));
                }
                if (cep != null && !cep.isBlank()) {
                    sb.append(", CEP ").append(escapeHtml(formatarCep(cep)));
                }
            }
            return sb.toString();
        }

        if (nacionalidade != null && !nacionalidade.isBlank() && !contemDesconhecido(nacionalidade)) {
            sb.append(", ").append(escapeHtml(flexionarNacionalidade(nacionalidade, feminino)));
        } else {
            sb.append(", ").append(escapeHtml(g.brasileiro()));
        }

        String ecFlexionado = flexionarEstadoCivil(estadoCivil, feminino);
        String profNormalizada = profissao != null && !profissao.isBlank() && !contemDesconhecido(profissao)
                ? profissao.trim().toLowerCase(Locale.ROOT)
                : null;

        if (ecFlexionado == null && profNormalizada == null) {
            sb.append(", estado civil e profissional desconhecidos");
        } else if (ecFlexionado == null) {
            sb.append(", estado civil desconhecido, ").append(escapeHtml(profNormalizada));
        } else if (profNormalizada == null) {
            sb.append(", ").append(escapeHtml(ecFlexionado)).append(", profissional desconhecido");
        } else {
            sb.append(", ").append(escapeHtml(ecFlexionado)).append(", ").append(escapeHtml(profNormalizada));
        }

        if (rg != null && !rg.isBlank()) {
            sb.append(", ").append(escapeHtml(g.portador())).append(" da carteira de identidade ");
            if (ufRg != null && !ufRg.isBlank()) {
                sb.append(escapeHtml(ufRg.toUpperCase(Locale.ROOT))).append(" ");
            }
            sb.append("nº ").append(escapeHtml(rg.trim()));
        }

        if (cpf != null && !cpf.isBlank()) {
            sb.append(", regularmente ").append(escapeHtml(g.inscrito()));
            sb.append(" no CPF/MF sob o nº ").append(escapeHtml(cpf));
        }

        if (logradouro != null && !logradouro.isBlank()) {
            sb.append(", ").append(escapeHtml(g.residenteDomiciliado())).append(" na ");
            sb.append(escapeHtml(normalizarEndereco(logradouro)));
            if (numero != null && !numero.isBlank()) {
                sb.append(", nº ").append(escapeHtml(numero.trim()));
            }
            if (complemento != null && !complemento.isBlank()) {
                sb.append(", ").append(escapeHtml(normalizarEndereco(complemento)));
            }
            if (bairro != null && !bairro.isBlank()) {
                sb.append(", ").append(escapeHtml(normalizarBairro(bairro)));
            }
            sb.append(", ").append(escapeHtml(formatarCidadeEstadoParaQualificacao(cidade, uf)));
            if (cep != null && !cep.isBlank()) {
                sb.append(", CEP n° ").append(escapeHtml(formatarCep(cep)));
            }
        }

        if (email != null && !email.isBlank()) {
            sb.append(", utiliza endereço eletrônico: ").append(escapeHtml(email.toLowerCase(Locale.ROOT).trim()));
        }
        if (telefone != null && !telefone.isBlank()) {
            sb.append(", e o número de telefone: ").append(escapeHtml(telefone.trim()));
        }

        return sb.toString();
    }

    /**
     * Qualificação do outorgante em procuração — espelha o texto gerado pelo sistema legado (Access/VB).
     */
    static String gerarQualificacaoProcuracao(DadosQualificacao dados) {
        return gerarQualificacaoProcuracao(
                dados.nome(),
                dados.sexo(),
                dados.nacionalidade(),
                dados.estadoCivil(),
                dados.profissao(),
                dados.rg(),
                dados.ufRg(),
                dados.cpf(),
                dados.cnpj(),
                dados.logradouro(),
                dados.numero(),
                dados.complemento(),
                dados.bairro(),
                dados.cidade(),
                dados.uf(),
                dados.cep(),
                dados.email());
    }

    public static String gerarQualificacaoProcuracao(
            String nome,
            String sexo,
            String nacionalidade,
            String estadoCivil,
            String profissao,
            String rg,
            String ufRg,
            String cpf,
            String cnpj,
            String logradouro,
            String numero,
            String complemento,
            String bairro,
            String cidade,
            String uf,
            String cep,
            String email) {

        boolean feminino = determinarFeminino(nome, sexo);
        FlexaoGenero g = feminino ? FlexaoGenero.feminino() : FlexaoGenero.masculino();

        StringBuilder sb = new StringBuilder();
        String nomeExibicao = nome != null ? nome.trim().toUpperCase(Locale.ROOT) : "OUTORGANTE";
        sb.append(escapeHtml(nomeExibicao));

        if (cnpj != null && !cnpj.isBlank()) {
            sb.append(", pessoa jurídica de direito privado");
            sb.append(", inscrita no CNPJ sob o nº ").append(escapeHtml(cnpj));
            if (logradouro != null && !logradouro.isBlank()) {
                sb.append(", com sede na ").append(escapeHtml(montarLinhaEnderecoLegadoProcuracao(
                        logradouro, numero, complemento)));
                if (bairro != null && !bairro.isBlank()) {
                    sb.append(", ").append(escapeHtml(formatarBairroLegadoProcuracao(bairro)));
                }
                if ((cidade != null && !cidade.isBlank()) || (uf != null && !uf.isBlank())) {
                    sb.append(", ").append(escapeHtml(formatarCidadeEstadoParaQualificacao(cidade, uf)));
                }
                if (cep != null && !cep.isBlank()) {
                    sb.append(", CEP n° ").append(escapeHtml(formatarCepLegadoProcuracao(cep)));
                }
            }
            return sb.toString();
        }

        if (nacionalidade != null && !nacionalidade.isBlank() && !contemDesconhecido(nacionalidade)) {
            sb.append(", ").append(escapeHtml(flexionarNacionalidade(nacionalidade, feminino)));
        } else {
            sb.append(", ").append(escapeHtml(g.brasileiro()));
        }

        String ecFlexionado = flexionarEstadoCivil(estadoCivil, feminino);
        String profNormalizada = profissao != null && !profissao.isBlank() && !contemDesconhecido(profissao)
                ? profissao.trim().toLowerCase(Locale.ROOT)
                : null;

        if (ecFlexionado != null && profNormalizada != null) {
            sb.append(", ").append(escapeHtml(ecFlexionado)).append(", ").append(escapeHtml(profNormalizada));
        } else if (ecFlexionado != null) {
            sb.append(", ").append(escapeHtml(ecFlexionado));
        } else if (profNormalizada != null) {
            sb.append(", ").append(escapeHtml(profNormalizada));
        }

        if (rg != null && !rg.isBlank()) {
            sb.append(", ").append(escapeHtml(g.portador())).append(" da carteira de identidade ");
            if (ufRg != null && !ufRg.isBlank()) {
                sb.append(escapeHtml(ufRg.toUpperCase(Locale.ROOT))).append(" ");
            }
            sb.append("nº ").append(escapeHtml(rg.trim()));
        }

        if (cpf != null && !cpf.isBlank()) {
            sb.append(", regularmente ").append(escapeHtml(g.inscrito()));
            sb.append(" no CPF/MF sob o nº ").append(escapeHtml(cpf));
        }

        if (logradouro != null && !logradouro.isBlank()) {
            sb.append(", ").append(escapeHtml(g.residenteDomiciliado())).append(" na ");
            sb.append(escapeHtml(montarLinhaEnderecoLegadoProcuracao(logradouro, numero, complemento)));
            if (bairro != null && !bairro.isBlank()) {
                sb.append(", ").append(escapeHtml(formatarBairroLegadoProcuracao(bairro)));
            }
            sb.append(", ").append(escapeHtml(formatarCidadeEstadoParaQualificacao(cidade, uf)));
            if (cep != null && !cep.isBlank()) {
                sb.append(", CEP n° ").append(escapeHtml(formatarCepLegadoProcuracao(cep)));
            }
        }

        if (email != null && !email.isBlank()) {
            sb.append(", utiliza endereço eletrônico: ").append(escapeHtml(email.toLowerCase(Locale.ROOT).trim()));
        } else {
            sb.append(", não utiliza endereço eletrônico");
        }

        return sb.toString();
    }

    static String montarLinhaEnderecoLegadoProcuracao(String logradouro, String numero, String complemento) {
        StringBuilder end = new StringBuilder(normalizarLogradouroLegadoProcuracao(logradouro));
        if (numero != null && !numero.isBlank() && !numeroJaPresenteNoLogradouro(logradouro, numero)) {
            end.append(" nº ").append(numero.trim());
        }
        if (complemento != null && !complemento.isBlank()) {
            end.append(" ").append(normalizarComplementoLegadoProcuracao(complemento));
        }
        return compactarEnderecoLegadoProcuracao(end.toString().trim());
    }

    static String normalizarLogradouroLegadoProcuracao(String logradouro) {
        if (logradouro == null || logradouro.isBlank()) {
            return "";
        }
        String texto = logradouro.trim();
        texto = texto.replaceAll("(?i)^Av\\.?\\s+", "Avenida ");
        texto = texto.replaceAll("(?i)^R\\.?\\s+", "Rua ");
        texto = texto.replaceAll("(?i)^Tv\\.?\\s+", "Travessa ");
        texto = texto.replaceAll("(?i)^Al\\.?\\s+", "Alameda ");
        texto = texto.replaceAll("(?i)^Pç\\.?\\s+", "Praça ");
        return normalizarNome(texto);
    }

    static String normalizarComplementoLegadoProcuracao(String complemento) {
        if (complemento == null || complemento.isBlank()) {
            return "";
        }
        return compactarEnderecoLegadoProcuracao(complemento.trim());
    }

    static String compactarEnderecoLegadoProcuracao(String texto) {
        if (texto == null || texto.isBlank()) {
            return "";
        }
        String out = texto.trim();
        out = out.replaceAll("(?i)\\bQuadra\\b", "Qd");
        out = out.replaceAll("(?i)\\bLote\\b", "Lt");
        out = out.replaceAll("(?i)\\bQd\\b\\.?\\s*", "Qd ");
        out = out.replaceAll("(?i)\\bLt\\b\\.?\\s*", "Lt ");
        out = out.replaceAll("(?i)\\bApartamento\\b", "Ap");
        out = out.replaceAll("(?i)\\bEdifício\\b", "Ed");
        out = out.replaceAll("(?i)\\bEdificio\\b", "Ed");
        out = out.replaceAll("(?i)\\bN[ºo°]\\.?\\s*", "nº ");
        out = out.replaceAll(",\\s*,", ",");
        out = out.replaceAll("\\s+", " ").trim();
        return out;
    }

    static String formatarBairroLegadoProcuracao(String bairro) {
        if (bairro == null || bairro.isBlank()) {
            return "";
        }
        String norm = normalizarBairro(bairro);
        if (norm.toLowerCase(Locale.ROOT).startsWith("bairro ")) {
            return norm;
        }
        return "Bairro " + norm;
    }

    static String formatarCepLegadoProcuracao(String cep) {
        String digitos = apenasDigitos(cep);
        return digitos != null ? digitos : cep.trim();
    }

    private static boolean numeroJaPresenteNoLogradouro(String logradouro, String numero) {
        if (logradouro == null || numero == null || numero.isBlank()) {
            return false;
        }
        String n = numero.trim();
        String lower = logradouro.toLowerCase(Locale.ROOT);
        return lower.contains(" nº " + n.toLowerCase(Locale.ROOT))
                || lower.contains(" n° " + n.toLowerCase(Locale.ROOT))
                || lower.endsWith(" " + n);
    }

    /**
     * Ajusta «brasileiro/brasileira» ao gênero da pessoa; demais nacionalidades permanecem em minúsculas
     * como cadastradas (ex.: «portuguesa»).
     */
    static String flexionarNacionalidade(String nacionalidade, boolean feminino) {
        if (nacionalidade == null || nacionalidade.isBlank()) {
            return feminino ? "brasileira" : "brasileiro";
        }
        String norm = nacionalidade.trim().toLowerCase(Locale.ROOT);
        if (norm.equals("brasileira") || norm.equals("brasileiro") || norm.equals("brasil")) {
            return feminino ? "brasileira" : "brasileiro";
        }
        return norm;
    }

    public static boolean determinarFeminino(String nomeCompleto, String sexoOuGenero) {
        if (sexoOuGenero != null && !sexoOuGenero.isBlank()) {
            String s = sexoOuGenero.trim().toUpperCase(Locale.ROOT);
            if (s.startsWith("F") || s.contains("FEMIN")) {
                return true;
            }
            if (s.startsWith("M") || s.contains("MASC")) {
                return false;
            }
        }
        return inferirFemininoPorNome(primeiroNome(nomeCompleto));
    }

    static boolean inferirFemininoPorNome(String primeiroNome) {
        if (primeiroNome == null || primeiroNome.isBlank()) {
            return false;
        }
        String nome = primeiroNome.toUpperCase(Locale.ROOT).trim();
        if (FEMININOS_EXPLICITOS.contains(nome)) {
            return true;
        }
        if (EXCECOES_MASCULINAS_TERMINADAS_EM_A.contains(nome)) {
            return false;
        }
        if (nome.endsWith("A")
                || nome.endsWith("ANE")
                || nome.endsWith("ENE")
                || nome.endsWith("INE")
                || nome.endsWith("ICE")
                || nome.endsWith("IDE")) {
            return true;
        }
        return false;
    }

    public static String flexionarEstadoCivil(String estadoCivil, boolean feminino) {
        if (estadoCivil == null || estadoCivil.isBlank() || contemDesconhecido(estadoCivil)) {
            return null;
        }
        String normalizado = estadoCivil.trim().toUpperCase(Locale.ROOT)
                .replace("Í", "I")
                .replace("Ú", "U")
                .replace("Ã", "A")
                .replace("Ç", "C");
        return switch (normalizado) {
            case "CASADO", "CASADA" -> feminino ? "casada" : "casado";
            case "SOLTEIRO", "SOLTEIRA" -> feminino ? "solteira" : "solteiro";
            case "DIVORCIADO", "DIVORCIADA" -> feminino ? "divorciada" : "divorciado";
            case "VIUVO", "VIUVA" -> feminino ? "viúva" : "viúvo";
            case "SEPARADO", "SEPARADA" -> feminino ? "separada" : "separado";
            case "UNIAO ESTAVEL" -> "em união estável";
            default -> estadoCivil.trim().toLowerCase(Locale.ROOT);
        };
    }

    public static String normalizarNome(String nome) {
        if (nome == null || nome.isBlank()) {
            return "";
        }
        String[] palavras = nome.trim().toLowerCase(Locale.ROOT).split("\\s+");
        StringBuilder resultado = new StringBuilder();
        for (int i = 0; i < palavras.length; i++) {
            String palavra = palavras[i];
            if (i == 0) {
                resultado.append(formatarPalavra(palavra));
            } else if (PREPOSICOES.contains(palavra)) {
                resultado.append(palavra);
            } else {
                resultado.append(formatarPalavra(palavra));
            }
            if (i < palavras.length - 1) {
                resultado.append(" ");
            }
        }
        return aplicarTermosEmpresariais(resultado.toString());
    }

    private static String aplicarTermosEmpresariais(String nome) {
        if (nome == null || nome.isBlank()) {
            return nome != null ? nome : "";
        }
        String[] palavras = nome.split("\\s+");
        StringBuilder resultado = new StringBuilder();
        for (int i = 0; i < palavras.length; i++) {
            String palavra = palavras[i];
            String chave = palavra.toLowerCase(Locale.ROOT);

            if (i + 1 < palavras.length) {
                String par = chave + " " + palavras[i + 1].toLowerCase(Locale.ROOT);
                String termoPar = TERMOS_EMPRESARIAIS.get(par);
                if (termoPar != null) {
                    if (!resultado.isEmpty()) {
                        resultado.append(" ");
                    }
                    resultado.append(termoPar);
                    i++;
                    continue;
                }
            }

            String termo = TERMOS_EMPRESARIAIS.get(chave);
            if (termo == null && chave.endsWith(".")) {
                termo = TERMOS_EMPRESARIAIS.get(chave.substring(0, chave.length() - 1));
            }
            if (!resultado.isEmpty()) {
                resultado.append(" ");
            }
            resultado.append(termo != null ? termo : palavra);
        }
        return resultado.toString();
    }

    public static String normalizarEndereco(String logradouro) {
        if (logradouro == null || logradouro.isBlank()) {
            return "";
        }
        String texto = logradouro.trim();
        texto = texto.replaceAll("(?i)^Av\\.?\\s+", "Avenida ");
        texto = texto.replaceAll("(?i)^R\\.?\\s+", "Rua ");
        texto = texto.replaceAll("(?i)^Tv\\.?\\s+", "Travessa ");
        texto = texto.replaceAll("(?i)^Al\\.?\\s+", "Alameda ");
        texto = texto.replaceAll("(?i)^Pç\\.?\\s+", "Praça ");
        // Cada abreviação só expande como TOKEN COMPLETO (fronteira \b no fim), para não casar o
        // prefixo de palavras já escritas por extenso (ex.: "APARTAMENTO" → "AP" + "ARTAMENTO").
        texto = texto.replaceAll("(?i)\\bQd\\b\\.?\\s*", "Quadra ");
        texto = texto.replaceAll("(?i)\\bLt\\b\\.?\\s*", "Lote ");
        texto = texto.replaceAll("(?i)\\bConj\\b\\.?\\s*", "Conjunto ");
        texto = texto.replaceAll("(?i)\\b(?:Apto|Apt|Ap)\\b\\.?\\s*", "Apartamento ");
        texto = texto.replaceAll("(?i)\\bEd\\b\\.?\\s*", "Edifício ");
        texto = texto.replaceAll("(?i)\\bBl\\b\\.?\\s*", "Bloco ");
        return normalizarNome(texto);
    }

    public static String normalizarBairro(String bairro) {
        return normalizarNome(bairro);
    }

    public static String normalizarCidade(String cidade) {
        return normalizarNome(cidade);
    }

    public static String formatarCep(String cep) {
        if (cep == null || cep.isBlank()) {
            return "";
        }
        String numeros = apenasDigitos(cep);
        if (numeros != null && numeros.length() == 8) {
            return numeros.substring(0, 2) + "." + numeros.substring(2, 5) + "-" + numeros.substring(5);
        }
        return cep.trim();
    }

    public static String formatarCpf(String cpf) {
        if (cpf == null || cpf.isBlank()) {
            return "";
        }
        String d = apenasDigitos(cpf);
        if (d == null || d.length() != 11) {
            return cpf.trim();
        }
        return String.format(
                "%s.%s.%s-%s",
                d.substring(0, 3),
                d.substring(3, 6),
                d.substring(6, 9),
                d.substring(9));
    }

    public static String formatarCnpj(String cnpj) {
        if (cnpj == null || cnpj.isBlank()) {
            return "";
        }
        String d = apenasDigitos(cnpj);
        if (d == null || d.length() != 14) {
            return cnpj.trim();
        }
        return String.format(
                "%s.%s.%s/%s-%s",
                d.substring(0, 2),
                d.substring(2, 5),
                d.substring(5, 8),
                d.substring(8, 12),
                d.substring(12));
    }

    public static String nomeEstadoPorSigla(String uf) {
        if (uf == null || uf.isBlank()) {
            return "Goiás";
        }
        String t = uf.trim();
        if (t.length() > 2) {
            return normalizarCidade(t);
        }
        return ESTADOS_POR_SIGLA.getOrDefault(t.toUpperCase(Locale.ROOT), t);
    }

    public static String formatarCidadeEstadoParaQualificacao(String cidade, String uf) {
        String cid = normalizarCidade(cidade != null && !cidade.isBlank() ? cidade : "Anápolis");
        String estado = nomeEstadoPorSigla(uf != null && !uf.isBlank() ? uf : "GO");
        if (isDistritoFederal(uf, estado)) {
            return "cidade de " + cid + ", Distrito Federal";
        }
        return "cidade de " + cid + ", estado de " + estado;
    }

    static boolean isAlgarismoRomano(String palavra) {
        if (palavra == null || palavra.isBlank()) {
            return false;
        }
        String p = palavra.trim();
        if (!p.matches("(?i)[ivxlcdm]+")) {
            return false;
        }
        return ALGARISMO_ROMANO.matcher(p).matches();
    }

    private static boolean isDistritoFederal(String uf, String estadoNome) {
        if (uf != null && uf.trim().equalsIgnoreCase("DF")) {
            return true;
        }
        return estadoNome != null && estadoNome.equalsIgnoreCase("Distrito Federal");
    }

    private static String formatarPalavra(String palavra) {
        if (isAlgarismoRomano(palavra)) {
            return palavra.toUpperCase(Locale.ROOT);
        }
        return capitalizar(palavra);
    }

    private static String primeiroNome(String nomeCompleto) {
        if (nomeCompleto == null || nomeCompleto.isBlank()) {
            return "";
        }
        return nomeCompleto.trim().split("\\s+")[0];
    }

    private static String extrairUfRg(String orgaoExpedidor) {
        if (orgaoExpedidor == null || orgaoExpedidor.isBlank()) {
            return "GO";
        }
        String t = orgaoExpedidor.trim();
        int barra = t.lastIndexOf('/');
        if (barra >= 0 && barra < t.length() - 1) {
            String uf = t.substring(barra + 1).trim().toUpperCase(Locale.ROOT);
            if (uf.length() == 2) {
                return uf;
            }
        }
        if (t.length() == 2) {
            return t.toUpperCase(Locale.ROOT);
        }
        return "GO";
    }

    private static boolean contemDesconhecido(String valor) {
        return valor.toLowerCase(Locale.ROOT).contains("desconhec");
    }

    private static String capitalizar(String palavra) {
        if (palavra == null || palavra.isEmpty()) {
            return "";
        }
        return palavra.substring(0, 1).toUpperCase(Locale.ROOT) + palavra.substring(1);
    }

    private static String apenasDigitos(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        String d = APENAS_DIGITOS.matcher(valor).replaceAll("");
        return d.isEmpty() ? null : d;
    }

    private static String textoOuNull(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        return valor.trim();
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

    private static final Map<String, String> ESTADOS_POR_SIGLA = Map.ofEntries(
            Map.entry("AC", "Acre"),
            Map.entry("AL", "Alagoas"),
            Map.entry("AP", "Amapá"),
            Map.entry("AM", "Amazonas"),
            Map.entry("BA", "Bahia"),
            Map.entry("CE", "Ceará"),
            Map.entry("DF", "Distrito Federal"),
            Map.entry("ES", "Espírito Santo"),
            Map.entry("GO", "Goiás"),
            Map.entry("MA", "Maranhão"),
            Map.entry("MT", "Mato Grosso"),
            Map.entry("MS", "Mato Grosso do Sul"),
            Map.entry("MG", "Minas Gerais"),
            Map.entry("PA", "Pará"),
            Map.entry("PB", "Paraíba"),
            Map.entry("PR", "Paraná"),
            Map.entry("PE", "Pernambuco"),
            Map.entry("PI", "Piauí"),
            Map.entry("RJ", "Rio de Janeiro"),
            Map.entry("RN", "Rio Grande do Norte"),
            Map.entry("RS", "Rio Grande do Sul"),
            Map.entry("RO", "Rondônia"),
            Map.entry("RR", "Roraima"),
            Map.entry("SC", "Santa Catarina"),
            Map.entry("SP", "São Paulo"),
            Map.entry("SE", "Sergipe"),
            Map.entry("TO", "Tocantins"));

    public record FlexaoGenero(
            String brasileiro,
            String portador,
            String inscrito,
            String residenteDomiciliado,
            String casado,
            String solteiro,
            String divorciado,
            String viuvo) {

        public static FlexaoGenero masculino() {
            return new FlexaoGenero(
                    "brasileiro",
                    "portador",
                    "inscrito",
                    "residente e domiciliado",
                    "casado",
                    "solteiro",
                    "divorciado",
                    "viúvo");
        }

        public static FlexaoGenero feminino() {
            return new FlexaoGenero(
                    "brasileira",
                    "portadora",
                    "inscrita",
                    "residente e domiciliada",
                    "casada",
                    "solteira",
                    "divorciada",
                    "viúva");
        }
    }
}
