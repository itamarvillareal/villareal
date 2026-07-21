import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  abrirPastaClienteLocal,
  abrirPastaClienteViaNavegador,
  verificarLocalHelperAtivo,
} from './abrirPastaLocalService.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('abrirPastaLocalService', () => {
  it('abrirPastaClienteLocal envia codigo e nome', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, caminho: '/tmp/cliente' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await abrirPastaClienteLocal({
      codigoCliente: '600',
      nomeCliente: 'Mega Elite',
      numeroInterno: 1,
    });

    expect(result.caminho).toBe('/tmp/cliente');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.codigoCliente).toBe('600');
    expect(body.nomeCliente).toBe('Mega Elite');
    expect(body.numeroInterno).toBe(1);
  });

  it('abrirPastaClienteLocal usa navegador quando fetch falha por rede', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    const openMock = vi.fn(() => ({}));
    vi.stubGlobal('window', { open: openMock });

    const result = await abrirPastaClienteLocal({
      codigoCliente: '491',
      nomeCliente: 'Veredas',
      numeroInterno: 2,
    });

    expect(result).toEqual({ ok: true, viaNavegador: true });
    expect(openMock).toHaveBeenCalledOnce();
    expect(String(openMock.mock.calls[0][0])).toContain('/abrir-pasta-cliente?');
    expect(String(openMock.mock.calls[0][0])).toContain('codigoCliente=491');
  });

  it('abrirPastaClienteViaNavegador monta URL com parâmetros', () => {
    const openMock = vi.fn(() => ({}));
    vi.stubGlobal('window', { open: openMock });

    abrirPastaClienteViaNavegador({
      codigoCliente: '00000491',
      nomeCliente: 'Teste',
      numeroInterno: 3,
    });

    expect(openMock).toHaveBeenCalledOnce();
    const url = String(openMock.mock.calls[0][0]);
    expect(url).toContain('numeroInterno=3');
    expect(url).toContain('nomeCliente=');
  });

  it('verificarLocalHelperAtivo retorna false quando fetch falha', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }));
    await expect(verificarLocalHelperAtivo()).resolves.toEqual({
      ativo: false,
      baseClientes: null,
      baseUrl: null,
    });
  });
});
