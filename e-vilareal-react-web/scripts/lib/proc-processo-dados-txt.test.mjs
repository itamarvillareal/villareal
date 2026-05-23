import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { montarPatchProcessoFromTxt } from './proc-processo-dados-txt.mjs';

describe('montarPatchProcessoFromTxt', () => {
  it('zera descricaoAcao e naturezaAcao antes de aplicar cabeçalho txt', () => {
    const patch = montarPatchProcessoFromTxt({
      cabecalho: { campos: { numeroCnj: '123' }, partesTxt: {} },
      prazoArvore: null,
      semantic: null,
      statusProcesso: { ativo: true, statusInativo: false },
      fase: null,
    });
    assert.equal(patch.descricaoAcao, null);
    assert.equal(patch.naturezaAcao, null);
    assert.equal(patch.numeroCnj, '123');
  });

  it('sobrescreve com valores do txt quando existem', () => {
    const patch = montarPatchProcessoFromTxt({
      cabecalho: {
        campos: { descricaoAcao: 'Execução', naturezaAcao: 'Cível' },
        partesTxt: {},
      },
      prazoArvore: null,
      semantic: null,
      statusProcesso: { ativo: true, statusInativo: false },
      fase: null,
    });
    assert.equal(patch.descricaoAcao, 'Execução');
    assert.equal(patch.naturezaAcao, 'Cível');
  });

  it('inclui tramitacao do txt 147.1 no patch', () => {
    const patch = montarPatchProcessoFromTxt({
      cabecalho: {
        campos: { tramitacao: 'Projudi' },
        partesTxt: {},
      },
      prazoArvore: null,
      semantic: null,
      statusProcesso: { ativo: true, statusInativo: false },
      fase: null,
    });
    assert.equal(patch.tramitacao, 'Projudi');
  });
});
