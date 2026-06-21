package br.com.vilareal.mensalista.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.mensalista.api.dto.MensalistaGerarMesResponse;
import br.com.vilareal.mensalista.api.dto.MensalistaResponse;
import br.com.vilareal.mensalista.api.dto.MensalistaWriteRequest;
import br.com.vilareal.mensalista.infrastructure.persistence.entity.MensalistaEntity;
import br.com.vilareal.mensalista.infrastructure.persistence.repository.MensalistaRepository;
import br.com.vilareal.pagamento.api.dto.PagamentoWriteRequest;
import br.com.vilareal.pagamento.application.PagamentoApplicationService;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
public class MensalistaApplicationService {

    public static final String ORIGEM_PREFIXO = "MENSALISTA:";
    private static final Pattern MES_REFERENCIA = Pattern.compile("^\\d{4}-\\d{2}$");
    private static final DateTimeFormatter FMT_MES_REF = DateTimeFormatter.ofPattern("yyyy-MM", Locale.ROOT);

    private final MensalistaRepository mensalistaRepository;
    private final ClienteRepository clienteRepository;
    private final PagamentoRepository pagamentoRepository;
    private final PagamentoApplicationService pagamentoApplicationService;
    private final Clock clock;

    public MensalistaApplicationService(
            MensalistaRepository mensalistaRepository,
            ClienteRepository clienteRepository,
            PagamentoRepository pagamentoRepository,
            PagamentoApplicationService pagamentoApplicationService,
            Clock clock) {
        this.mensalistaRepository = mensalistaRepository;
        this.clienteRepository = clienteRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.pagamentoApplicationService = pagamentoApplicationService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public MensalistaResponse buscarPorCliente(Long clienteId) {
        return mensalistaRepository
                .findByCliente_IdWithDetalhes(clienteId)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Mensalista não encontrado para cliente " + clienteId));
    }

    @Transactional(readOnly = true)
    public Optional<MensalistaResponse> buscarPorClienteOpcional(Long clienteId) {
        return mensalistaRepository.findByCliente_IdWithDetalhes(clienteId).map(this::toResponse);
    }

    @Transactional
    public MensalistaResponse salvar(MensalistaWriteRequest req) {
        validarVigencia(req.dataInicio(), req.dataFim());
        ClienteEntity cliente = resolveCliente(req.clienteId());
        MensalistaEntity entity = mensalistaRepository
                .findByCliente_IdWithDetalhes(cliente.getId())
                .orElseGet(MensalistaEntity::new);
        entity.setCliente(cliente);
        entity.setValor(req.valor());
        entity.setDiaVencimento(req.diaVencimento());
        entity.setDataInicio(req.dataInicio());
        entity.setDataFim(req.dataFim());
        entity.setAtivo(Boolean.TRUE.equals(req.ativo()));
        entity = mensalistaRepository.save(entity);
        return toResponse(entity);
    }

    @Transactional
    public void removerPorCliente(Long clienteId) {
        MensalistaEntity entity = mensalistaRepository
                .findByCliente_IdWithDetalhes(clienteId)
                .orElseThrow(() -> new ResourceNotFoundException("Mensalista não encontrado para cliente " + clienteId));
        mensalistaRepository.delete(entity);
    }

    @Transactional
    public MensalistaGerarMesResponse gerarMes(String mesAnoParam) {
        String mesReferencia = resolverMesReferencia(mesAnoParam);
        YearMonth ym = parseMesReferencia(mesReferencia);
        List<MensalistaEntity> mensalistas = mensalistaRepository.findAtivosComCliente();

        MensalistaGerarMesResponse resp = new MensalistaGerarMesResponse();
        resp.setMesReferencia(mesReferencia);
        resp.setTotalMensalistas(mensalistas.size());

        int gerados = 0;
        int jaExistiam = 0;
        int ignorados = 0;
        int erros = 0;

        for (MensalistaEntity mensalista : mensalistas) {
            MensalistaGerarMesResponse.Detalhe d = new MensalistaGerarMesResponse.Detalhe();
            d.setMensalistaId(mensalista.getId());
            d.setClienteId(mensalista.getCliente().getId());
            d.setClienteNome(nomeCliente(mensalista));
            try {
                if (!vigenteNoMes(mensalista, ym)) {
                    d.setResultado("IGNORADO");
                    ignorados++;
                } else {
                    ResultadoGeracao r = gerarRecebivelSeNecessario(mensalista, mesReferencia, ym);
                    d.setResultado(r.resultado());
                    d.setPagamentoId(r.pagamentoId());
                    switch (r.resultado()) {
                        case "GERADO" -> gerados++;
                        case "JA_EXISTIA" -> jaExistiam++;
                        default -> ignorados++;
                    }
                }
            } catch (Exception ex) {
                d.setResultado("ERRO");
                d.setMensagemErro(ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName());
                erros++;
            }
            resp.getDetalhes().add(d);
        }

        resp.setGerados(gerados);
        resp.setJaExistiam(jaExistiam);
        resp.setIgnorados(ignorados);
        resp.setErros(erros);
        return resp;
    }

    record ResultadoGeracao(String resultado, Long pagamentoId) {}

    ResultadoGeracao gerarRecebivelSeNecessario(MensalistaEntity mensalista, String mesReferencia, YearMonth ym) {
        String origem = origemMensalista(mensalista.getId());
        Optional<PagamentoEntity> existente = pagamentoRepository.findFirstByOrigemAndMesReferencia(origem, mesReferencia);
        if (existente.isPresent()) {
            return new ResultadoGeracao("JA_EXISTIA", existente.get().getId());
        }
        LocalDate vencimento = calcularDataVencimento(mensalista.getDiaVencimento(), ym);
        PagamentoWriteRequest req = new PagamentoWriteRequest();
        req.setTipo(PagamentoDominio.TIPO_RECEBER);
        req.setClienteId(mensalista.getCliente().getId());
        req.setValor(mensalista.getValor());
        req.setDataVencimento(vencimento);
        req.setDataCadastro(LocalDate.now(clock));
        req.setCategoria("MENSALIDADE");
        req.setFormaPagamento("PIX");
        req.setDescricao(montarDescricao(mensalista, mesReferencia));
        req.setOrigem(origem);
        req.setMesReferencia(mesReferencia);
        var pagResp = pagamentoApplicationService.criar(req);
        return new ResultadoGeracao("GERADO", pagResp.getId());
    }

    static boolean vigenteNoMes(MensalistaEntity mensalista, YearMonth ym) {
        if (!Boolean.TRUE.equals(mensalista.getAtivo())) {
            return false;
        }
        LocalDate inicioMes = ym.atDay(1);
        LocalDate fimMes = ym.atEndOfMonth();
        if (mensalista.getDataInicio() != null && mensalista.getDataInicio().isAfter(fimMes)) {
            return false;
        }
        if (mensalista.getDataFim() != null && mensalista.getDataFim().isBefore(inicioMes)) {
            return false;
        }
        return true;
    }

    static String origemMensalista(Long mensalistaId) {
        return ORIGEM_PREFIXO + mensalistaId;
    }

    static LocalDate calcularDataVencimento(int diaVencimento, YearMonth ym) {
        int dia = Math.min(Math.max(diaVencimento, 1), 31);
        int ultimo = ym.lengthOfMonth();
        return ym.atDay(Math.min(dia, ultimo));
    }

    private static String montarDescricao(MensalistaEntity mensalista, String mesReferencia) {
        String nome = nomeCliente(mensalista);
        return "Mensalidade — " + (nome != null ? nome : "cliente") + " — " + mesReferencia;
    }

    private static String nomeCliente(MensalistaEntity mensalista) {
        ClienteEntity c = mensalista.getCliente();
        if (c == null) {
            return null;
        }
        if (StringUtils.hasText(c.getNomeReferencia())) {
            return c.getNomeReferencia().trim();
        }
        return c.getPessoa() != null && StringUtils.hasText(c.getPessoa().getNome())
                ? c.getPessoa().getNome().trim()
                : null;
    }

    String resolverMesReferencia(String mesAnoParam) {
        if (!StringUtils.hasText(mesAnoParam)) {
            return YearMonth.from(LocalDate.now(clock)).format(FMT_MES_REF);
        }
        return parseMesReferencia(mesAnoParam.trim()).format(FMT_MES_REF);
    }

    static YearMonth parseMesReferencia(String mesReferencia) {
        if (!MES_REFERENCIA.matcher(mesReferencia).matches()) {
            throw new BusinessRuleException("Formato de mês/ano inválido. Use AAAA-MM.");
        }
        try {
            YearMonth ym = YearMonth.parse(mesReferencia, FMT_MES_REF);
            int ano = ym.getYear();
            if (ano < 2000 || ano > 2100) {
                throw new BusinessRuleException("Ano fora do intervalo permitido.");
            }
            return ym;
        } catch (DateTimeParseException e) {
            throw new BusinessRuleException("Formato de mês/ano inválido. Use AAAA-MM.");
        }
    }

    private static void validarVigencia(LocalDate inicio, LocalDate fim) {
        if (fim != null && fim.isBefore(inicio)) {
            throw new BusinessRuleException("Data fim anterior à data início.");
        }
    }

    private ClienteEntity resolveCliente(Long clienteId) {
        return clienteRepository
                .findById(clienteId)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado: " + clienteId));
    }

    private MensalistaResponse toResponse(MensalistaEntity e) {
        ClienteEntity c = e.getCliente();
        return new MensalistaResponse(
                e.getId(),
                c != null ? c.getId() : null,
                nomeCliente(e),
                c != null ? c.getCodigoCliente() : null,
                e.getValor(),
                e.getDiaVencimento(),
                e.getDataInicio(),
                e.getDataFim(),
                e.getAtivo());
    }
}
