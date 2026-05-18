import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNomeArquivoSemanticProcesso,
  normalizarPapelClienteTxt,
  normalizarAvisoAudienciaTxt,
  normalizarDataAudienciaTxt,
  normalizarHoraAudienciaTxt,
  SEMANTIC_KEYS,
} from './proc-processo-semantic-txt.mjs';

describe('parseNomeArquivoSemanticProcesso', () => {
  it('parseia ClienteAvisado', () => {
    const p = parseNomeArquivoSemanticProcesso(
      '00000728.ClienteAvisado.Processo239.Processos.txt',
      SEMANTIC_KEYS.AVISO_AUDIENCIA
    );
    assert.equal(p?.numeroInterno, 239);
    assert.equal(p?.cod8, '00000728');
  });
});

describe('normalizadores', () => {
  it('papel requerente/requerido', () => {
    assert.equal(normalizarPapelClienteTxt('Requerente'), 'REQUERENTE');
    assert.equal(normalizarPapelClienteTxt('requerido'), 'REQUERIDO');
  });
  it('aviso', () => {
    assert.equal(normalizarAvisoAudienciaTxt('Avisado'), 'AVISADO');
    assert.equal(normalizarAvisoAudienciaTxt('Não avisado'), 'NAO_AVISADO');
  });
  it('data e hora', () => {
    assert.equal(normalizarDataAudienciaTxt('14/10/2022'), '2022-10-14');
    assert.equal(normalizarHoraAudienciaTxt('9:30'), '09:30');
  });
});
