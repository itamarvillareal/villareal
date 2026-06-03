import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mergeProcessosVinculoPessoa, carregarProcessosVinculoPessoa } from './pessoaVinculosProcessos.js';

const { listarProcessosVinculoPessoaDiagnostico } = vi.hoisted(() => ({
  listarProcessosVinculoPessoaDiagnostico: vi.fn(),
}));

vi.mock('../config/featureFlags.js', () => ({
  featureFlags: { useApiProcessos: true },
}));

vi.mock('../repositories/processosRepository.js', () => ({
  listarProcessosVinculoPessoaDiagnostico: (...args) => listarProcessosVinculoPessoaDiagnostico(...args),
}));

vi.mock('./processosHistoricoData.js', () => ({
  listarProcessosPorIdPessoa: vi.fn(() => []),
}));

describe('mergeProcessosVinculoPessoa', () => {
  it('prioriza API e complementa com histórico local', () => {
    const api = [
      {
        codCliente: '00000728',
        proc: '1198',
        papeis: 'Parte Oposta',
        parteOposta: 'BRUNA PEREIRA DA LUZ',
      },
    ];
    const locais = [
      { codCliente: '00000728', proc: '1198', papeis: 'Parte Oposta (local)' },
      { codCliente: '00000100', proc: '5', papeis: 'Parte Cliente' },
    ];
    const merged = mergeProcessosVinculoPessoa(api, locais);
    expect(merged).toHaveLength(2);
    expect(merged.find((x) => x.proc === '1198')?.papeis).toBe('Parte Oposta');
    expect(merged.find((x) => x.proc === '5')?.papeis).toBe('Parte Cliente');
  });
});

describe('carregarProcessosVinculoPessoa', () => {
  beforeEach(() => {
    listarProcessosVinculoPessoaDiagnostico.mockReset();
  });

  it('delega à API quando useApiProcessos está ativo', async () => {
    listarProcessosVinculoPessoaDiagnostico.mockResolvedValue([
      { codCliente: '00000728', proc: '1198', papeis: 'Parte Oposta' },
    ]);
    const rows = await carregarProcessosVinculoPessoa(5331, 'BRUNA PEREIRA DA LUZ');
    expect(listarProcessosVinculoPessoaDiagnostico).toHaveBeenCalledWith(5331);
    expect(rows).toHaveLength(1);
    expect(rows[0].codCliente).toBe('00000728');
  });
});
