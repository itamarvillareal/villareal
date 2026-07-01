import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  agregarDbPorMes,
  agregarPlanilhaPorMes,
  compararMeses,
  saldoSigned,
} from './extrato-bancos-planilha-validacao.mjs';

describe('extrato-bancos-planilha-validacao', () => {
  it('saldoSigned aplica sinal por natureza', () => {
    assert.equal(saldoSigned(10, 'CREDITO'), 10);
    assert.equal(saldoSigned(10, 'DEBITO'), -10);
  });

  it('compararMeses detecta gap de qtd e saldo', () => {
    const plan = agregarPlanilhaPorMes([
      { dataIso: '2020-05-11', valor: -100 },
      { dataIso: '2020-05-12', valor: 50 },
    ]);
    const db = agregarDbPorMes([
      { dataLancamento: '2020-05-11', valor: 100, natureza: 'DEBITO' },
    ]);
    const gaps = compararMeses(plan, db);
    assert.equal(gaps.length, 1);
    assert.equal(gaps[0].planQtd, 2);
    assert.equal(gaps[0].dbQtd, 1);
  });

  it('compararMeses OK quando qtd e saldo batem', () => {
    const plan = agregarPlanilhaPorMes([{ dataIso: '2021-07-01', valor: 25 }]);
    const db = agregarDbPorMes([{ dataLancamento: '2021-07-01', valor: 25, natureza: 'CREDITO' }]);
    assert.equal(compararMeses(plan, db).length, 0);
  });
});
