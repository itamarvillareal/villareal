import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  caminhoArquivoUnidadeCalculos,
  lerCabecalhoProcessoTxt,
  parseDataCabecalhoIso,
  parseValorCausaTxt,
} from './proc-processo-cabecalho-txt.mjs';
import { DEFAULT_BASE_HISTORICO_LOCAL } from './historico-local-txt-paths.mjs';

describe('proc-processo-cabecalho-txt', () => {
  it('parseValorCausaTxt', () => {
    assert.equal(parseValorCausaTxt('R$ 343,35'), 343.35);
  });

  it('parseDataCabecalhoIso dd/mm/yyyy', () => {
    assert.equal(parseDataCabecalhoIso('30/05/2022'), '2022-05-30');
  });

  it('caminhoArquivoUnidadeCalculos segue Calculos/1000/{centena}/{cliente}', () => {
    const base = '/tmp/Banco de Dados';
    const abs = caminhoArquivoUnidadeCalculos(base, 299, 12);
    assert.equal(
      abs,
      path.join(base, 'Calculos', '1000', '200', '299', '00000299.0.88.1.12.txt')
    );
  });

  it('lerCabecalhoProcessoTxt lê unidade em Calculos (cliente 299 proc 12)', () => {
    const base = DEFAULT_BASE_HISTORICO_LOCAL;
    const cab = lerCabecalhoProcessoTxt(299, 12, { baseBanco: base });
    if (!cab.fontes.unidade) {
      assert.fail(`txt ausente: ${path.join(base, 'Calculos', '1000', '200', '299', '00000299.0.88.1.12.txt')}`);
    }
    assert.match(String(cab.campos.unidade), /602/);
    assert.ok(cab.fontes.unidade.includes(`${path.sep}Calculos${path.sep}`));
  });
});
