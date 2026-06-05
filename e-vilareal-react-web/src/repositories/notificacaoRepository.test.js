import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../api/httpClient.js', () => ({
  request: vi.fn(),
}));

import { request } from '../api/httpClient.js';
import {
  getDestinatariosPadrao,
  getDestinatariosProcesso,
  putDestinatariosPadrao,
  putDestinatariosProcesso,
  removerDestinatariosProcesso,
} from './notificacaoRepository.js';

beforeEach(() => {
  vi.mocked(request).mockReset();
  vi.mocked(request).mockResolvedValue({ whatsapp: [], email: [] });
});

describe('notificacaoRepository', () => {
  it('getDestinatariosPadrao chama GET', async () => {
    await getDestinatariosPadrao();
    expect(request).toHaveBeenCalledWith('/api/notificacao/destinatarios/padrao');
  });

  it('putDestinatariosPadrao envia PUT', async () => {
    const body = { whatsapp: ['+5562988765432'], email: ['a@b.com'] };
    await putDestinatariosPadrao(body);
    expect(request).toHaveBeenCalledWith('/api/notificacao/destinatarios/padrao', {
      method: 'PUT',
      body,
    });
  });

  it('getDestinatariosProcesso usa id do processo', async () => {
    await getDestinatariosProcesso(1076);
    expect(request).toHaveBeenCalledWith('/api/processos/1076/notificacao/destinatarios');
  });

  it('putDestinatariosProcesso envia PUT', async () => {
    await putDestinatariosProcesso(10, { whatsapp: [], email: ['x@y.com'] });
    expect(request).toHaveBeenCalledWith('/api/processos/10/notificacao/destinatarios', {
      method: 'PUT',
      body: { whatsapp: [], email: ['x@y.com'] },
    });
  });

  it('removerDestinatariosProcesso envia DELETE', async () => {
    await removerDestinatariosProcesso(10);
    expect(request).toHaveBeenCalledWith('/api/processos/10/notificacao/destinatarios', {
      method: 'DELETE',
    });
  });

  it('rejeita processo id inválido', async () => {
    await expect(getDestinatariosProcesso(0)).rejects.toThrow(/processo válido/i);
  });
});
