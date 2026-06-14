package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class RecorrenciaDetectadaResponse {

    private String descricaoNorm;
    private String descricaoExemplo;
    /** Data do lançamento usado como {@link #descricaoExemplo} (mais recente do padrão). */
    private LocalDate dataExemplo;
    private Integer numeroBanco;
    private String bancoNome;
    private BigDecimal valorTipico;
    private Long contaContabilId;
    private String contaCodigo;
    private String contaNome;
    private Long clienteId;
    private String clienteNome;
    private Long processoId;
    private String processoNumero;
    private String parteCliente;
    private String parteOposta;
    private long ocorrenciasHistorico;
    private long mesesCobertos;
    private double consistenciaConta;
    private Double consistenciaVinculo;
    private ConfiancaSugestao confianca;
    private long qtdPendentes;
    private long qtdParaCompletar;
    private boolean valorFixo;
    private BigDecimal valorModal;
    private double dispersao;
    private long qtdPendentesExato;
    private long qtdPendentesAprox;
    private long qtdCompletarExato;
    private long qtdCompletarAprox;
    /** Total acionável na precisão do filtro ativo (exato, exato+aprox ou só nome). */
    private long qtdAcionaveis;
    private long qtdDivergentes;
}
