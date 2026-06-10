import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  deduplicarUnidadesCalculos,
  normalizarUnidadeTxt,
  parseNomeArquivoUnidadeCalculos,
  resolverBaseCalculosUnidade,
} from './unidade-calculos-dropbox.mjs';

describe('unidade-calculos-dropbox', () => {
  it('parseNomeArquivoUnidadeCalculos extrai cliente e proc', () => {
    const p = parseNomeArquivoUnidadeCalculos('00000299.0.88.1.12.txt');
    assert.ok(p);
    assert.equal(p.cod8, '00000299');
    assert.equal(p.codNum, 299);
    assert.equal(p.numeroInterno, 12);
    assert.equal(p.tipoMeio, '0.88.1');
  });

  it('parseNomeArquivoUnidadeCalculos rejeita sem 0.88.', () => {
    assert.equal(parseNomeArquivoUnidadeCalculos('00000299.7.1.12.txt'), null);
  });

  it('normalizarUnidadeTxt trunca a 32 caracteres', () => {
    const longo = 'A'.repeat(40);
    assert.equal(normalizarUnidadeTxt(longo)?.length, 32);
    assert.equal(normalizarUnidadeTxt('  Unidade 602 R  '), 'Unidade 602 R');
    assert.equal(normalizarUnidadeTxt(''), null);
  });

  it('deduplicarUnidadesCalculos prefere 0.88.1', () => {
    const brutos = [
      {
        cod8: '00000299',
        codNum: 299,
        numeroInterno: 12,
        unidade: 'B',
        tipoMeio: '0.88.2',
        arquivo: '/a',
        relPath: 'a',
        milhar: '1000',
        centena: '200',
        pastaCliente: '299',
      },
      {
        cod8: '00000299',
        codNum: 299,
        numeroInterno: 12,
        unidade: 'Unidade 602 R',
        tipoMeio: '0.88.1',
        arquivo: '/b',
        relPath: 'b',
        milhar: '1000',
        centena: '200',
        pastaCliente: '299',
      },
    ];
    const unicos = deduplicarUnidadesCalculos(brutos);
    assert.equal(unicos.length, 1);
    assert.equal(unicos[0].unidade, 'Unidade 602 R');
  });

  it('resolverBaseCalculosUnidade aceita raiz Banco de Dados', () => {
    const base = resolverBaseCalculosUnidade('/tmp/Banco de Dados');
    assert.equal(base, path.join('/tmp', 'Banco de Dados', 'Calculos'));
  });
});
