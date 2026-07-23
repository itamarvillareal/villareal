import { describe, expect, it } from 'vitest';
import { ordenarLinhasP7s, prefixoNumericoNomeArquivo } from './ordenarAnexosP7sInicial.js';

function linha(name) {
  return { key: name, file: { name } };
}

describe('prefixoNumericoNomeArquivo', () => {
  it('lê prefixos com 1+ dígitos', () => {
    expect(prefixoNumericoNomeArquivo('01.Peticao.p7s')).toBe(1);
    expect(prefixoNumericoNomeArquivo('10.COMP.p7s')).toBe(10);
    expect(prefixoNumericoNomeArquivo('100.Anexo.p7s')).toBe(100);
  });

  it('retorna null sem prefixo', () => {
    expect(prefixoNumericoNomeArquivo('Peticao.p7s')).toBeNull();
    expect(prefixoNumericoNomeArquivo('')).toBeNull();
  });
});

describe('ordenarLinhasP7s', () => {
  it('ordena do menor para o maior pelo prefixo numérico', () => {
    const ordenado = ordenarLinhasP7s([
      linha('10.COMP. DE DEVOLUÇÃO.p7s'),
      linha('01. PETICAO_INICIAL.p7s'),
      linha('06.Calculo.p7s'),
      linha('02.PROCURACAO.p7s'),
    ]);
    expect(ordenado.map((l) => l.file.name)).toEqual([
      '01. PETICAO_INICIAL.p7s',
      '02.PROCURACAO.p7s',
      '06.Calculo.p7s',
      '10.COMP. DE DEVOLUÇÃO.p7s',
    ]);
  });

  it('coloca nomes sem prefixo no fim, em ordem alfabética', () => {
    const ordenado = ordenarLinhasP7s([
      linha('Zeta.p7s'),
      linha('02.Doc.p7s'),
      linha('Alpha.p7s'),
    ]);
    expect(ordenado.map((l) => l.file.name)).toEqual(['02.Doc.p7s', 'Alpha.p7s', 'Zeta.p7s']);
  });

  it('desempata prefixos iguais alfabeticamente', () => {
    const ordenado = ordenarLinhasP7s([
      linha('02.B.p7s'),
      linha('02.A.p7s'),
    ]);
    expect(ordenado.map((l) => l.file.name)).toEqual(['02.A.p7s', '02.B.p7s']);
  });
});
