import { describe, it, expect } from 'vitest';
import { mensagemResultadoLocalizarProcesso } from './agendaLocalizarProcesso.js';

describe('mensagemResultadoLocalizarProcesso', () => {
  it('mensagem para ambiguidade CNJ', () => {
    const msg = mensagemResultadoLocalizarProcesso({ ok: false, motivo: 'ambiguo_cnj', matches: [{}, {}] });
    expect(msg).toMatch(/Mais de um processo/);
  });

  it('mensagem quando partes não encontradas', () => {
    const msg = mensagemResultadoLocalizarProcesso({ ok: false, motivo: 'partes_nao_encontradas' });
    expect(msg).toMatch(/partes/);
  });
});
