import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseValorCausaTxt, parseDataCabecalhoIso } from './proc-processo-cabecalho-txt.mjs';

describe('proc-processo-cabecalho-txt', () => {
  it('parseValorCausaTxt', () => {
    assert.equal(parseValorCausaTxt('R$ 343,35'), 343.35);
  });

  it('parseDataCabecalhoIso dd/mm/yyyy', () => {
    assert.equal(parseDataCabecalhoIso('30/05/2022'), '2022-05-30');
  });
});
