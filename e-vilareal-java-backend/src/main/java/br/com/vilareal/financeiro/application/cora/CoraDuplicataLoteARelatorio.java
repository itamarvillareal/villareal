package br.com.vilareal.financeiro.application.cora;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class CoraDuplicataLoteARelatorio {

    private boolean dryRun;
    private boolean abortado;
    private String motivoAbort;
    private int paresNoMapa;
    private int vinculosRepasseMigrados;
    private int pagamentosMigrados;
    private int classificacoesCopiadas;
    private int gruposCompensacaoTocados;
    private int descartesSemelhanteRecriados;
    private int descartesCompensacaoRecriados;
    private int planilhasAposentadas;
    private int conciliarJunAntesDoisCandidatos;
    private int conciliarJunDepoisUmCandidato;
    private BigDecimal saldoCoraAntes;
    private BigDecimal saldoCoraProjetado;
    private long extratoCoraAtivosAntes;
    private long extratoCoraAtivosProjetado;
    private final List<CoraDuplicataPar> exemplosPares = new ArrayList<>();
    private final List<CoraDuplicataMigracaoAuditoriaLinha> auditoria = new ArrayList<>();
    private final List<String> gruposCompensacaoValidados = new ArrayList<>();
    private final List<String> conflitos = new ArrayList<>();
    private java.nio.file.Path arquivoAuditoria;

    public boolean isDryRun() {
        return dryRun;
    }

    public void setDryRun(boolean dryRun) {
        this.dryRun = dryRun;
    }

    public boolean isAbortado() {
        return abortado;
    }

    public void setAbortado(boolean abortado) {
        this.abortado = abortado;
    }

    public String getMotivoAbort() {
        return motivoAbort;
    }

    public void setMotivoAbort(String motivoAbort) {
        this.motivoAbort = motivoAbort;
    }

    public int getParesNoMapa() {
        return paresNoMapa;
    }

    public void setParesNoMapa(int paresNoMapa) {
        this.paresNoMapa = paresNoMapa;
    }

    public int getVinculosRepasseMigrados() {
        return vinculosRepasseMigrados;
    }

    public void setVinculosRepasseMigrados(int vinculosRepasseMigrados) {
        this.vinculosRepasseMigrados = vinculosRepasseMigrados;
    }

    public int getPagamentosMigrados() {
        return pagamentosMigrados;
    }

    public void setPagamentosMigrados(int pagamentosMigrados) {
        this.pagamentosMigrados = pagamentosMigrados;
    }

    public int getClassificacoesCopiadas() {
        return classificacoesCopiadas;
    }

    public void setClassificacoesCopiadas(int classificacoesCopiadas) {
        this.classificacoesCopiadas = classificacoesCopiadas;
    }

    public int getGruposCompensacaoTocados() {
        return gruposCompensacaoTocados;
    }

    public void setGruposCompensacaoTocados(int gruposCompensacaoTocados) {
        this.gruposCompensacaoTocados = gruposCompensacaoTocados;
    }

    public int getDescartesSemelhanteRecriados() {
        return descartesSemelhanteRecriados;
    }

    public void setDescartesSemelhanteRecriados(int descartesSemelhanteRecriados) {
        this.descartesSemelhanteRecriados = descartesSemelhanteRecriados;
    }

    public int getDescartesCompensacaoRecriados() {
        return descartesCompensacaoRecriados;
    }

    public void setDescartesCompensacaoRecriados(int descartesCompensacaoRecriados) {
        this.descartesCompensacaoRecriados = descartesCompensacaoRecriados;
    }

    public int getPlanilhasAposentadas() {
        return planilhasAposentadas;
    }

    public void setPlanilhasAposentadas(int planilhasAposentadas) {
        this.planilhasAposentadas = planilhasAposentadas;
    }

    public int getConciliarJunAntesDoisCandidatos() {
        return conciliarJunAntesDoisCandidatos;
    }

    public void setConciliarJunAntesDoisCandidatos(int conciliarJunAntesDoisCandidatos) {
        this.conciliarJunAntesDoisCandidatos = conciliarJunAntesDoisCandidatos;
    }

    public int getConciliarJunDepoisUmCandidato() {
        return conciliarJunDepoisUmCandidato;
    }

    public void setConciliarJunDepoisUmCandidato(int conciliarJunDepoisUmCandidato) {
        this.conciliarJunDepoisUmCandidato = conciliarJunDepoisUmCandidato;
    }

    public BigDecimal getSaldoCoraAntes() {
        return saldoCoraAntes;
    }

    public void setSaldoCoraAntes(BigDecimal saldoCoraAntes) {
        this.saldoCoraAntes = saldoCoraAntes;
    }

    public BigDecimal getSaldoCoraProjetado() {
        return saldoCoraProjetado;
    }

    public void setSaldoCoraProjetado(BigDecimal saldoCoraProjetado) {
        this.saldoCoraProjetado = saldoCoraProjetado;
    }

    public long getExtratoCoraAtivosAntes() {
        return extratoCoraAtivosAntes;
    }

    public void setExtratoCoraAtivosAntes(long extratoCoraAtivosAntes) {
        this.extratoCoraAtivosAntes = extratoCoraAtivosAntes;
    }

    public long getExtratoCoraAtivosProjetado() {
        return extratoCoraAtivosProjetado;
    }

    public void setExtratoCoraAtivosProjetado(long extratoCoraAtivosProjetado) {
        this.extratoCoraAtivosProjetado = extratoCoraAtivosProjetado;
    }

    public List<CoraDuplicataPar> getExemplosPares() {
        return exemplosPares;
    }

    public List<CoraDuplicataMigracaoAuditoriaLinha> getAuditoria() {
        return auditoria;
    }

    public List<String> getGruposCompensacaoValidados() {
        return gruposCompensacaoValidados;
    }

    public List<String> getConflitos() {
        return conflitos;
    }

    public java.nio.file.Path getArquivoAuditoria() {
        return arquivoAuditoria;
    }

    public void setArquivoAuditoria(java.nio.file.Path arquivoAuditoria) {
        this.arquivoAuditoria = arquivoAuditoria;
    }
}
