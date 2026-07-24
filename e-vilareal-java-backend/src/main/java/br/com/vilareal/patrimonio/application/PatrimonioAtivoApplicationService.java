package br.com.vilareal.patrimonio.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.patrimonio.api.dto.AtivoCadastroDtos.*;
import br.com.vilareal.patrimonio.infrastructure.persistence.entity.*;
import br.com.vilareal.patrimonio.infrastructure.persistence.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
public class PatrimonioAtivoApplicationService {

    private final CaixaRepository caixaRepository;
    private final RendaFixaRepository rendaFixaRepository;
    private final ImovelPatrimonioRepository imovelRepository;
    private final AtivoRvRepository ativoRvRepository;
    private final VeiculoRepository veiculoRepository;
    private final OperacaoOpcaoRepository opcaoRepository;

    public PatrimonioAtivoApplicationService(
            CaixaRepository caixaRepository,
            RendaFixaRepository rendaFixaRepository,
            ImovelPatrimonioRepository imovelRepository,
            AtivoRvRepository ativoRvRepository,
            VeiculoRepository veiculoRepository,
            OperacaoOpcaoRepository opcaoRepository) {
        this.caixaRepository = caixaRepository;
        this.rendaFixaRepository = rendaFixaRepository;
        this.imovelRepository = imovelRepository;
        this.ativoRvRepository = ativoRvRepository;
        this.veiculoRepository = veiculoRepository;
        this.opcaoRepository = opcaoRepository;
    }

    // ---- Caixa ----
    @Transactional(readOnly = true)
    public List<CaixaResponse> listarCaixa() {
        return caixaRepository.findByAtivoTrue().stream().map(this::toCaixa).toList();
    }

    @Transactional
    public CaixaResponse salvarCaixa(Long id, CaixaRequest req) {
        CaixaEntity e = id == null ? new CaixaEntity() : caixaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Caixa não encontrado"));
        e.setDescricao(req.descricao());
        e.setInstituicao(req.instituicao());
        e.setValor(req.valor());
        e.setVinculado(Boolean.TRUE.equals(req.vinculado()));
        e.setMotivoVinculo(req.motivoVinculo());
        e.setAtivo(true);
        return toCaixa(caixaRepository.save(e));
    }

    @Transactional
    public void desativarCaixa(Long id) {
        CaixaEntity e = caixaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Caixa não encontrado"));
        e.setAtivo(false);
        caixaRepository.save(e);
    }

    // ---- RF ----
    @Transactional(readOnly = true)
    public List<RendaFixaResponse> listarRf() {
        return rendaFixaRepository.findByAtivoTrue().stream().map(this::toRf).toList();
    }

    @Transactional
    public RendaFixaResponse salvarRf(Long id, RendaFixaRequest req) {
        RendaFixaEntity e = id == null ? new RendaFixaEntity() : rendaFixaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Renda fixa não encontrada"));
        e.setInstrumento(req.instrumento());
        e.setInstituicao(req.instituicao());
        e.setValorAplicado(req.valorAplicado());
        e.setValorAtual(req.valorAtual());
        e.setIndexador(req.indexador());
        e.setTaxaContratada(req.taxaContratada());
        e.setVencimento(req.vencimento());
        e.setLiquidez(req.liquidez() != null ? req.liquidez() : "NO_VENCIMENTO");
        e.setReservaEmergencia(Boolean.TRUE.equals(req.reservaEmergencia()));
        e.setRentabilidadeBrutaAa(req.rentabilidadeBrutaAa());
        e.setRentabilidadeLiquidaAa(req.rentabilidadeLiquidaAa());
        e.setObservacao(req.observacao());
        e.setAtivo(true);
        return toRf(rendaFixaRepository.save(e));
    }

    @Transactional
    public void desativarRf(Long id) {
        RendaFixaEntity e = rendaFixaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Renda fixa não encontrada"));
        e.setAtivo(false);
        rendaFixaRepository.save(e);
    }

    // ---- Imóvel ----
    @Transactional(readOnly = true)
    public List<ImovelResponse> listarImoveis() {
        return imovelRepository.findByAtivoTrue().stream().map(this::toImovel).toList();
    }

