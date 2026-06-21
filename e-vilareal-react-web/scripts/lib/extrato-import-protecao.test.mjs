import assert from 'node:assert/strict';
import {
  aplicarProtecaoDataCorteImportacao,
  calcularDataCorteImportacaoExtrato,
  formatarDataCorteBr,
} from '../../src/utils/extratoImportProtecao.js';

const existente = [
  { data: '15/01/2026', valor: 100 },
  { data: '16/06/2026', valor: 200 },
  { data: '17/06/2026', valor: 300 },
  { data: '18/06/2026', valor: 400 },
];

assert.equal(calcularDataCorteImportacaoExtrato(existente), '2026-06-17');
assert.equal(formatarDataCorteBr('2026-06-17'), '17/06/2026');

const arquivo = [
  { data: '10/01/2026', valor: 50 },
  { data: '17/06/2026', valor: 300 },
  { data: '19/06/2026', valor: 500 },
];

const protecao = aplicarProtecaoDataCorteImportacao(arquivo, existente, { modo: 'mesclar' });
assert.equal(protecao.dataCorte, '2026-06-17');
assert.equal(protecao.ignoradosPorCorte, 1);
assert.equal(protecao.rows.length, 2);
assert.equal(protecao.rows[0].data, '17/06/2026');

const substituir = aplicarProtecaoDataCorteImportacao(arquivo, existente, { modo: 'substituir' });
assert.equal(substituir.rows.length, 3);
assert.equal(substituir.ignoradosPorCorte, 0);

console.log('extrato-import-protecao.test.mjs OK');
