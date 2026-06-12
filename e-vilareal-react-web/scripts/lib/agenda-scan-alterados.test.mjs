import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { colapsarEventosConflitoStatus } from './agenda-scan-alterados.mjs';

describe('colapsarEventosConflitoStatus', () => {
  it('funde o mesmo compromisso vindo das duas fontes: status "OK" vence o vazio', () => {
    const eventos = [
      // estruturado (por-campo): status em branco
      {
        usuarioPasta: 'Karla',
        dataEvento: '2026-06-08',
        horaEvento: '13:30',
        descricao: 'saneago - cancelei',
        statusCurto: null,
        linhaLegado: 5,
        fonte: 'estruturado-scan',
      },
      // consolidado (dd.mm.yyyy.txt), referência: OK — e em casing diferente de pasta
      {
        usuarioPasta: 'KARLA',
        dataEvento: '2026-06-08',
        horaEvento: '13:30',
        descricao: 'saneago - cancelei',
        statusCurto: 'OK',
        linhaLegado: 3,
        fonte: 'dia-legado-scan',
      },
    ];

    const out = colapsarEventosConflitoStatus(eventos);
    assert.equal(out.length, 1);
    assert.equal(out[0].statusCurto, 'OK');
  });

  it('não funde compromissos realmente distintos (hora ou descrição diferentes)', () => {
    const eventos = [
      { usuarioPasta: 'KARLA', dataEvento: '2026-06-09', horaEvento: null, descricao: 'ligar A', statusCurto: null },
      { usuarioPasta: 'KARLA', dataEvento: '2026-06-09', horaEvento: '09:00', descricao: 'ligar A', statusCurto: 'OK' },
      { usuarioPasta: 'KARLA', dataEvento: '2026-06-09', horaEvento: null, descricao: 'ligar B', statusCurto: 'OK' },
    ];
    const out = colapsarEventosConflitoStatus(eventos);
    assert.equal(out.length, 3);
  });

  it('preserva status preenchido quando o consolidado vem antes do estruturado', () => {
    const eventos = [
      { usuarioPasta: 'KARLA', dataEvento: '2026-06-09', horaEvento: null, descricao: 'pedir link DARWIN', statusCurto: 'OK' },
      { usuarioPasta: 'Karla', dataEvento: '2026-06-09', horaEvento: null, descricao: 'pedir link DARWIN', statusCurto: null },
    ];
    const out = colapsarEventosConflitoStatus(eventos);
    assert.equal(out.length, 1);
    assert.equal(out[0].statusCurto, 'OK');
  });
});
