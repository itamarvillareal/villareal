import { describe, it, expect } from 'vitest';
import {
  extrairChavesCandidatasCnjDoTextoAgenda,
  extrairPartesClienteOpostaDoTextoCompromisso,
  extrairTipoAudienciaDaDescricaoAgenda,
  encontrarProcessosHistoricoPorTextoAgenda,
} from './cnjAgendaResolucao.js';

describe('extrairChavesCandidatasCnjDoTextoAgenda', () => {
  it('extrai CNJ parcial após Autos nº', () => {
    const t =
      'CONCILIAÇÃO (SE77E TELECOM EIRELI ME x JEAN RODRIGUES DA SILVA) Autos nº 5003229.70, no JUIZADO';
    const chaves = extrairChavesCandidatasCnjDoTextoAgenda(t);
    expect(chaves.some((c) => c.startsWith('5003229') && c.includes('70'))).toBe(true);
  });

  it('extrai CNJ completo entre parênteses', () => {
    const t = 'consultar citação RAFAEL SIQUEIRA x LEYDIANE (5780090-53.2022.8.09.0006)';
    const chaves = extrairChavesCandidatasCnjDoTextoAgenda(t);
    expect(chaves.some((c) => c.length === 20 && c.startsWith('5780090'))).toBe(true);
  });
});

describe('extrairPartesClienteOpostaDoTextoCompromisso', () => {
  it('lê partes entre parênteses com x', () => {
    const t =
      'CONCILIAÇÃO (SE77E TELECOM EIRELI ME x JEAN RODRIGUES DA SILVA) Autos nº 5003229.70';
    const p = extrairPartesClienteOpostaDoTextoCompromisso(t);
    expect(p).toEqual({
      parteA: 'SE77E TELECOM EIRELI ME',
      parteB: 'JEAN RODRIGUES DA SILVA',
    });
  });
});

describe('encontrarProcessosHistoricoPorTextoAgenda', () => {
  it('casa prefixo CNJ no histórico', () => {
    const store = {
      '00000001:3': {
        codCliente: '1',
        proc: 3,
        numeroProcessoNovo: '5003229-70.2024.8.09.0123',
      },
    };
    const t = 'Autos nº 5003229.70 no juizado';
    const hits = encontrarProcessosHistoricoPorTextoAgenda(t, store);
    expect(hits).toEqual([{ codCliente: '00000001', proc: 3 }]);
  });
});

describe('extrairTipoAudienciaDaDescricaoAgenda', () => {
  it('extrai Conciliação de compromisso de audiência', () => {
    const t =
      'CONCILIAÇÃO (SE77E TELECOM EIRELI ME x JEAN RODRIGUES DA SILVA) Autos nº 5003229.70';
    expect(extrairTipoAudienciaDaDescricaoAgenda(t)).toBe('Conciliação');
  });

  it('não trata tarefa «consultar …» como tipo de audiência', () => {
    const t = 'consultar RAFAEL SIQUEIRA x KAROLYNE SOUZA (5738200-32.2025.8.09.0006)';
    expect(extrairTipoAudienciaDaDescricaoAgenda(t)).toBe('');
  });
});
