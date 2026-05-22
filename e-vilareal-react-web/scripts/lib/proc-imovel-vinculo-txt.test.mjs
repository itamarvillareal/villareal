import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseNomeArquivoImovelVinculo0891,
  parseNumeroPlanilhaImovelTxt,
  resolverBaseProc,
  validarRaizProc,
  PASTA_PROC,
} from './proc-imovel-vinculo-txt.mjs';

describe('parseNomeArquivoImovelVinculo0891', () => {
  it('extrai cod8 e proc entre 4.º e 5.º ponto', () => {
    expect(parseNomeArquivoImovelVinculo0891('00000149.0.89.1.127.txt')).toEqual({
      cod8: '00000149',
      codNum: 149,
      numeroInterno: 127,
    });
    expect(parseNomeArquivoImovelVinculo0891('00000909.0.89.1.01.txt')?.numeroInterno).toBe(1);
    expect(parseNomeArquivoImovelVinculo0891('00002932.0.89.1.1195.txt')?.numeroInterno).toBe(1195);
  });

  it('rejeita outros tipos', () => {
    expect(parseNomeArquivoImovelVinculo0891('00000149.21.1.127.txt')).toBeNull();
    expect(parseNomeArquivoImovelVinculo0891('00003247.87.1.01.txt')).toBeNull();
    expect(parseNomeArquivoImovelVinculo0891('00000149.0.89.1.127.0001.txt')).toBeNull();
  });
});

describe('validarRaizProc', () => {
  it('normaliza raiz Banco de Dados para subpasta Proc', () => {
    const banco = '/tmp/Banco de Dados';
    expect(validarRaizProc(banco)).toBe(path.join(banco, PASTA_PROC));
  });

  it('aceita caminho que já termina em Proc', () => {
    const proc = '/tmp/Banco de Dados/Proc';
    expect(validarRaizProc(proc)).toBe(proc);
  });

  it('resolverBaseProc sem argumento termina em Proc', () => {
    expect(resolverBaseProc().endsWith(`${path.sep}Proc`)).toBe(true);
  });
});

describe('parseNumeroPlanilhaImovelTxt', () => {
  it('lê número da planilha na linha', () => {
    expect(parseNumeroPlanilhaImovelTxt('43')).toEqual({
      numeroPlanilha: 43,
      aviso: null,
    });
    expect(parseNumeroPlanilhaImovelTxt('  128  ').numeroPlanilha).toBe(128);
  });

  it('marca vazio ou inválido', () => {
    expect(parseNumeroPlanilhaImovelTxt('').aviso).toBe('vazio');
    expect(parseNumeroPlanilhaImovelTxt('abc').aviso).toMatch(/^nao_numerico/);
    expect(parseNumeroPlanilhaImovelTxt('401.309.0151.001').aviso).toMatch(/^formato_pontuado/);
  });
});
