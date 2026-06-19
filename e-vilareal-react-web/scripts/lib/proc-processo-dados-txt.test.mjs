import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { montarPatchProcessoFromTxt } from './proc-processo-dados-txt.mjs';

describe('montarPatchProcessoFromTxt', () => {
  it('zera descricaoAcao e naturezaAcao antes de aplicar cabeçalho txt', () => {
    const patch = montarPatchProcessoFromTxt({
      cabecalho: { campos: { numeroCnj: '123' }, partesTxt: {} },
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
      semantic: null,
      statusProcesso: { ativo: true, statusInativo: false },
      fase: null,
    });
    assert.equal(patch.descricaoAcao, 'Execução');
    assert.equal(patch.naturezaAcao, 'Cível');
  });

  it('inclui prazo fatal do txt 145.1 canónico no patch', () => {
    const patch = montarPatchProcessoFromTxt({
      cabecalho: {
        campos: { prazoFatal: '2026-04-10' },
        partesTxt: {},
        fontes: { prazoFatal: '/Gerais/1000/400/491/00000491.145.1.4.txt' },
      },
      semantic: null,
      statusProcesso: { ativo: true, statusInativo: false },
      fase: null,
    });
    assert.equal(patch.prazoFatal, '2026-04-10');
  });
});
