import { describe, expect, it } from 'vitest';
import {
  ehFaseTxtInativo,
  ehStatusProcessoInativo,
  normalizarTextoFaseTxt,
  parseNomeArquivoFase21_1,
  parseNomeArquivoObservacao146_1,
  parseNomeArquivoStatusProcesso,
  resolverAtivoFromStatusProcessoTxt,
} from './gerais-fase-processo-txt.mjs';
import { montarPatchStatusProcesso } from './sincronizar-status-processo-import-real.mjs';

describe('parseNomeArquivoFase21_1', () => {
  it('extrai cod8 e proc entre 3.º e 4.º ponto', () => {
    expect(parseNomeArquivoFase21_1('00000001.21.1.03.0001.txt')).toEqual({
      cod8: '00000001',
      codNum: 1,
      numeroInterno: 3,
    });
    expect(parseNomeArquivoFase21_1('00000354.21.1.08.0001.txt')?.numeroInterno).toBe(8);
  });
});

describe('parseNomeArquivoObservacao146_1', () => {
  it('extrai cod8 e proc do 146.1', () => {
    expect(parseNomeArquivoObservacao146_1('00000001.146.1.03.txt')).toEqual({
      cod8: '00000001',
      codNum: 1,
      numeroInterno: 3,
    });
    expect(parseNomeArquivoObservacao146_1('00000728.146.1.1469.txt')?.numeroInterno).toBe(1469);
  });
});

describe('parseNomeArquivoStatusProcesso', () => {
  it('extrai cod8 e proc do padrão VBA Status.Processo', () => {
    expect(parseNomeArquivoStatusProcesso('00000001.Status.Processo03.Processos.txt')).toEqual({
      cod8: '00000001',
      codNum: 1,
      numeroInterno: 3,
    });
    expect(parseNomeArquivoStatusProcesso('00000728.Status.Processo1469.Processos.txt')?.numeroInterno).toBe(
      1469
    );
    expect(parseNomeArquivoStatusProcesso('00000001.146.1.03.txt')).toBeNull();
    expect(parseNomeArquivoStatusProcesso('00000001.Status.Processo3.Processos.txt')).toBeNull();
  });
});

describe('ehStatusProcessoInativo', () => {
  it('reconhece INATIVO no txt de status', () => {
    expect(ehStatusProcessoInativo('INATIVO')).toBe(true);
    expect(ehStatusProcessoInativo('ATIVO')).toBe(false);
  });
});

describe('resolverAtivoFromStatusProcessoTxt', () => {
  it('INATIVO → ativo false; resto → ativo true', () => {
    expect(resolverAtivoFromStatusProcessoTxt('INATIVO').ativo).toBe(false);
    expect(resolverAtivoFromStatusProcessoTxt('INATIVO').statusInativo).toBe(true);
    expect(resolverAtivoFromStatusProcessoTxt('ATIVO').ativo).toBe(true);
    expect(resolverAtivoFromStatusProcessoTxt('').ativo).toBe(true);
    expect(resolverAtivoFromStatusProcessoTxt(null, { temArquivo: false }).ativo).toBe(true);
  });
});

describe('montarPatchStatusProcesso', () => {
  it('limpa fase e obs quando inativo', () => {
    const p = montarPatchStatusProcesso(resolverAtivoFromStatusProcessoTxt('INATIVO'));
    expect(p.ativo).toBe(false);
    expect(p.observacaoFase).toBeNull();
    expect(p.fase).toBeNull();
  });
  it('mantém ativo sem limpar fase', () => {
    const p = montarPatchStatusProcesso(resolverAtivoFromStatusProcessoTxt('ATIVO'));
    expect(p.ativo).toBe(true);
    expect(p).not.toHaveProperty('observacaoFase');
  });
});

describe('ehFaseTxtInativo', () => {
  it('ignora INATIVO', () => {
    expect(ehFaseTxtInativo('INATIVO')).toBe(true);
    expect(ehFaseTxtInativo('inativo')).toBe(true);
    expect(ehFaseTxtInativo('EM_ANDAMENTO')).toBe(false);
  });
});

describe('normalizarTextoFaseTxt', () => {
  it('marca INATIVO como ignorado', () => {
    expect(normalizarTextoFaseTxt('INATIVO').aviso).toBe('inativo_ignorado');
    expect(normalizarTextoFaseTxt('INATIVO').faseCanonica).toBeNull();
  });

  it('reconhece EM_ANDAMENTO e abreviaturas', () => {
    expect(normalizarTextoFaseTxt('EM_ANDAMENTO').faseCanonica).toBe('Em Andamento');
    expect(normalizarTextoFaseTxt('PET').faseCanonica).toBe('Ag. Peticionar');
    expect(normalizarTextoFaseTxt('VERIFIC').faseCanonica).toBe('Ag. Verificação');
    expect(normalizarTextoFaseTxt('AGUAR.PROVID.').faseCanonica).toBe('Aguardando Providência');
  });
});
