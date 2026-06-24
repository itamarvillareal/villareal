import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {
  caminhoArquivoUnidadeCalculos,
  lerCabecalhoProcessoTxt,
  parseDataCabecalhoIso,
  parseValorCausaTxt,
} from './proc-processo-cabecalho-txt.mjs';
import { DEFAULT_BASE_HISTORICO_LOCAL } from './historico-local-txt-paths.mjs';
import { resolverBaseBancoDados } from './gerais-fase-processo-txt.mjs';

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

  it('578/134: uf e cidade em Gerais quando ausentes em Proc', () => {
    const base = resolverBaseBancoDados();
    const ufGerais = path.join(base, 'Gerais', '1000', '500', '578', '00000578.11.1.134.txt');
    if (!fs.existsSync(ufGerais)) return;
    const cab = lerCabecalhoProcessoTxt(578, 134, { baseBanco: base });
    assert.equal(cab.campos.uf, 'GO');
    assert.match(String(cab.campos.cidade), /POLIS/i);
    assert.ok(String(cab.fontes.uf).includes(`${path.sep}Gerais${path.sep}`));
    assert.ok(String(cab.fontes.cidade).includes(`${path.sep}Gerais${path.sep}`));
  });
});
