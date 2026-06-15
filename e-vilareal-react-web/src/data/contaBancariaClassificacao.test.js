import { describe, it, expect } from 'vitest';
import {
  buildClassificacaoContasPorNumero,
  classificacaoConta,
  contaTemExtrato,
  isContaManual,
  isContaVirtual,
  CONTA_CLASSIFICACAO_FALLBACK,
} from './contaBancariaClassificacao.js';

const RESPOSTA_ENDPOINT = [
  { numeroBanco: 1, bancoNome: 'Itaú', tipo: 'REAL', temExtrato: true, ativo: true },
  { numeroBanco: 9, bancoNome: 'LANÇ MANUAIS', tipo: 'MANUAL', temExtrato: false, ativo: true },
  { numeroBanco: 17, bancoNome: 'LANÇ EM DINHEIRO', tipo: 'MANUAL', temExtrato: false, ativo: true },
  { numeroBanco: 18, bancoNome: 'LANÇ MANUAIS (2)', tipo: 'MANUAL', temExtrato: false, ativo: true },
  { numeroBanco: 900, bancoNome: 'REPASSE INTERNO', tipo: 'VIRTUAL', temExtrato: false, ativo: true },
];

describe('buildClassificacaoContasPorNumero', () => {
  it('constrói o mapa a partir da resposta do endpoint', () => {
    const map = buildClassificacaoContasPorNumero(RESPOSTA_ENDPOINT);
    expect(map[1]).toMatchObject({ tipo: 'REAL', temExtrato: true });
    expect(map[9]).toMatchObject({ tipo: 'MANUAL', temExtrato: false });
    expect(map[900]).toMatchObject({ tipo: 'VIRTUAL', temExtrato: false });
  });

  it('usa o fallback hardcoded quando a resposta é vazia/ausente', () => {
    expect(buildClassificacaoContasPorNumero([])).toEqual(CONTA_CLASSIFICACAO_FALLBACK);
    expect(buildClassificacaoContasPorNumero(null)).toEqual(CONTA_CLASSIFICACAO_FALLBACK);
    expect(buildClassificacaoContasPorNumero(undefined)).toEqual(CONTA_CLASSIFICACAO_FALLBACK);
  });
});

describe('helpers de classificação — endpoint e fallback dão o mesmo resultado', () => {
  const doEndpoint = buildClassificacaoContasPorNumero(RESPOSTA_ENDPOINT);
  const semEndpoint = buildClassificacaoContasPorNumero([]); // fallback

  it('9/17/18 = MANUAL, sem extrato (idêntico ao hardcode antigo)', () => {
    for (const nb of [9, 17, 18]) {
      expect(isContaManual(nb, doEndpoint)).toBe(true);
      expect(contaTemExtrato(nb, doEndpoint)).toBe(false);
      // fallback deve coincidir para as contas conhecidas
      expect(isContaManual(nb, semEndpoint)).toBe(true);
      expect(contaTemExtrato(nb, semEndpoint)).toBe(false);
    }
  });

  it('900 = VIRTUAL, sem extrato', () => {
    expect(isContaVirtual(900, doEndpoint)).toBe(true);
    expect(contaTemExtrato(900, doEndpoint)).toBe(false);
    expect(isContaVirtual(900, semEndpoint)).toBe(true);
  });

  it('conta real = REAL, com extrato; desconhecida usa default REAL/extrato', () => {
    expect(isContaManual(1, doEndpoint)).toBe(false);
    expect(contaTemExtrato(1, doEndpoint)).toBe(true);

    // banco não cadastrado (ex.: BTG/21, sem lançamentos): default REAL/com extrato.
    expect(classificacaoConta(21, doEndpoint)).toMatchObject({ tipo: 'REAL', temExtrato: true });
    expect(contaTemExtrato(21, doEndpoint)).toBe(true);
    expect(isContaManual(21, doEndpoint)).toBe(false);
  });

  it('numero inválido → default REAL/com extrato (não quebra)', () => {
    expect(classificacaoConta(null, doEndpoint)).toMatchObject({ tipo: 'REAL', temExtrato: true });
    expect(classificacaoConta(undefined, semEndpoint)).toMatchObject({ tipo: 'REAL' });
  });
});
