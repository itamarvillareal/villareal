import { describe, expect, it } from 'vitest';
import { normalizarExtrasImovelParaUi } from './imoveisRepository.js';

describe('normalizarExtrasImovelParaUi', () => {
  it('mapeia chaves do import Node (layout Itamar) para a UI', () => {
    const n = normalizarExtrasImovelParaUi({
      saneagoMatricula: '12345',
      diaVencSaneago: 10,
      existeDebitoAgua: true,
      dataConsultaDebitoAgua: '2024-05-01',
      energiaMatricula: 'EN-9',
      inscricaoMunicipal: 'IPTU-77',
    });
    expect(n.aguaNumero).toBe('12345');
    expect(n.diaVencAgua).toBe('10');
    expect(n.existeDebAgua).toBe('sim');
    expect(n.dataConsAgua).toBe('01/05/2024');
    expect(n.energiaNumero).toBe('EN-9');
    expect(n.inscricaoMunicipal).toBe('IPTU-77');
  });

  it('preserva chaves do import Java', () => {
    const n = normalizarExtrasImovelParaUi({
      codigo: '00000728',
      proc: '42',
      aguaNumero: 'A1',
      existeDebAgua: 'nao',
    });
    expect(n.codigo).toBe('00000728');
    expect(n.proc).toBe('42');
    expect(n.aguaNumero).toBe('A1');
    expect(n.existeDebAgua).toBe('nao');
  });

  it('normaliza dataPag1TxCond compacta ddmmyyyy para dd/mm/aaaa', () => {
    const n = normalizarExtrasImovelParaUi({ dataPag1TxCond: '10072016' });
    expect(n.dataPag1TxCond).toBe('10/07/2016');
  });
});
