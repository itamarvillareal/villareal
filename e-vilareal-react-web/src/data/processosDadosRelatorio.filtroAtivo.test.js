import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./processosHistoricoData.js', () => ({
  getRegistroProcesso: vi.fn(() => null),
}));

import { enriquecerCamposRelatorioProcessos } from './relatorioProcessosColunaDinamica.js';
import { getRegistroProcesso } from './processosHistoricoData.js';

beforeEach(() => {
  getRegistroProcesso.mockReset();
  getRegistroProcesso.mockReturnValue(null);
});

describe('enriquecerCamposRelatorioProcessos — status ativo/inativo', () => {
  it('preserva processo inativo vindo da listagem API sem registro local', () => {
    const row = {
      codCliente: '00000001',
      proc: '2',
      processoCadastroAtivo: false,
      statusAtivoTexto: 'Inativo',
      cliente: 'Cliente Teste',
    };
    const enriched = enriquecerCamposRelatorioProcessos(row, 0);
    expect(enriched.processoCadastroAtivo).toBe(false);
    expect(enriched.statusAtivoTexto).toBe('Inativo');
  });

  it('usa status do cadastro local quando há registro', () => {
    getRegistroProcesso.mockReturnValue({ statusAtivo: false, historico: [] });
    const row = {
      codCliente: '00000001',
      proc: '2',
      processoCadastroAtivo: true,
      statusAtivoTexto: 'Ativo',
    };
    const enriched = enriquecerCamposRelatorioProcessos(row, 0);
    expect(enriched.processoCadastroAtivo).toBe(false);
    expect(enriched.statusAtivoTexto).toBe('Inativo');
  });
});
