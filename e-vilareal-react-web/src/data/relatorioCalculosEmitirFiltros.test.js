import { describe, expect, it } from 'vitest';
import {
  agregarLinhasRelatorioCalculosConsolidado,
  chaveProcessoRelatorioCalculosExtras,
  codigosClientes8UnicosDasChavesRodadasCalculos,
  filtroEmitirRelatorioCalculosPadrao,
  montarFiltroEmitirRelatorioCalculosFromUi,
  normalizarCodigoCliente8Relatorio,
  parseBRL,
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

  it('agregarLinhasRelatorioCalculosConsolidado soma parcelas por rodada', () => {
    const linhas = [
      {
        rodadaKey: '00000299:13:0',
        indiceParcela: 0,
        codCliente: '00000299',
        proc: '13',
        dimensao: '0',
        valor: 'R$ 100,00',
        valorHonorarios: 'R$ 10,00',
        reu: 'Réu A',
        unidade: '501 A',
      },
      {
        rodadaKey: '00000299:13:0',
        indiceParcela: 1,
        codCliente: '00000299',
        proc: '13',
        dimensao: '0',
        valor: 'R$ 200,50',
        valorHonorarios: 'R$ 20,00',
        reu: 'Réu A',
        unidade: '501 A',
      },
      {
        rodadaKey: '00000299:24:0',
        indiceParcela: 0,
        codCliente: '00000299',
        proc: '24',
        dimensao: '0',
        valor: 'R$ 50,00',
        valorHonorarios: 'R$ 5,00',
        reu: 'Réu B',
        unidade: '502 B',
      },
    ];
    const agg = agregarLinhasRelatorioCalculosConsolidado(linhas);
    expect(agg).toHaveLength(2);
    const proc13 = agg.find((r) => r.proc === '13');
    expect(parseBRL(proc13.valor)).toBeCloseTo(300.5, 2);
    expect(parseBRL(proc13.valorHonorarios)).toBeCloseTo(30, 2);
    expect(proc13.dataVencimento).toBe('');
    expect(proc13.parcela).toBe('');
    expect(proc13.linhaConsolidada).toBe(true);
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
