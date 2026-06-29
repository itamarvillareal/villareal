import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/featureFlags.js', () => ({
  featureFlags: { useApiProcessos: true, useApiClientes: true },
}));

import * as historico from './processosHistoricoData.js';
import {
  enriquecerCamposRelatorioProcessos,
  preservarCamposApiRelatorioProcessos,
} from './relatorioProcessosColunaDinamica.js';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(historico, 'getRegistroProcesso').mockReturnValue(null);
  vi.spyOn(historico, 'obterStatusAtivoUnificado').mockImplementation((_cod, _proc, fb) => fb !== false);
});

describe('preservarCamposApiRelatorioProcessos', () => {
  it('restaura campos da base quando merge apagou com string vazia', () => {
    const base = {
      unidade: 'Unidade 402 R',
      fase: 'Em Andamento',
      consultor: 'Karla Almeida',
    };
    const mesclada = { unidade: '', fase: '', consultor: '' };
    const out = preservarCamposApiRelatorioProcessos(base, mesclada);
    expect(out.unidade).toBe('Unidade 402 R');
    expect(out.fase).toBe('Em Andamento');
    expect(out.consultor).toBe('Karla Almeida');
  });

  it('não sobrescreve valor não vazio já presente no merge', () => {
    const base = { unidade: 'Unidade 402 R', fase: 'Em Andamento' };
    const mesclada = { unidade: 'Unidade 1201 B', fase: 'Ag. Peticionar' };
    const out = preservarCamposApiRelatorioProcessos(base, mesclada);
    expect(out.unidade).toBe('Unidade 1201 B');
    expect(out.fase).toBe('Ag. Peticionar');
  });
});

describe('enriquecerCamposRelatorioProcessos — campos API', () => {
  it('preserva unidade e consultor da listagem API sem registro local', () => {
    const row = {
      codCliente: '00000299',
      proc: '17',
      unidade: 'Unidade 402 R',
      consultor: 'ITAMAR',
      fase: 'Em Andamento',
      processoCadastroAtivo: true,
    };
    const enriched = enriquecerCamposRelatorioProcessos(row, 0);
    expect(enriched.unidade).toBe('Unidade 402 R');
    expect(enriched.consultor).toBe('ITAMAR');
    expect(enriched.fase).toBe('Em Andamento');
  });

  it('não troca consultor por usuário do histórico local', () => {
    vi.spyOn(historico, 'getRegistroProcesso').mockReturnValue({
      historico: [{ id: 1, data: '01/01/2026', info: 'Movimento X', usuario: 'Usuario Histórico' }],
    });
    const row = {
      codCliente: '00000299',
      proc: '17',
      consultor: 'ITAMAR',
      processoCadastroAtivo: true,
    };
    const enriched = enriquecerCamposRelatorioProcessos(row, 0);
    expect(enriched.consultor).toBe('ITAMAR');
  });
});
