import { describe, expect, it } from 'vitest';
import { mensagemErroAmigavel } from './mensagemErroAmigavel.js';

describe('mensagemErroAmigavel', () => {
  it('traduz erro 413 no upload de assinados', () => {
    expect(mensagemErroAmigavel(new Error('Erro 413'), 'enviar os arquivos assinados')).toMatch(
      /250 MB/i,
    );
  });

  it('traduz payload too large genérico', () => {
    expect(mensagemErroAmigavel('Payload Too Large')).toMatch(/250 MB/i);
  });
});
