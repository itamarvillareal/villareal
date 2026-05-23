import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarTramitacaoTxt,
  parseNomeArquivoTramitacao147_1,
  TRAMITACAO_OPCOES_CANONICAS,
} from './gerais-tramitacao-147-1.mjs';

describe('parseNomeArquivoTramitacao147_1', () => {
  it('extrai cod8 e proc do 147.1', () => {
    assert.deepEqual(parseNomeArquivoTramitacao147_1('00000728.147.1.239.txt'), {
      cod8: '00000728',
      codNum: 728,
      numeroInterno: 239,
    });
    assert.equal(parseNomeArquivoTramitacao147_1('00000001.147.1.03.txt')?.numeroInterno, 3);
    assert.equal(parseNomeArquivoTramitacao147_1('00000001.146.1.03.txt'), null);
  });
});

describe('normalizarTramitacaoTxt', () => {
  it('mapeia valores legados VBA para opções da UI', () => {
    assert.deepEqual(normalizarTramitacaoTxt('PROJUDI'), {
      tramitacao: 'Projudi',
      aviso: 'legado_projudi',
    });
    assert.deepEqual(normalizarTramitacaoTxt('PjE'), {
      tramitacao: 'PJe',
      aviso: 'legado_pje',
    });
    assert.deepEqual(normalizarTramitacaoTxt('TJ Go - Autos Físicos'), {
      tramitacao: 'TJ Go - Autos Físicos',
      aviso: null,
    });
  });

  it('aceita valores já canónicos', () => {
    for (const op of TRAMITACAO_OPCOES_CANONICAS) {
      assert.equal(normalizarTramitacaoTxt(op).tramitacao, op);
      assert.equal(normalizarTramitacaoTxt(op).aviso, null);
    }
  });

  it('retorna vazio para linha em branco', () => {
    assert.equal(normalizarTramitacaoTxt('   ').tramitacao, null);
  });
});
