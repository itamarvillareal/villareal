package br.com.vilareal.imovel.application;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelProcessoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelProcessoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.LocacaoRepasseLancamentoRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Resolve lançamentos financeiros ligados a um imóvel (nº planilha col. A):
 * {@code grupo_compensacao}, processos vinculados, repasses de locação e prefixo Cod.+Proc. na Obs.
 */
@Service
public class ImovelLancamentoFiltroResolver {

    private final ImovelRepository imovelRepository;
    private final ImovelProcessoRepository imovelProcessoRepository;
    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final LocacaoRepasseLancamentoRepository repasseLancamentoRepository;
    private final ImovelApplicationService imovelApplicationService;

    public ImovelLancamentoFiltroResolver(
            ImovelRepository imovelRepository,
            ImovelProcessoRepository imovelProcessoRepository,
            ContratoLocacaoRepository contratoLocacaoRepository,
            LocacaoRepasseLancamentoRepository repasseLancamentoRepository,
            ImovelApplicationService imovelApplicationService) {
        this.imovelRepository = imovelRepository;
        this.imovelProcessoRepository = imovelProcessoRepository;
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.repasseLancamentoRepository = repasseLancamentoRepository;
        this.imovelApplicationService = imovelApplicationService;
    }

    @Transactional(readOnly = true)
    public ImovelLancamentoFiltroCriteria resolver(int numeroPlanilha) {
        if (numeroPlanilha < 1 || numeroPlanilha > 999) {
            return new ImovelLancamentoFiltroCriteria("", Set.of(), Set.of(), List.of());
        }
        String np = String.valueOf(numeroPlanilha);
        Set<Long> processoIds = new HashSet<>();
        Set<Long> lancamentoIds = new HashSet<>();
        Set<String> obsPrefixos = new LinkedHashSet<>();

        List<ImovelEntity> imoveis = imovelRepository.findAllPorNumeroPlanilhaLegado(numeroPlanilha);
        for (ImovelEntity im : imoveis) {
            if (im.getProcesso() != null && im.getProcesso().getId() != null) {
                processoIds.add(im.getProcesso().getId());
            }
            if (im.getId() != null) {
                for (ImovelProcessoEntity ip : imovelProcessoRepository.findByImovel_IdOrderByCreatedAtDescIdDesc(im.getId())) {
                    if (ip.getProcesso() != null && ip.getProcesso().getId() != null) {
                        processoIds.add(ip.getProcesso().getId());
                    }
                }
                for (ContratoLocacaoEntity cl : contratoLocacaoRepository.findByImovel_IdOrderByDataInicioDescIdDesc(im.getId())) {
                    if (cl.getProcesso() != null && cl.getProcesso().getId() != null) {
                        processoIds.add(cl.getProcesso().getId());
                    }
                }
            }
            String marcadorUnidade = montarMarcadorUnidadeCondominio(im);
            if (marcadorUnidade != null) {
                obsPrefixos.add(marcadorUnidade);
            }
        }

        lancamentoIds.addAll(repasseLancamentoRepository.findLancamentoFinanceiroIdsByImovelNumeroPlanilha(numeroPlanilha));

        var vinculos = imovelApplicationService.listarVinculosProcessoPorNumeroPlanilha(numeroPlanilha);
        if (vinculos.getVinculos() != null) {
            for (var v : vinculos.getVinculos()) {
                if (v.getProcessoId() != null) {
                    processoIds.add(v.getProcessoId());
                }
                String prefixo = montarPrefixoObsCodProc(v.getCodigoCliente(), v.getNumeroInterno());
                if (prefixo != null) {
                    obsPrefixos.add(prefixo);
                    obsPrefixos.add(prefixo + " -");
                }
            }
        }

        return new ImovelLancamentoFiltroCriteria(np, processoIds, lancamentoIds, new ArrayList<>(obsPrefixos));
    }

    static String montarPrefixoObsCodProc(String codigoCliente, Integer numeroInterno) {
        if (!StringUtils.hasText(codigoCliente) || numeroInterno == null || numeroInterno < 1) {
            return null;
        }
        try {
            long codNum = CodigoClienteUtil.parsePessoaId(codigoCliente);
            return String.valueOf(codNum) + numeroInterno;
        } catch (RuntimeException ignored) {
            String digits = codigoCliente.trim().replaceFirst("^0+", "");
            if (digits.isEmpty()) {
                return null;
            }
            return digits + numeroInterno;
        }
    }

    static String montarMarcadorUnidadeCondominio(ImovelEntity im) {
        String unidade = StringUtils.trimWhitespace(im.getUnidade());
        String cond = StringUtils.trimWhitespace(im.getCondominio());
        if (!StringUtils.hasText(unidade) || !StringUtils.hasText(cond)) {
            return null;
        }
        return (unidade + " " + cond).trim();
    }
}
