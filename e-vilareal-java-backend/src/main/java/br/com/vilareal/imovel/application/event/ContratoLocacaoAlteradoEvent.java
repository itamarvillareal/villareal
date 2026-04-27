package br.com.vilareal.imovel.application.event;

/** Fired when a lease contract is created or updated (IPTU recalc after commit). */
public record ContratoLocacaoAlteradoEvent(Long contratoId) {}
