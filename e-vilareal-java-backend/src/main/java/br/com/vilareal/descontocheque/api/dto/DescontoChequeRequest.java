package br.com.vilareal.descontocheque.api.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class DescontoChequeRequest {

    @Size(max = 255)
    private String descricao;

    @NotNull(message = "O valor de face é obrigatório.")
    @DecimalMin(value = "0.01", message = "O valor de face deve ser maior que zero.")
    private BigDecimal valorFace;

    /** Default = hoje quando não informado (aplicado no service). */
    private LocalDate dataBase;

    @NotNull(message = "A data de depósito/vencimento é obrigatória.")
    private LocalDate dataDeposito;

    @NotNull(message = "A taxa mensal é obrigatória.")
    @DecimalMin(value = "0.0", inclusive = true, message = "A taxa mensal não pode ser negativa.")
    private BigDecimal taxaMensalPercentual;

    /**
     * Regra de datas: dataDeposito tem de ser posterior à dataBase (dias &gt;= 1).
     * Bean validation (→ HTTP 400). Quando dataBase é nula, usa-se hoje (mesmo default do service).
     * Nulos em dataDeposito ficam a cargo do {@code @NotNull} para não duplicar mensagem.
     */
    @JsonIgnore
    @AssertTrue(message = "A data de depósito/vencimento deve ser posterior à data base.")
    public boolean isDatasCoerentes() {
        if (dataDeposito == null) {
            return true;
        }
        LocalDate base = dataBase != null ? dataBase : LocalDate.now();
        return dataDeposito.isAfter(base);
    }
}
