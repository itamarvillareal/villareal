package br.com.vilareal.financeiro.api.dto;

import java.time.LocalDate;

/** Contexto leve para preview/importação OFX (sem carregar dezenas de milhares de lançamentos no browser). */
public class ExtratoImportacaoContextoResponse {

    private Integer numeroBanco;
    private long totalNoBanco;
    /** Penúltima data distinta já importada (mesclagem aceita linhas >= dataCorte). */
    private LocalDate dataCorte;

    public Integer getNumeroBanco() {
        return numeroBanco;
    }

    public void setNumeroBanco(Integer numeroBanco) {
        this.numeroBanco = numeroBanco;
    }

    public long getTotalNoBanco() {
        return totalNoBanco;
    }

    public void setTotalNoBanco(long totalNoBanco) {
        this.totalNoBanco = totalNoBanco;
    }

    public LocalDate getDataCorte() {
        return dataCorte;
    }

    public void setDataCorte(LocalDate dataCorte) {
        this.dataCorte = dataCorte;
    }
}
