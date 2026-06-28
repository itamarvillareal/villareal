package br.com.vilareal.projudi;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.localidade.domain.MunicipioTextoUtil;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaContatoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEnderecoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaEnderecoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class ProjudiParteResolverService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiParteResolverService.class);

    private static final String REFERER_PROCESSO_CIVEL = "https://projudi.tjgo.jus.br/ProcessoCivel";

    public enum NivelResolucao {
        RESOLVIDO,
        PENDENTE
    }

    public record CampoResolvido(
            String valorOriginal,
            Integer idProjudi,
            String labelProjudi,
            NivelResolucao nivel,
            String motivo) {

        public static CampoResolvido resolvido(String valorOriginal, int idProjudi, String labelProjudi) {
            return new CampoResolvido(
                    valorOriginal, idProjudi, labelProjudi, NivelResolucao.RESOLVIDO, null);
        }

        public static CampoResolvido pendente(String valorOriginal, String motivo) {
            return new CampoResolvido(valorOriginal, null, null, NivelResolucao.PENDENTE, motivo);
        }
    }

    public record ParteProjudiResolvida(
            String nome,
            String documento,
            String tipoDoc,
            String telefone,
            String email,
            String logradouro,
            String numero,
            String complemento,
            String cep,
            CampoResolvido estado,
            CampoResolvido cidade,
            CampoResolvido bairro,
            boolean prontaParaInserir,
            List<String> pendencias) {}

    private final PessoaRepository pessoaRepository;
    private final PessoaEnderecoRepository enderecoRepository;
    private final PessoaContatoRepository contatoRepository;
    private final ProjudiSessionService sessionService;
    private final ObjectMapper objectMapper;

    public ProjudiParteResolverService(
            PessoaRepository pessoaRepository,
            PessoaEnderecoRepository enderecoRepository,
            PessoaContatoRepository contatoRepository,
            ProjudiSessionService sessionService,
            ObjectMapper objectMapper) {
        this.pessoaRepository = pessoaRepository;
        this.enderecoRepository = enderecoRepository;
        this.contatoRepository = contatoRepository;
        this.sessionService = sessionService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public ParteProjudiResolvida resolver(Long pessoaId, Long credencialId) {
        if (pessoaId == null) {
            throw new IllegalArgumentException("pessoaId é obrigatório.");
        }
        if (credencialId == null) {
            credencialId = 1L;
        }

        PessoaEntity pessoa = pessoaRepository
                .findById(pessoaId)
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + pessoaId));

        List<PessoaEnderecoEntity> enderecos = enderecoRepository.findByPessoa_IdOrderByNumeroOrdemAsc(pessoaId);
        PessoaEnderecoEntity endereco = enderecos.isEmpty() ? null : enderecos.getFirst();

        DocumentoTipo doc = resolverDocumento(pessoa.getCpf());
        Contatos contatos = carregarContatos(pessoa);

        ProjudiEnderecoParser.ResultadoParse enderecoParse =
                ProjudiEnderecoParser.parse(endereco != null ? endereco.getRua() : null);

        String ufSigla = endereco != null && endereco.getEstado() != null
                ? endereco.getEstado().trim()
                : (endereco != null && endereco.getMunicipio() != null
                        ? endereco.getMunicipio().getEstado().getSigla()
                        : null);
        String cidadeNome = endereco != null && StringUtils.hasText(endereco.getCidade())
                ? endereco.getCidade().trim()
                : (endereco != null && endereco.getMunicipio() != null
                        ? endereco.getMunicipio().getNome()
                        : null);
        String bairroNome = endereco != null ? endereco.getBairro() : null;
        String cep = endereco != null ? endereco.getCep() : null;

        String estadoBusca = ProjudiUfPorExtensoUtil.nomePorSigla(ufSigla);
        if (estadoBusca == null && StringUtils.hasText(ufSigla)) {
            estadoBusca = ufSigla;
        }

        CampoResolvido estadoResolvido = buscarEstado(credencialId, ufSigla, estadoBusca);
        CampoResolvido cidadeResolvida = CampoResolvido.pendente(
                cidadeNome,
                "estado não resolvido — impossível buscar cidade no catálogo PROJUDI");
        CampoResolvido bairroResolvido = CampoResolvido.pendente(
                bairroNome,
                "cidade não resolvida — impossível buscar bairro no catálogo PROJUDI");

        if (estadoResolvido.nivel() == NivelResolucao.RESOLVIDO && estadoResolvido.idProjudi() != null) {
            cidadeResolvida = buscarCidade(
                    credencialId, cidadeNome, estadoResolvido.idProjudi(), estadoResolvido.labelProjudi());
        }
        if (cidadeResolvida.nivel() == NivelResolucao.RESOLVIDO && cidadeResolvida.idProjudi() != null) {
            bairroResolvido = buscarBairro(
                    credencialId, bairroNome, cidadeResolvida.idProjudi(), cidadeResolvida.labelProjudi());
        }

        List<String> pendencias = new ArrayList<>();
        if (!StringUtils.hasText(pessoa.getNome())) {
            pendencias.add("nome ausente no cadastro da pessoa");
        }
        if (!StringUtils.hasText(doc.documento())) {
            pendencias.add("CPF/CNPJ ausente no cadastro da pessoa");
        }
        if (!StringUtils.hasText(enderecoParse.partes().logradouro())) {
            pendencias.add("logradouro ausente (campo rua do endereço vazio ou não parseável)");
        }
        if (!StringUtils.hasText(cep)) {
            pendencias.add("CEP ausente no endereço da pessoa");
        }
        if (enderecoParse.baixaConfianca()) {
            pendencias.add("parse do logradouro/número com baixa confiança — revisar campo rua");
        }
        if (estadoResolvido.nivel() == NivelResolucao.PENDENTE) {
            pendencias.add("estado: " + estadoResolvido.motivo());
        }
        if (cidadeResolvida.nivel() == NivelResolucao.PENDENTE) {
            pendencias.add("cidade: " + cidadeResolvida.motivo());
        }
        if (bairroResolvido.nivel() == NivelResolucao.PENDENTE) {
            pendencias.add("bairro: " + bairroResolvido.motivo());
        }

        boolean pronta = pendencias.isEmpty()
                && estadoResolvido.nivel() == NivelResolucao.RESOLVIDO
                && cidadeResolvida.nivel() == NivelResolucao.RESOLVIDO
                && bairroResolvido.nivel() == NivelResolucao.RESOLVIDO;

        return new ParteProjudiResolvida(
                pessoa.getNome(),
                doc.documento(),
                doc.tipoDoc(),
                contatos.telefone(),
                contatos.email(),
                enderecoParse.partes().logradouro(),
                enderecoParse.partes().numero(),
                enderecoParse.partes().complemento(),
                cep,
                estadoResolvido,
                cidadeResolvida,
                bairroResolvido,
                pronta,
                List.copyOf(pendencias));
    }

    private CampoResolvido buscarEstado(Long credencialId, String ufSigla, String estadoBusca) {
        if (!StringUtils.hasText(estadoBusca)) {
            return CampoResolvido.pendente(ufSigla, "UF/estado ausente no endereço da pessoa");
        }
        String path = "Estado?AJAX=ajax&Passo=1&PaginaAtual=2&nomeBusca1="
                + urlEncode(estadoBusca)
                + "&PosicaoPaginaAtual=0";
        ResultadoBuscaAjax busca = executarBusca(credencialId, "Estado", path);
        if (busca.falhaHttp() != null) {
            return CampoResolvido.pendente(estadoBusca, busca.falhaHttp());
        }
        return resolverCampo(estadoBusca, busca.candidatos(), "estado '" + estadoBusca + "'");
    }

    private CampoResolvido buscarCidade(
            Long credencialId, String cidadeNome, int idEstado, String labelEstado) {
        if (!StringUtils.hasText(cidadeNome)) {
            return CampoResolvido.pendente(cidadeNome, "cidade ausente no endereço da pessoa");
        }
        String path = "Cidade?AJAX=ajax&Passo=1&PaginaAtual=2&nomeBusca1="
                + urlEncode(cidadeNome)
                + "&PosicaoPaginaAtual=0&filtroTabela="
                + idEstado;
        ResultadoBuscaAjax busca = executarBusca(credencialId, "Cidade", path);
        if (busca.falhaHttp() != null) {
            return CampoResolvido.pendente(cidadeNome, busca.falhaHttp());
        }
        return resolverCampo(
                cidadeNome,
                busca.candidatos(),
                "cidade '" + cidadeNome + "' no catálogo PROJUDI de " + labelEstado + " (Id_Estado=" + idEstado + ")");
    }

    private CampoResolvido buscarBairro(
            Long credencialId, String bairroNome, int idCidade, String labelCidade) {
        if (!StringUtils.hasText(bairroNome)) {
            return CampoResolvido.pendente(bairroNome, "bairro ausente no endereço da pessoa");
        }
        String path = "Bairro?AJAX=ajax&Passo=1&PaginaAtual=2&nomeBusca1="
                + urlEncode(bairroNome)
                + "&PosicaoPaginaAtual=0&filtroTabela="
                + idCidade;
        ResultadoBuscaAjax busca = executarBusca(credencialId, "Bairro", path);
        if (busca.falhaHttp() != null) {
            return CampoResolvido.pendente(bairroNome, busca.falhaHttp());
        }
        return resolverCampo(
                bairroNome,
                busca.candidatos(),
                "bairro '" + bairroNome + "' no catálogo PROJUDI de " + labelCidade + " (Id_BairroCidade="
                        + idCidade
                        + ")");
    }

    private record ResultadoBuscaAjax(List<ProjudiAjaxListaParser.CandidatoProjudi> candidatos, String falhaHttp) {}

    private ResultadoBuscaAjax executarBusca(Long credencialId, String nivel, String path) {
        var resp = sessionService.getAutenticadoAjaxComReferer(credencialId, path, REFERER_PROCESSO_CIVEL);
        if (resp.statusCode() != 200) {
            String falha = ProjudiSessionService.mensagemFalhaHttpAjax(resp.statusCode());
            log.warn(
                    "PROJUDI parte-resolver {}: url={} status={} — {}",
                    nivel,
                    path,
                    resp.statusCode(),
                    falha);
            return new ResultadoBuscaAjax(List.of(), falha);
        }
        List<ProjudiAjaxListaParser.CandidatoProjudi> candidatos =
                ProjudiAjaxListaParser.parse(resp.body(), objectMapper);
        log.info(
                "PROJUDI parte-resolver {}: url={} candidatos={}",
                nivel,
                path,
                candidatos.size());
        return new ResultadoBuscaAjax(candidatos, null);
    }

    static CampoResolvido resolverCampo(
            String valorOriginal, List<ProjudiAjaxListaParser.CandidatoProjudi> candidatos, String contexto) {
        String original = valorOriginal != null ? valorOriginal.trim() : "";
        if (!StringUtils.hasText(original)) {
            return CampoResolvido.pendente(original, contexto + ": valor ausente");
        }
        if (candidatos == null || candidatos.isEmpty()) {
            return CampoResolvido.pendente(
                    original, contexto + ": nenhum candidato retornado pelo catálogo PROJUDI");
        }
        if (candidatos.size() == 1) {
            ProjudiAjaxListaParser.CandidatoProjudi c = candidatos.getFirst();
            return CampoResolvido.resolvido(original, c.id(), c.label());
        }
        List<ProjudiAjaxListaParser.CandidatoProjudi> exatos = candidatos.stream()
                .filter(c -> nomesIguais(c.label(), original))
                .toList();
        if (exatos.size() == 1) {
            ProjudiAjaxListaParser.CandidatoProjudi c = exatos.getFirst();
            return CampoResolvido.resolvido(original, c.id(), c.label());
        }
        if (exatos.size() > 1) {
            return CampoResolvido.pendente(
                    original,
                    contexto + ": ambíguo — " + exatos.size() + " candidatos com match exato");
        }
        return CampoResolvido.pendente(
                original,
                contexto + ": não encontrado (" + candidatos.size() + " candidatos retornados)");
    }

    private static boolean nomesIguais(String a, String b) {
        return MunicipioTextoUtil.normalizarNome(a).equals(MunicipioTextoUtil.normalizarNome(b));
    }

    private static String urlEncode(String valor) {
        return URLEncoder.encode(valor, StandardCharsets.UTF_8);
    }

    private Contatos carregarContatos(PessoaEntity pessoa) {
        String email = textoOuNull(pessoa.getEmail());
        String telefone = textoOuNull(pessoa.getTelefone());
        for (PessoaContatoEntity c : contatoRepository.findByPessoa_IdOrderByIdAsc(pessoa.getId())) {
            if (c == null || !StringUtils.hasText(c.getValor())) {
                continue;
            }
            String tipo = c.getTipo() != null ? c.getTipo().toLowerCase(Locale.ROOT) : "";
            String valor = c.getValor().trim();
            if (email == null && (tipo.contains("email") || valor.contains("@"))) {
                email = valor;
            }
            if (telefone == null
                    && (tipo.contains("tel") || tipo.contains("cel") || tipo.contains("fone") || tipo.contains("whats"))) {
                telefone = valor;
            }
        }
        return new Contatos(telefone, email);
    }

    private static DocumentoTipo resolverDocumento(String cpfRaw) {
        if (!StringUtils.hasText(cpfRaw)) {
            return new DocumentoTipo(null, null);
        }
        String digitos = cpfRaw.replaceAll("\\D+", "");
        if (digitos.length() == 14) {
            return new DocumentoTipo(digitos, "CNPJ");
        }
        if (digitos.length() == 11) {
            return new DocumentoTipo(digitos, "CPF");
        }
        return new DocumentoTipo(cpfRaw.trim(), "CPF");
    }

    private static String textoOuNull(String s) {
        if (!StringUtils.hasText(s)) {
            return null;
        }
        return s.trim();
    }

    private record Contatos(String telefone, String email) {}

    private record DocumentoTipo(String documento, String tipoDoc) {}
}
