import { describe, expect, it } from 'vitest';
import { ehTituloHistoricoSistemaLegado } from './historicoTituloLegadoSistema.js';

describe('ehTituloHistoricoSistemaLegado', () => {
  it('exclui títulos automáticos do VB na pasta', () => {
    expect(
      ehTituloHistoricoSistemaLegado(
        'JUNTAR PETIÇÃO INSERIDA NA PASTA EM 15/05/2026 (NOVO ENDEREÇO PARA INTIMAR PROCURADOR)',
      ),
    ).toBe(true);
    expect(
      ehTituloHistoricoSistemaLegado('PETIÇÃO DA INFORMAÇÃO ANTERIOR JUNTADA EM 15/05/2026'),
    ).toBe(true);
    expect(ehTituloHistoricoSistemaLegado('PETIÇÃO DA INF. ANTERIOR JUNTADA EM 23/07/2021')).toBe(true);
  });

  it('mantém informações reais de histórico', () => {
    expect(ehTituloHistoricoSistemaLegado('AGRAVO INTERNO JUNTADO E PREPARADO')).toBe(false);
    expect(ehTituloHistoricoSistemaLegado('memoriais até 18/05/2026')).toBe(false);
    expect(ehTituloHistoricoSistemaLegado('teste')).toBe(false);
  });
});
