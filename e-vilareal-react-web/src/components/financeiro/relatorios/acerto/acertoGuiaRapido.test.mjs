import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProximoPassoAcerto } from './acertoGuiaRapido.js';

describe('acertoGuiaRapido', () => {
  it('sugere conferência quando nenhum proc conferido', () => {
    const r = calcularProximoPassoAcerto({
      periodosResumo: { periodos: [{ status: 'ABERTO', dataInicio: '2024-01-11' }] },
      resumoProcessos: {
        processosConferidos: 0,
        totalProcessos: 435,
        lancamentosNaoConferidos: 3578,
        processos: [],
      },
      periodoAtivo: { status: 'ABERTO' },
    });
    assert.equal(r.acaoSugerida, 'filtro_nao_conferidos');
    assert.match(r.texto, /3\.578/);
  });

  it('avisa quando card fechado selecionado', () => {
    const r = calcularProximoPassoAcerto({
      periodoAtivo: { status: 'FECHADO_GRUPO', tipoPeriodo: 'CARD' },
    });
    assert.match(r.titulo, /card fechado/i);
  });
});
