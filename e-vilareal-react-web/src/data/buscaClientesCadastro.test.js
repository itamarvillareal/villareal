import { describe, expect, it, vi } from 'vitest';
import {
  filtrarClientesIndicePorCodigo,
  pesquisarClientesCadastroPorTermo,
  termoPermiteBuscaClienteCadastro,
} from './buscaClientesCadastro.js';

vi.mock('../config/featureFlags.js', () => ({
  featureFlags: { useApiClientes: true, useApiProcessos: false },
}));

vi.mock('../repositories/clientesRepository.js', () => ({
  resolverClienteCadastroPorCodigo: vi.fn(),
}));

const indice = [
  {
    codigo: '00000966',
    nomeRazao: 'ANGELIM REPRESENTAÇÕES LTDA',
    cnpjCpf: '12345678000199',
    pessoa: '100',
  },
  {
    codigo: '00000149',
    nomeRazao: 'ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR',
    cnpjCpf: '00733235190',
    pessoa: '868',
  },
];

describe('buscaClientesCadastro', () => {
  it('termoPermiteBusca aceita 8 dígitos ou texto com 2+ letras', () => {
    expect(termoPermiteBuscaClienteCadastro('')).toBe(false);
    expect(termoPermiteBuscaClienteCadastro('a')).toBe(false);
    expect(termoPermiteBuscaClienteCadastro('angel')).toBe(true);
    expect(termoPermiteBuscaClienteCadastro('00000966')).toBe(true);
    expect(termoPermiteBuscaClienteCadastro('3')).toBe(true);
  });

  it('pesquisa por nome no índice de clientes (razão social), não por pessoa', async () => {
    const hits = await pesquisarClientesCadastroPorTermo('angel', indice);
    expect(hits).toHaveLength(1);
    expect(hits[0].codigoPadded).toBe('00000966');
    expect(hits[0].nomeCliente).toBe('ANGELIM REPRESENTAÇÕES LTDA');
  });

  it('pesquisa por código de 8 dígitos', async () => {
    const hits = await pesquisarClientesCadastroPorTermo('00000966', indice);
    expect(hits).toHaveLength(1);
    expect(hits[0].codCliente).toBeTruthy();
  });

  it('filtrarClientesIndicePorCodigo: 491 encontra código 00000491, não proc. 491', () => {
    const indiceCod = [
      { codigoPadded: '00000491', codigoNum: 491, nome: 'CLIENTE 491' },
      { codigoPadded: '00000824', codigoNum: 824, nome: 'THIAGO - Proc. 491' },
    ];
    const hits = filtrarClientesIndicePorCodigo(indiceCod, '491');
    expect(hits).toHaveLength(1);
    expect(hits[0].codigoPadded).toBe('00000491');
  });

  it('pesquisarClientesCadastroPorTermo: dígitos parciais buscam código, não processo', async () => {
    const indiceCod = [
      { codigo: '00000491', nomeRazao: 'CLIENTE 491', cnpjCpf: '', pessoa: '1' },
      { codigo: '00000824', nomeRazao: 'OUTRO', cnpjCpf: '', pessoa: '2' },
    ];
    const hits = await pesquisarClientesCadastroPorTermo('491', indiceCod);
    expect(hits).toHaveLength(1);
    expect(hits[0].codigoPadded).toBe('00000491');
    expect(hits[0].nomeCliente).toBe('CLIENTE 491');
  });
});
