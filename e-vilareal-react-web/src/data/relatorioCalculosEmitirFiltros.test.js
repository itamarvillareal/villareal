import { describe, expect, it } from 'vitest';
import {
  chaveProcessoRelatorioCalculosExtras,
  codigosClientes8UnicosDasChavesRodadasCalculos,
  filtroEmitirRelatorioCalculosPadrao,
  montarFiltroEmitirRelatorioCalculosFromUi,
  normalizarCodigoCliente8Relatorio,
  parseListaCodigosClientesRelatorio,
  parseListaProcessosRelatorio,
  rodadaChavePassaFiltrosEmitirRelatorio,
  validarFiltroEmitirRelatorioCalculos,
} from './relatorioCalculosData.js';

describe('relatorioCalculos emitir filtros', () => {
  it('normalizarCodigoCliente8Relatorio', () => {
    expect(normalizarCodigoCliente8Relatorio('1')).toBe('00000001');
    expect(normalizarCodigoCliente8Relatorio('12345678')).toBe('12345678');
    expect(normalizarCodigoCliente8Relatorio('')).toBe('');
  });

  it('parseListaCodigosClientesRelatorio', () => {
    expect(parseListaCodigosClientesRelatorio('1, 2\n3')).toEqual(['00000001', '00000002', '00000003']);
  });

  it('parseListaProcessosRelatorio', () => {
    expect(parseListaProcessosRelatorio('1, 2')).toEqual([1, 2]);
  });

  it('rodadaChavePassaFiltrosEmitirRelatorio', () => {
    const f = {
      ...filtroEmitirRelatorioCalculosPadrao(),
      escopoCliente: 'um',
      codigosClienteNormalizados: ['00000001'],
      processos: [2],
      parcelamentoAceito: 'sim',
    };
    expect(rodadaChavePassaFiltrosEmitirRelatorio('00000001:2:1', true, f)).toBe(true);
    expect(rodadaChavePassaFiltrosEmitirRelatorio('00000002:2:1', true, f)).toBe(false);
    expect(rodadaChavePassaFiltrosEmitirRelatorio('00000001:3:1', true, f)).toBe(false);
    expect(rodadaChavePassaFiltrosEmitirRelatorio('00000001:2:1', false, f)).toBe(false);
  });

  it('montarFiltroEmitirRelatorioCalculosFromUi um cliente usa primeiro token', () => {
    const f = montarFiltroEmitirRelatorioCalculosFromUi({
      escopoCliente: 'um',
      textoCodigosCliente: '5, 9',
      textoProcessos: '',
      parcelamentoAceito: 'todos',
    });
    expect(f.codigosClienteNormalizados).toEqual(['00000005']);
  });

  it('chaveProcessoRelatorioCalculosExtras e códigos únicos das chaves', () => {
    expect(chaveProcessoRelatorioCalculosExtras('299', 2)).toBe('00000299|2');
    expect(
      codigosClientes8UnicosDasChavesRodadasCalculos(['00000299:1:0', '00000299:2:0', '00000001:1:0']).sort()
    ).toEqual(['00000001', '00000299']);
  });

  it('validarFiltroEmitirRelatorioCalculos', () => {
    expect(validarFiltroEmitirRelatorioCalculos(filtroEmitirRelatorioCalculosPadrao()).ok).toBe(true);
    expect(
      validarFiltroEmitirRelatorioCalculos({
        ...filtroEmitirRelatorioCalculosPadrao(),
        escopoCliente: 'um',
        codigosClienteNormalizados: [],
      }).ok
    ).toBe(false);
    expect(
      validarFiltroEmitirRelatorioCalculos({
        ...filtroEmitirRelatorioCalculosPadrao(),
        escopoCliente: 'varios',
        codigosClienteNormalizados: [],
      }).ok
    ).toBe(false);
  });
});
