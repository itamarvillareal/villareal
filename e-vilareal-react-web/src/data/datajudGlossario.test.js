import { describe, expect, it } from 'vitest';
import { DATAJUD_CAMPO, DATAJUD_WIKI_GLOSSARIO_URL } from './datajudGlossario.js';

describe('datajudGlossario', () => {
  it('URL oficial do glossário CNJ', () => {
    expect(DATAJUD_WIKI_GLOSSARIO_URL).toBe('https://datajud-wiki.cnj.jus.br/api-publica/glossario/');
  });

  it('DATAJUD_CAMPO alinhado ao glossário (nomes de campo)', () => {
    expect(DATAJUD_CAMPO.numeroProcesso).toBe('numeroProcesso');
    expect(DATAJUD_CAMPO.classeCodigo).toBe('classe.codigo');
    expect(DATAJUD_CAMPO.orgaoJulgadorCodigo).toBe('orgaoJulgador.codigo');
    expect(DATAJUD_CAMPO.timestamp).toBe('@timestamp');
  });
});