    @Transactional
    public ImovelResponse salvarImovel(Long id, ImovelRequest req) {
        ImovelPatrimonioEntity e = id == null ? new ImovelPatrimonioEntity() : imovelRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Imóvel patrimonial não encontrado"));
        e.setIdentificacao(req.identificacao());
        e.setEndereco(req.endereco());
        e.setValorAquisicao(req.valorAquisicao());
        e.setDataAquisicao(req.dataAquisicao());
        e.setValorAtual(req.valorAtual());
        e.setSituacao(req.situacao() != null ? req.situacao() : "USO_PROPRIO");
        e.setAluguelMensal(req.aluguelMensal());
        e.setIndiceReajuste(req.indiceReajuste());
        e.setDataBaseReajuste(req.dataBaseReajuste());
        e.setVencimentoContrato(req.vencimentoContrato());
        e.setIptuMensal(req.iptuMensal());
        e.setCondominioMensal(req.condominioMensal());
        e.setSeguroMensal(req.seguroMensal());
        e.setManutencaoMensal(req.manutencaoMensal());
        e.setAdministracaoMensal(req.administracaoMensal());
        e.setVacanciaEstimada(req.vacanciaEstimada());
        e.setOrigemImovelId(req.origemImovelId());
        e.setPassivoId(req.passivoId());
        e.setObservacao(req.observacao());
        e.setAtivo(true);
        return toImovel(imovelRepository.save(e));
    }

    @Transactional
    public void desativarImovel(Long id) {
        ImovelPatrimonioEntity e = imovelRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Imóvel patrimonial não encontrado"));
        e.setAtivo(false);
        imovelRepository.save(e);
    }

    // ---- RV ----
    @Transactional(readOnly = true)
    public List<RvResponse> listarRv() {
        return ativoRvRepository.findByAtivoTrue().stream().map(this::toRv).toList();
    }

    @Transactional
    public RvResponse salvarRv(Long id, RvRequest req) {
        AtivoRvEntity e = id == null ? new AtivoRvEntity() : ativoRvRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ativo RV não encontrado"));
        e.setTicker(req.ticker().toUpperCase());
        e.setQuantidade(req.quantidade());
        e.setPrecoMedio(req.precoMedio());
        e.setPrecoAtual(req.precoAtual());
        e.setEstrategiaId(req.estrategiaId());
        e.setObservacao(req.observacao());
        e.setAtivo(true);
        return toRv(ativoRvRepository.save(e));
    }

    @Transactional
    public void desativarRv(Long id) {
        AtivoRvEntity e = ativoRvRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ativo RV não encontrado"));
        e.setAtivo(false);
        ativoRvRepository.save(e);
    }

    // ---- Veículo ----
    @Transactional(readOnly = true)
    public List<VeiculoResponse> listarVeiculos() {
        return veiculoRepository.findByAtivoTrue().stream().map(this::toVeiculo).toList();
    }

    @Transactional
    public VeiculoResponse salvarVeiculo(Long id, VeiculoRequest req) {
        VeiculoEntity e = id == null ? new VeiculoEntity() : veiculoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Veículo não encontrado"));
        e.setDescricao(req.descricao());
        e.setAno(req.ano());
        e.setPlaca(req.placa());
        e.setRenavam(req.renavam());
        e.setValorAtual(req.valorAtual());
        e.setPassivoId(req.passivoId());
        e.setAtivo(true);
        return toVeiculo(veiculoRepository.save(e));
    }

    @Transactional
    public void desativarVeiculo(Long id) {
        VeiculoEntity e = veiculoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Veículo não encontrado"));
        e.setAtivo(false);
        veiculoRepository.save(e);
    }

    // ---- Opções ----
    @Transactional(readOnly = true)
    public List<OpcaoResponse> listarOpcoes(String status) {
        List<OperacaoOpcaoEntity> lista = status != null
                ? opcaoRepository.findByStatus(status)
                : opcaoRepository.findAll();
        return lista.stream().map(this::toOpcao).toList();
    }

