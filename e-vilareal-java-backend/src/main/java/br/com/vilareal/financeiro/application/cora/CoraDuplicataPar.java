package br.com.vilareal.financeiro.application.cora;

/** Par canônico PLANILHA (aposentar) → OFX (manter). */
public record CoraDuplicataPar(long planilhaId, long ofxId) {}
