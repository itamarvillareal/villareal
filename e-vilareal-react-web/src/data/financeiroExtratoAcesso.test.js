import { describe, expect, it } from 'vitest';
import {
  filtrarBancosPorAcessoExtrato,
  NUMERO_BANCO_BB,
  NUMERO_BANCO_CEF,
  NUMERO_BANCO_CORA,
  NUMERO_BANCO_SICOOB_VRV,
  usuarioEhKarlaExtrato,
  usuarioPodeAcessarExtratoBanco,
  usuarioTemAcessoTotalExtratos,
} from './financeiroExtratoAcesso.js';

describe('financeiroExtratoAcesso', () => {
  it('itamar tem acesso total', () => {
    expect(usuarioTemAcessoTotalExtratos('itamar', 'itamar')).toBe(true);
    expect(usuarioTemAcessoTotalExtratos('1', 'itamar')).toBe(true);
    expect(usuarioPodeAcessarExtratoBanco(1, 'itamar', 'itamar')).toBe(true);
  });

  it('karla acessa BB, CEF, CORA e Sicoob VRV', () => {
    expect(usuarioEhKarlaExtrato('karla', 'karla')).toBe(true);
    expect(usuarioEhKarlaExtrato('2', 'karla.pedroza')).toBe(true);
    expect(
      usuarioPodeAcessarExtratoBanco(NUMERO_BANCO_BB, 'karla', 'karla.pedroza'),
    ).toBe(true);
    expect(
      usuarioPodeAcessarExtratoBanco(NUMERO_BANCO_CEF, 'karla', 'karla.pedroza'),
    ).toBe(true);
    expect(
      usuarioPodeAcessarExtratoBanco(NUMERO_BANCO_CORA, 'karla', 'karla.pedroza'),
    ).toBe(true);
    expect(
      usuarioPodeAcessarExtratoBanco(NUMERO_BANCO_SICOOB_VRV, 'karla', 'karla.pedroza'),
    ).toBe(true);
    expect(usuarioPodeAcessarExtratoBanco(1, 'karla', 'karla.pedroza')).toBe(false);
  });

  it('filtra lista de bancos para karla', () => {
    const bancos = [
      { nome: 'Itaú', numero: 1 },
      { nome: 'BB', numero: NUMERO_BANCO_BB },
      { nome: 'CEF', numero: NUMERO_BANCO_CEF },
      { nome: 'CORA', numero: NUMERO_BANCO_CORA },
      { nome: 'Sicoob VRV', numero: NUMERO_BANCO_SICOOB_VRV },
    ];
    const filtrados = filtrarBancosPorAcessoExtrato(bancos, 'karla', 'karla.pedroza');
    expect(filtrados.map((b) => b.numero)).toEqual([
      NUMERO_BANCO_BB,
      NUMERO_BANCO_CEF,
      NUMERO_BANCO_CORA,
      NUMERO_BANCO_SICOOB_VRV,
    ]);
  });
});
