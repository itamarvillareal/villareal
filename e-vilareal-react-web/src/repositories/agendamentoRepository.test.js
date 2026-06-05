import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../api/httpClient.js', () => ({
  request: vi.fn(),
}));

import { request } from '../api/httpClient.js';
import {
  atualizarAgendamento,
  criarAgendamento,
  listarPainel,
  pausarAgendamento,
  listarExecucoesProcesso,
} from './agendamentoRepository.js';

beforeEach(() => {
  vi.mocked(request).mockReset();
  vi.mocked(request).mockResolvedValue([]);
});

describe('agendamentoRepository', () => {
  it('listarPainel chama GET /api/agendamentos/painel', async () => {
    await listarPainel();
    expect(request).toHaveBeenCalledWith('/api/agendamentos/painel');
  });

  it('criarAgendamento envia POST com body', async () => {
    const body = {
      tipoCadencia: 'HORARIOS_FIXOS',
      horariosFixos: '09:00,13:00,17:00',
    };
    await criarAgendamento(1076, body);
    expect(request).toHaveBeenCalledWith('/api/processos/1076/agendamentos', {
      method: 'POST',
      body,
    });
  });

  it('atualizarAgendamento envia PUT com body', async () => {
    const body = { tipoCadencia: 'INTERVALO', intervaloMinutos: 90 };
    await atualizarAgendamento(5, body);
    expect(request).toHaveBeenCalledWith('/api/agendamentos/5', {
      method: 'PUT',
      body,
    });
  });

  it('pausarAgendamento envia POST', async () => {
    await pausarAgendamento(3);
    expect(request).toHaveBeenCalledWith('/api/agendamentos/3/pausar', { method: 'POST' });
  });

  it('listarExecucoesProcesso monta query page e size', async () => {
    await listarExecucoesProcesso(1076, 1, 50);
    expect(request).toHaveBeenCalledWith('/api/processos/1076/execucoes', {
      query: { page: '1', size: '50' },
    });
  });

  it('rejeita id inválido', async () => {
    await expect(atualizarAgendamento(0, {})).rejects.toThrow(/agendamento válido/i);
  });
});
