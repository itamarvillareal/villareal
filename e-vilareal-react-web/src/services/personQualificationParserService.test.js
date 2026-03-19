import { describe, it, expect } from 'vitest';
import { parseQualificacaoPessoa } from './personQualificationParserService.js';

describe('parseQualificacaoPessoa', () => {
  it('tríade após qualificação de nome', () => {
    const q = parseQualificacaoPessoa(
      'JOÃO SILVA ("JOÃO"), brasileiro, solteiro, advogado, inscrito no CPF'
    );
    expect(q.nacionalidade).toBe('Brasileiro');
    expect(q.estadoCivil).toBe('solteiro');
    expect(q.profissao).toMatch(/Advogado/i);
  });

  it('brasileira, viúva, do lar', () => {
    const q = parseQualificacaoPessoa(
      'MARIA, brasileira, viúva, do lar, residente em Goiânia'
    );
    expect(q.nacionalidade).toBe('Brasileira');
    expect(q.estadoCivil).toBe('viuvo');
    expect(q.profissao).toMatch(/Do Lar/i);
  });

  it('união estável', () => {
    const q = parseQualificacaoPessoa(
      'Fulano, brasileiro, união estável, médico, portador da RG'
    );
    expect(q.estadoCivil).toBe('uniao_estavel');
    expect(q.profissao).toMatch(/Médico/i);
  });
});
