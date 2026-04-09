import { describe, expect, it } from 'vitest';
import { detectarSugestoesRecorrenciaMensalNoBanco } from './financeiroData.js';

describe('detectarSugestoesRecorrenciaMensalNoBanco', () => {
  it('encontra candidatos com mesma descrição e valor que um modelo letra A + código', () => {
    const lista = [
      {
        letra: 'A',
        codCliente: '00000938',
        proc: '17',
        descricao: 'Pagamento recebido - Fulano',
        valor: 2500,
        data: '29/12/2025',
        numero: 'a1',
        _financeiroMeta: { clienteId: 938, processoId: 17, contaContabilId: 1 },
      },
      {
        letra: 'N',
        codCliente: '',
        proc: '',
        descricao: 'Pagamento recebido - Fulano',
        valor: 2500,
        data: '30/01/2026',
        numero: 'b2',
        _financeiroMeta: {},
      },
      {
        letra: 'N',
        codCliente: '',
        proc: '',
        descricao: 'Pagamento recebido - Fulano',
        valor: 2500,
        data: '28/02/2026',
        numero: 'c3',
        _financeiroMeta: {},
      },
    ];
    const grupos = detectarSugestoesRecorrenciaMensalNoBanco(lista);
    expect(grupos.length).toBe(1);
    expect(grupos[0].candidatos.length).toBe(2);
    expect(grupos[0].codCliente).toBeTruthy();
    expect(grupos[0].proc).toBeTruthy();
  });

  it('ignora duplicata já classificada igual ao modelo', () => {
    const lista = [
      {
        letra: 'A',
        codCliente: '00000938',
        proc: '17',
        descricao: 'Taxa X',
        valor: 100,
        data: '01/01/2026',
        numero: '1',
        _financeiroMeta: {},
      },
      {
        letra: 'A',
        codCliente: '00000938',
        proc: '17',
        descricao: 'Taxa X',
        valor: 100,
        data: '01/02/2026',
        numero: '2',
        _financeiroMeta: {},
      },
    ];
    const grupos = detectarSugestoesRecorrenciaMensalNoBanco(lista);
    expect(grupos.length).toBe(0);
  });

  it('normaliza descrição (maiúsculas / espaços)', () => {
    const lista = [
      {
        letra: 'A',
        codCliente: '00000001',
        proc: '1',
        descricao: 'BOLETO  ALGUM',
        valor: 50,
        data: '01/01/2026',
        numero: '1',
        _financeiroMeta: {},
      },
      {
        letra: 'N',
        codCliente: '',
        proc: '',
        descricao: 'boleto algum',
        valor: 50,
        data: '02/02/2026',
        numero: '2',
        _financeiroMeta: {},
      },
    ];
    const grupos = detectarSugestoesRecorrenciaMensalNoBanco(lista);
    expect(grupos.length).toBe(1);
    expect(grupos[0].candidatos).toHaveLength(1);
  });
});
