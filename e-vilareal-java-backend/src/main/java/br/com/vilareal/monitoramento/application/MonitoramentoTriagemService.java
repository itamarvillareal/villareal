package br.com.vilareal.monitoramento.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.monitoramento.api.dto.ProcessoDescobertoResponse;
import br.com.vilareal.monitoramento.domain.SituacaoProcessoDescoberto;
import br.com.vilareal.monitoramento.infrastructure.persistence.entity.ProcessoDescobertoEntity;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.ProcessoDescobertoRepository;
import br.com.vilareal.projudi.ProjudiBuscaParteService;
import br.com.vilareal.projudi.ProjudiBuscaParteService.DetalheProcesso;
import br.com.vilareal.projudi.ProjudiBuscaParteService.LinhaLista;
import br.com.vilareal.projudi.ProjudiBuscaParteService.PaginaLista;
import br.com.vilareal.projudi.ProjudiOrquestradorGate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Ações de triagem da tela de monitoramento (Parte 5, Bloco B): ignorar e enriquecer.
 *
 * <p><b>Enriquecer:</b> a lista da busca não traz CNJ/classe/serventia — só o detalhe traz. O
 * token {@code Id_Processo} gravado na varredura é de SESSÃO e já expirou; por isso o
 * enriquecimento refaz a busca por CPF da pessoa, reencontra a linha por
 * (numero_reduzido, ano) e abre o detalhe com o token FRESCO, tudo numa única posse do
 * {@link ProjudiOrquestradorGate} (a paginação navega sobre resultado guardado na sessão).
 * Abrir o detalhe não registra ciência (verificado no spike); o painel de intimações não é
 * tocado.</p>
 */
@Service
public class MonitoramentoTriagemService {

    private static final Logger log = LoggerFactory.getLogger(MonitoramentoTriagemService.class);

    private final ProcessoDescobertoRepository descobertoRepository;
    private final ProjudiBuscaParteService buscaParteService;
    private final ProjudiOrquestradorGate gate;
    private final Long credencialId;

    public MonitoramentoTriagemService(
            ProcessoDescobertoRepository descobertoRepository,
            ProjudiBuscaParteService buscaParteService,
            ProjudiOrquestradorGate gate,
            @Value("${vilareal.projudi.varredura.credencial-id:${projudi.orquestrador.credencial-id-padrao:1}}")
                    Long credencialId) {
        this.descobertoRepository = descobertoRepository;
        this.buscaParteService = buscaParteService;
        this.gate = gate;
        this.credencialId = credencialId;
    }

    /** Marca o descoberto como IGNORADO (persistente; reversível só por nova triagem manual). */
    public ProcessoDescobertoResponse ignorar(Long descobertoId) {
        ProcessoDescobertoEntity d = carregar(descobertoId);
        d.setSituacao(SituacaoProcessoDescoberto.IGNORADO);
        descobertoRepository.save(d);
        log.info("Monitoramento: descoberto {} ({}-{}) marcado IGNORADO.",
                d.getId(), d.getNumeroReduzido(), d.getAnoDistribuicao());
        return ProcessoDescobertoResponse.de(d);
    }

    /**
     * Colhe numero_cnj/classe/serventia abrindo o detalhe no PROJUDI. Idempotente: se os três
     * campos já estão preenchidos, retorna sem ir ao tribunal.
     */
    public ProcessoDescobertoResponse enriquecer(Long descobertoId) {
        ProcessoDescobertoEntity d = carregar(descobertoId);
        if (d.getNumeroCnj() != null && d.getClasse() != null && d.getServentia() != null) {
            return ProcessoDescobertoResponse.de(d);
        }
        if (d.getNumeroReduzido() == null || d.getAnoDistribuicao() == null) {
            throw new BusinessRuleException("Descoberto sem número reduzido/ano — não é enriquecível.");
        }
        String cpfCnpj = d.getPessoa().getCpf();
        if (cpfCnpj == null || cpfCnpj.isBlank()) {
            throw new BusinessRuleException("Pessoa " + d.getPessoa().getId() + " sem CPF/CNPJ.");
        }

        Optional<DetalheProcesso> detalhe = gate.tryExecutarComRetorno(
                "monitoramento/enriquecer",
                () -> localizarEAbrirDetalhe(cpfCnpj, d.getNumeroReduzido(), d.getAnoDistribuicao(),
                        d.getDataDistribuicao()));
        if (detalhe.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Robô PROJUDI ocupado no momento — tente novamente em instantes.");
        }

        d.setNumeroCnj(detalhe.get().numeroCnj());
        d.setClasse(detalhe.get().classe());
        d.setServentia(detalhe.get().serventia());
        descobertoRepository.save(d);
        log.info("Monitoramento: descoberto {} enriquecido (cnj={}, classe={}, serventia={}).",
                d.getId(), d.getNumeroCnj(), d.getClasse(), d.getServentia());
        return ProcessoDescobertoResponse.de(d);
    }

    /**
     * Sob o gate: POST da busca, varre da ÚLTIMA página para trás até reencontrar a linha
     * (os alvos típicos — NOVOS — estão nas últimas páginas). Como a lista é ordenada por
     * distribuição CRESCENTE, ao alcançar uma página cujo item mais novo é anterior à data
     * do alvo, a linha não existe mais na lista — erro claro, sem varrer o resto.
     */
    private DetalheProcesso localizarEAbrirDetalhe(
            String cpfCnpj, String numeroReduzido, int ano, LocalDateTime dataAlvo) {
        PaginaLista primeira = buscaParteService.primeiraPagina(credencialId, cpfCnpj);
        int ultima = primeira.posicaoUltimaPagina();

        for (int pos = ultima; pos >= 0; pos--) {
            PaginaLista pagina = pos == 0 ? primeira : buscaParteService.paginaEm(credencialId, pos);
            LocalDateTime maisNovaDaPagina = null;
            for (LinhaLista linha : pagina.linhas()) {
                if (linha.segredo()) {
                    continue;
                }
                if (linha.dataDistribuicao() != null
                        && (maisNovaDaPagina == null || linha.dataDistribuicao().isAfter(maisNovaDaPagina))) {
                    maisNovaDaPagina = linha.dataDistribuicao();
                }
                boolean mesmoNumero = numeroReduzido.equals(linha.numeroReduzido());
                boolean mesmoAno = linha.dataDistribuicao() != null
                        && linha.dataDistribuicao().getYear() == ano;
                if (mesmoNumero && mesmoAno) {
                    // Token FRESCO desta sessão. Detalhe só APÓS terminar a navegação da lista
                    // (o GET do detalhe substitui o estado de busca da sessão).
                    return buscaParteService.abrirDetalhe(credencialId, linha.idProcessoToken());
                }
            }
            if (dataAlvo != null && maisNovaDaPagina != null && maisNovaDaPagina.isBefore(dataAlvo)) {
                break;
            }
        }
        throw new BusinessRuleException("Processo " + numeroReduzido + "/" + ano
                + " não localizado no PROJUDI atual (saiu da lista da busca por CPF/CNPJ).");
    }

    private ProcessoDescobertoEntity carregar(Long descobertoId) {
        return descobertoRepository.findByIdComPessoa(descobertoId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Processo descoberto não encontrado: " + descobertoId));
    }
}
