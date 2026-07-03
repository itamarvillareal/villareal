import { describe, expect, it } from 'vitest';
import {
  CADASTRO_PARCIAL,
  CADASTRO_PLENO,
  cadastroParaQueryApi,
  classificarCadastroExtratoRow,
  parseCadastroFiltroParam,
  temCodigoEProcExtratoRow,
  temImovelVinculadoExtratoRow,
} from './extratoCadastroFiltro.js';

describe('extratoCadastroFiltro', () => {
  it('lê parâmetro cadastro da URL', () => {
    expect(parseCadastroFiltroParam(new URLSearchParams('cadastro=pleno'))).toBe(CADASTRO_PLENO);
    expect(parseCadastroFiltroParam(new URLSearchParams('cadastro=parcial'))).toBe(CADASTRO_PARCIAL);
    expect(parseCadastroFiltroParam(new URLSearchParams(''))).toBe('todos');
  });

  it('monta query da API', () => {
    expect(cadastroParaQueryApi(CADASTRO_PLENO)).toEqual({ cadastroPlenitude: 'PLENO' });
    expect(cadastroParaQueryApi(CADASTRO_PARCIAL)).toEqual({ cadastroPlenitude: 'PARCIAL' });
    expect(cadastroParaQueryApi('todos')).toEqual({ cadastroPlenitude: undefined });
  });

  it('classifica linha do extrato', () => {
    expect(classificarCadastroExtratoRow({ contaCodigo: 'N' })).toBe('importado');
    expect(classificarCadastroExtratoRow({ contaCodigo: 'A', codCliente: '1', proc: '2' })).toBe('pleno');
    expect(classificarCadastroExtratoRow({ contaCodigo: 'A', codCliente: '1' })).toBe('parcial');
    expect(classificarCadastroExtratoRow({ contaCodigo: 'E', grupoCompensacao: 'G1' })).toBe('pleno');
    expect(classificarCadastroExtratoRow({ contaCodigo: 'E' })).toBe('parcial');
    expect(classificarCadastroExtratoRow({ contaCodigo: 'I', numeroImovel: '42' })).toBe('pleno');
    expect(classificarCadastroExtratoRow({ contaCodigo: 'I', grupoCompensacao: '7' })).toBe('pleno');
    expect(classificarCadastroExtratoRow({ contaCodigo: 'I' })).toBe('parcial');
    expect(classificarCadastroExtratoRow({ contaCodigo: 'F' })).toBe('pleno');
  });

  it('temImovelVinculadoExtratoRow exige nº do imóvel', () => {
    expect(temImovelVinculadoExtratoRow({ numeroImovel: '56' })).toBe(true);
    expect(temImovelVinculadoExtratoRow({ grupoCompensacao: '12' })).toBe(true);
    expect(temImovelVinculadoExtratoRow({ numeroImovel: '' })).toBe(false);
    expect(temImovelVinculadoExtratoRow({})).toBe(false);
  });

  it('temCodigoEProcExtratoRow exige cliente e processo', () => {
    expect(temCodigoEProcExtratoRow({ codCliente: '938', proc: '10' })).toBe(true);
    expect(temCodigoEProcExtratoRow({ clienteId: 5, processoId: 9 })).toBe(true);
    expect(temCodigoEProcExtratoRow({ codCliente: '938' })).toBe(false);
    expect(temCodigoEProcExtratoRow({ proc: '10' })).toBe(false);
    expect(temCodigoEProcExtratoRow({})).toBe(false);
  });
});
