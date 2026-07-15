import { describe, expect, it, vi, afterEach } from 'vitest';
import { abrirPastaClienteLocal, verificarLocalHelperAtivo } from './abrirPastaLocalService.js';

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

  it('verificarLocalHelperAtivo retorna false quando fetch falha', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }));
    await expect(verificarLocalHelperAtivo()).resolves.toEqual({ ativo: false, baseClientes: null });
  });
});