    @Transactional
    public OpcaoResponse salvarOpcao(Long id, OpcaoRequest req) {
        OperacaoOpcaoEntity e = id == null ? new OperacaoOpcaoEntity() : opcaoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Opção não encontrada"));
        e.setTickerAtivo(req.tickerAtivo().toUpperCase());
        e.setTickerOpcao(req.tickerOpcao());
        e.setTipo(req.tipo());
        e.setStrike(req.strike());
        e.setVencimento(req.vencimento());
        e.setQuantidade(req.quantidade() != null ? req.quantidade() : 1);
        e.setPremioEstimado(req.premioEstimado());
        e.setPremioRealizado(req.premioRealizado());
        e.setPremioPagoRecebido(req.premioPagoRecebido() != null ? req.premioPagoRecebido() : BigDecimal.ZERO);
        e.setMargemExigida(req.margemExigida() != null ? req.margemExigida() : BigDecimal.ZERO);
        e.setStatus(req.status() != null ? req.status() : "ABERTA");
        e.setEstrategiaId(req.estrategiaId());
        e.setDataAbertura(req.dataAbertura());
        e.setObservacao(req.observacao());
        return toOpcao(opcaoRepository.save(e));
    }

    private CaixaResponse toCaixa(CaixaEntity e) {
        return new CaixaResponse(e.getId(), e.getDescricao(), e.getInstituicao(), e.getValor(),
                Boolean.TRUE.equals(e.getVinculado()), e.getMotivoVinculo());
    }

    private RendaFixaResponse toRf(RendaFixaEntity e) {
        return new RendaFixaResponse(e.getId(), e.getInstrumento(), e.getInstituicao(), e.getValorAplicado(),
                e.getValorAtual(), e.getIndexador(), e.getTaxaContratada(), e.getVencimento(),
                e.getLiquidez(), Boolean.TRUE.equals(e.getReservaEmergencia()),
                e.getRentabilidadeBrutaAa(), e.getRentabilidadeLiquidaAa(), e.getObservacao());
    }

    private ImovelResponse toImovel(ImovelPatrimonioEntity e) {
        return new ImovelResponse(e.getId(), e.getIdentificacao(), e.getEndereco(), e.getValorAquisicao(),
                e.getDataAquisicao(), e.getValorAtual(), e.getSituacao(), e.getAluguelMensal(),
                PatrimonioConsolidacaoService.calcularCapRate(e),
                e.getOrigemImovelId(), e.getPassivoId(), e.getObservacao());
    }

    private RvResponse toRv(AtivoRvEntity e) {
        BigDecimal custo = e.getQuantidade().multiply(e.getPrecoMedio()).setScale(2, RoundingMode.HALF_UP);
        BigDecimal mercado = e.valorMercado();
        BigDecimal pnl = mercado.subtract(custo);
        BigDecimal pct = custo.compareTo(BigDecimal.ZERO) > 0
                ? pnl.multiply(new BigDecimal("100")).divide(custo, 4, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        return new RvResponse(e.getId(), e.getTicker(), e.getQuantidade(), e.getPrecoMedio(),
                e.getPrecoAtual(), mercado, pnl, pct, e.getEstrategiaId(), e.getObservacao());
    }

    private VeiculoResponse toVeiculo(VeiculoEntity e) {
        return new VeiculoResponse(e.getId(), e.getDescricao(), e.getAno(), e.getPlaca(),
                e.getRenavam(), e.getValorAtual(), e.getPassivoId());
    }

    private OpcaoResponse toOpcao(OperacaoOpcaoEntity e) {
        return new OpcaoResponse(e.getId(), e.getTickerAtivo(), e.getTickerOpcao(), e.getTipo(),
                e.getStrike(), e.getVencimento(), e.getQuantidade(), e.getPremioEstimado(),
                e.getPremioRealizado(), e.getPremioPagoRecebido(), e.getMargemExigida(),
                e.getStatus(), e.getEstrategiaId(), e.getDataAbertura(), e.getObservacao());
    }
}
