import assert from 'node:assert/strict';

import {
  analisarCorrecoesPartesRequerido,
  normalizarPoloApi,
} from './corrigir-partes-requerido-txt.mjs';
import {
  POLO_PROCESSO_PARTE_CLIENTE,
  POLO_PROCESSO_PARTE_OPOSTA,
} from './legado-pessoa-cliente-vs-partes-processo.mjs';

function parteTxt(ladoVba, ordem, pessoaId) {
  return { ordem, ladoVba, pessoaId, enderecoRef: null, fontes: [] };
}

function parteApi(polo, ordem, pessoaId, id) {
  return { id, polo, ordem, pessoaId, nomeLivre: null, qualificacao: null };
}

function testJaCorreto() {
  const txt = [parteTxt(POLO_PROCESSO_PARTE_CLIENTE, 1, 1440)];
  const api = [parteApi('REU', 1, 1440, 10)];
  const { correcoes, ok } = analisarCorrecoesPartesRequerido(txt, api);
  assert.equal(ok, 1);
  assert.equal(correcoes.length, 0);
}

function testInvertido() {
  const txt = [
    parteTxt(POLO_PROCESSO_PARTE_CLIENTE, 1, 1440),
    parteTxt(POLO_PROCESSO_PARTE_OPOSTA, 1, 7133),
  ];
  const api = [
    parteApi('AUTOR', 1, 1440, 11),
    parteApi('REU', 1, 7133, 12),
  ];
  const { correcoes } = analisarCorrecoesPartesRequerido(txt, api);
  assert.equal(correcoes.length, 2);
  assert.equal(correcoes[0].tipo, 'inverter');
  assert.equal(correcoes[0].poloErrado, 'AUTOR');
  assert.equal(correcoes[0].poloEsperado, 'REU');
  assert.equal(correcoes[1].poloEsperado, 'AUTOR');
}

function testDuplicado() {
  const txt = [parteTxt(POLO_PROCESSO_PARTE_CLIENTE, 1, 1440)];
  const api = [
    parteApi('REU', 1, 1440, 20),
    parteApi('AUTOR', 1, 1440, 21),
  ];
  const { correcoes } = analisarCorrecoesPartesRequerido(txt, api);
  assert.equal(correcoes.length, 1);
  assert.equal(correcoes[0].tipo, 'duplicado');
  assert.equal(correcoes[0].parteIdDelete, 21);
}

function main() {
  assert.equal(normalizarPoloApi('Réu'), 'REU');
  testJaCorreto();
  testInvertido();
  testDuplicado();
  console.log('corrigir-partes-requerido-txt.test.mjs: ok');
}

main();
