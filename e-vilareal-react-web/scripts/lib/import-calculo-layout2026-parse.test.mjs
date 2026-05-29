import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compactarTitulosImport,
  tituloLinhaTemDadosUtil,
} from './import-calculo-layout2026-parse.mjs';

test('tituloLinhaTemDadosUtil exige vencimento ou valorInicial', () => {
  assert.equal(tituloLinhaTemDadosUtil({ dataVencimento: '', valorInicial: '' }), false);
  assert.equal(tituloLinhaTemDadosUtil({ dataVencimento: '2023-10-09', valorInicial: '' }), true);
  assert.equal(tituloLinhaTemDadosUtil({ dataVencimento: '', valorInicial: 'R$ 10,00' }), true);
});

test('compactarTitulosImport remove blocos vazios entre páginas da planilha', () => {
  const titulos = [
    { dataVencimento: '2023-10-09', valorInicial: 'R$ 235,45' },
    { dataVencimento: '', valorInicial: '' },
    { dataVencimento: '', valorInicial: '' },
    { dataVencimento: '2023-10-10', valorInicial: 'R$ 23,55' },
  ];
  const compact = compactarTitulosImport(titulos);
  assert.equal(compact.length, 2);
  assert.equal(compact[0].valorInicial, 'R$ 235,45');
  assert.equal(compact[1].valorInicial, 'R$ 23,55');
});

test('compactarTitulosImport: padrão 5+15 vazios+5 repetido (como cliente 928) → 5 títulos', () => {
  const bloco = [
    { dataVencimento: '2023-10-09', valorInicial: 'R$ 235,45' },
    { dataVencimento: '2023-10-09', valorInicial: 'R$ 23,55' },
    { dataVencimento: '2023-10-09', valorInicial: 'R$ 200,00' },
    { dataVencimento: '2023-10-10', valorInicial: 'R$ 235,45' },
    { dataVencimento: '2023-10-10', valorInicial: 'R$ 23,55' },
  ];
  const vazio = { dataVencimento: '', valorInicial: '' };
  const titulos = [];
  for (let p = 0; p < 4; p++) {
    titulos.push(...bloco.map((t) => ({ ...t })));
    for (let i = 0; i < 15; i++) titulos.push({ ...vazio });
  }
  assert.equal(titulos.length, 80);
  const compact = compactarTitulosImport(titulos);
  assert.equal(compact.length, 5);
  assert.deepEqual(
    compact.map((t) => t.valorInicial),
    bloco.map((t) => t.valorInicial)
  );
});
