import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  agruparLinhasPorDia,
  chaveDiaAgenda,
  eventoApiAlinhadoComTxt,
  jaTemEquivalenteNoLote,
  listarLinhasSemParEstritoNaApi,
} from './agenda-api-aplicar.mjs';

describe('agruparLinhasPorDia', () => {
  it('agrupa e ordena por linhaLegado', () => {
    const linhas = [
      { usuarioId: 1, dataEvento: '2026-06-08', linhaLegado: 10, horaEvento: '13:30', descricao: 'B' },
      { usuarioId: 1, dataEvento: '2026-06-08', linhaLegado: 5, horaEvento: '13:30', descricao: 'A' },
      { usuarioId: 2, dataEvento: '2026-06-08', linhaLegado: 1, horaEvento: '09:00', descricao: 'X' },
    ];
    const g = agruparLinhasPorDia(linhas);
    assert.equal(g.size, 2);
    const d1 = g.get(chaveDiaAgenda(1, '2026-06-08'));
    assert.equal(d1?.length, 2);
    assert.equal(d1?.[0].linhaLegado, 5);
    assert.equal(d1?.[1].linhaLegado, 10);
  });
});

describe('eventoApiAlinhadoComTxt', () => {
  it('distingue dois compromissos no mesmo horário', () => {
    const saneago = { horaEvento: '13:30', descricao: 'saneago', statusCurto: '' };
    const audiencia = {
      horaEvento: '13:30',
      descricao: 'CONCILIAÇÃO (APM CALCADOS LTDA - ANDABELLA x CRYSTIANE MARCIANO BRAGA)',
      statusCurto: '',
    };
    assert.equal(eventoApiAlinhadoComTxt(saneago, saneago), true);
    assert.equal(eventoApiAlinhadoComTxt(saneago, audiencia), false);
    assert.equal(eventoApiAlinhadoComTxt(audiencia, audiencia), true);
  });
});

describe('jaTemEquivalenteNoLote', () => {
  it('dedupe estrito por conteudo_key, não fuzzy', () => {
    const a = { usuarioId: 1, dataEvento: '2026-06-08', horaEvento: '13:30', descricao: 'saneago' };
    const b = {
      usuarioId: 1,
      dataEvento: '2026-06-08',
      horaEvento: '13:30',
      descricao: 'CONCILIAÇÃO (APM CALCADOS LTDA - ANDABELLA x CRYSTIANE MARCIANO BRAGA)',
    };
    const linhas = [a];
    assert.equal(jaTemEquivalenteNoLote(linhas, a), true);
    assert.equal(jaTemEquivalenteNoLote(linhas, b), false);
  });
});

describe('listarLinhasSemParEstritoNaApi', () => {
  it('detecta linha txt sem par na API', () => {
    const txt = [
      { horaEvento: '13:30', descricao: 'saneago', statusCurto: '' },
      { horaEvento: '13:30', descricao: 'CONCILIAÇÃO (APM CALCADOS)', statusCurto: '' },
    ];
    const api = [{ horaEvento: '13:30', descricao: 'saneago', statusCurto: '' }];
    const faltas = listarLinhasSemParEstritoNaApi(txt, api);
    assert.equal(faltas.length, 1);
    assert.match(faltas[0].descricao, /CALCADOS/);
  });
});
