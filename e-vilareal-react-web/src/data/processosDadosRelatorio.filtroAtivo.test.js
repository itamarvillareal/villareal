import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as historico from './processosHistoricoData.js';
import { enriquecerCamposRelatorioProcessos } from './relatorioProcessosColunaDinamica.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('enriquecerCamposRelatorioProcessos — status ativo/inativo', () => {
  it('preserva processo inativo vindo da listagem API sem registro local', () => {
    vi.spyOn(historico, 'obterStatusAtivoUnificado').mockImplementation((_cod, _proc, fb) => fb !== false);
    const row = {
      codCliente: '00000001',
      proc: '2',
      processoCadastroAtivo: false,
      statusAtivoTexto: 'Inativo',
    };
    const enriched = enriquecerCamposRelatorioProcessos(row, 0);
    expect(enriched.processoCadastroAtivo).toBe(false);
    expect(enriched.statusAtivoTexto).toBe('Inativo');
  });

  it('usa status do cadastro local quando há registro', () => {
    vi.spyOn(historico, 'obterStatusAtivoUnificado').mockReturnValue(false);
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

  it('corrige linha com API ativa quando histórico local marca inativo', () => {
    vi.spyOn(historico, 'obterStatusAtivoUnificado').mockReturnValue(false);
    const row = {
      codCliente: '00000001',
      proc: '4',
      processoCadastroAtivo: true,
      statusAtivoTexto: 'Ativo',
    };
    const enriched = enriquecerCamposRelatorioProcessos(row, 0);
    expect(enriched.processoCadastroAtivo).toBe(false);
    expect(enriched.statusAtivoTexto).toBe('Inativo');
  });

  it('não sobrescreve status da API quando registro local não define statusAtivo', () => {
    vi.spyOn(historico, 'obterStatusAtivoUnificado').mockImplementation((_cod, _proc, fb) => fb !== false);
    const row = {
      codCliente: '00000001',
      proc: '2',
      processoCadastroAtivo: false,
      statusAtivoTexto: 'Inativo',
    };
    const enriched = enriquecerCamposRelatorioProcessos(row, 0);
    expect(enriched.processoCadastroAtivo).toBe(false);
    expect(enriched.statusAtivoTexto).toBe('Inativo');
  });
});
