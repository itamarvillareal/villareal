import { describe, expect, it } from 'vitest';
import { chaveNumeroProcessoBuscaDiagnostico } from './normalizarNumeroProcessoBuscaDiagnostico.js';

describe('chaveNumeroProcessoBuscaDiagnostico', () => {
  it('iguala CNJ com pontos e traço vs só dígitos', () => {
    const a = chaveNumeroProcessoBuscaDiagnostico('5338688-60.2023.8.09.0007');
    const b = chaveNumeroProcessoBuscaDiagnostico('53386886020238090007');
    expect(a).toBe(b);
    expect(a).toHaveLength(20);
  });

  it('aceita espaços e traços unicode', () => {
    const a = chaveNumeroProcessoBuscaDiagnostico('5338688–60.2023.8.09.0007');
    const b = chaveNumeroProcessoBuscaDiagnostico('53386886020238090007');
    expect(a).toBe(b);
  });
});
