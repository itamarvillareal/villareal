import { describe, expect, it } from 'vitest';
import { pathExtratoFinanceiro, pathInboxFinanceiro } from './financeiroNavLinks.js';

describe('financeiroNavLinks', () => {
  it('pathInboxFinanceiro preserva mes e remove tipo legado', () => {
    expect(pathInboxFinanceiro('mes=2026&tipo=compensar', 'compensar')).toBe(
      '/financeiro/inbox/compensar?mes=2026',
    );
  });

  it('pathExtratoFinanceiro mantém query', () => {
    expect(pathExtratoFinanceiro('mes=2026&banco=1')).toBe('/financeiro/extrato?mes=2026&banco=1');
  });
});
