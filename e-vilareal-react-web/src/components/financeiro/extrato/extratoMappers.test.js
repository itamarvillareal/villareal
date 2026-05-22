import { describe, expect, it } from 'vitest';
import {
  codigoClienteExtratoDesdeApiDto,
  registrarCodigoClienteFinanceiroPorPessoaId,
} from '../../../data/financeiroData.js';
import {
  formatDataExtratoColuna,
  mapApiLancamentoToExtratoRow,
  mergeExtratoRowComRespostaApi,
  promoverContaEscritorioSeVinculado,
  montarObservacaoExtratoVinculo,
  textoObsExtrato,
} from './extratoMappers.js';
import { mesAnoFromDataLancamento } from './extratoMesUtils.js';

describe('extratoMesUtils', () => {
  it('mesAnoFromDataLancamento extrai YYYY-MM', () => {
    expect(mesAnoFromDataLancamento('2026-03-02')).toBe('2026-03');
    expect(mesAnoFromDataLancamento(null)).toBeNull();
    expect(mesAnoFromDataLancamento('')).toBeNull();
  });
});

describe('extratoMappers', () => {
  it('formatDataExtratoColuna omite ano quando corrente', () => {
    const y = new Date().getFullYear();
    expect(formatDataExtratoColuna(`${y}-03-25`)).toBe('25/03');
    expect(formatDataExtratoColuna('2020-03-25')).toBe('25/03/2020');
  });

  it('montarObservacaoExtratoVinculo junta parte cliente e oposta com x', () => {
    expect(
      montarObservacaoExtratoVinculo(
        'LM SOLUCOES EMPRESARIAS E ADMINISTRATIVAS LTDA',
        'DANIELA DOS SANTOS TAVARES',
      ),
    ).toBe('LM SOLUCOES EMPRESARIAS E ADMINISTRATIVAS LTDA x DANIELA DOS SANTOS TAVARES');
  });

  it('textoObsExtrato exibe observação mesmo com vínculo cliente/processo', () => {
    const row = {
      contaCodigo: 'N',
      codCliente: '104',
      proc: '4',
      clienteId: 1,
      observacao: 'CREDIT - Pagamento',
    };
    expect(textoObsExtrato(row)).toBe('CREDIT - Pagamento');
  });

  it('promoverContaEscritorioSeVinculado altera N para A', () => {
    const row = { contaCodigo: 'N', codCliente: '104', proc: '4' };
    const out = promoverContaEscritorioSeVinculado(row, [{ id: 1, codigo: 'A', nome: 'Conta Escritório' }]);
    expect(out.contaCodigo).toBe('A');
    expect(out.contaContabilId).toBe(1);
  });

  it('mergeExtratoRowComRespostaApi preserva código escolhido no vínculo mesmo com API incorreta', () => {
    const row = {
      id: 99,
      codCliente: '938',
      proc: '12',
      clienteId: 100,
      pessoaRefId: 6277,
      contaCodigo: 'A',
      descricao: 'PIX',
      dataLancamento: '2026-05-19',
      valor: 100,
      natureza: 'DEBITO',
    };
    const merged = mergeExtratoRowComRespostaApi(row, {
      id: 99,
      contaContabilNome: 'Conta Escritório',
      codigoCliente: '00006277',
      clienteId: 100,
      pessoaRefId: 6277,
      numeroInternoProcesso: 12,
      dataLancamento: '2026-05-19',
      descricao: 'PIX',
      valor: 100,
      natureza: 'DEBITO',
      etapa: 'FECHADO',
    }, { 'Conta Escritório': 'A' });
    expect(merged.codCliente).toBe('938');
    expect(merged.proc).toBe('12');
    expect(merged.clienteId).toBe(100);
  });

  it('codigoClienteExtrato usa cache do vínculo quando API devolve pessoaRefId', () => {
    registrarCodigoClienteFinanceiroPorPessoaId(6277, '986');
    expect(
      codigoClienteExtratoDesdeApiDto({ codigoCliente: '00006277', clienteId: 100, pessoaRefId: 6277 }),
    ).toBe('986');
  });

  it('codigoClienteExtrato lê tag CC_CLI quando API devolve pessoaRefId', () => {
    expect(
      codigoClienteExtratoDesdeApiDto({
        codigoCliente: '00000084',
        clienteId: 500,
        pessoaRefId: 84,
        descricaoDetalhada: 'Partes x y [CC_CLI:793]',
      }),
    ).toBe('793');
    const row = mapApiLancamentoToExtratoRow(
      {
        id: 97614,
        contaContabilNome: 'Conta Escritório',
        codigoCliente: '00000084',
        clienteId: 500,
        pessoaRefId: 84,
        processoId: 7233,
        numeroInternoProcesso: 10,
        descricaoDetalhada: 'ALOISIO x NEEMIAS [CC_CLI:793]',
        dataLancamento: '2025-11-11',
        descricao: 'PIX',
        valor: 1707.83,
        natureza: 'CREDITO',
        etapa: 'VINCULADO',
      },
      { 'Conta Escritório': 'A' },
    );
    expect(row.codCliente).toBe('793');
    expect(row.proc).toBe('10');
  });

  it('codClienteExibicao ignora codigoCliente quando é só o id da pessoa (sem cache)', () => {
    const row = mapApiLancamentoToExtratoRow(
      {
        id: 1,
        contaContabilNome: 'Conta Escritório',
        codigoCliente: '00009999',
        clienteId: 50,
        pessoaRefId: 9999,
        dataLancamento: '2026-05-19',
        descricao: 'PIX',
        valor: 100,
        natureza: 'DEBITO',
        etapa: 'FECHADO',
      },
      { 'Conta Escritório': 'A' },
    );
    expect(row.codCliente).toBe('');
  });

  it('mapApiLancamentoToExtratoRow mapeia etapa e natureza', () => {
    const row = mapApiLancamentoToExtratoRow(
      {
        id: 1,
        contaContabilNome: 'Conta Escritório',
        dataLancamento: '2026-05-10',
        descricao: 'PIX',
        valor: 100,
        natureza: 'CREDITO',
        etapa: 'IMPORTADO',
      },
      { 'Conta Escritório': 'A' },
    );
    expect(row.contaCodigo).toBe('A');
    expect(row.etapa).toBe('IMPORTADO');
    expect(row.natureza).toBe('CREDITO');
    expect(row.valor).toBe(100);
  });
});
