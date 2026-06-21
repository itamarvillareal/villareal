import { describe, expect, it } from 'vitest';
import {
  codigoClienteExtratoDesdeApiDto,
  grupoCompensacaoParaSalvarLancamento,
  registrarCodigoClienteFinanceiroPorPessoaId,
} from '../../../data/financeiroData.js';
import {
  contaCorrenteTransacaoParaExtratoDetailItem,
  extratoRowToUi,
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

  it('extratoRowToUi lê proc 0 mensalista de grupoCompensacao na conta A', () => {
    const ui = extratoRowToUi({
      id: 1,
      contaCodigo: 'A',
      grupoCompensacao: '0',
      clienteId: 473,
      proc: '',
      numeroLancamento: '1',
      dataLancamento: '2026-06-01',
      descricao: 'Mensalista',
      valor: 100,
      natureza: 'CREDITO',
    });
    expect(ui.proc).toBe('0');
    expect(ui._financeiroMeta.grupoCompensacao).toBe('0');
  });

  it('grupoCompensacaoParaSalvarLancamento persiste marcador mensalista na conta A', () => {
    expect(
      grupoCompensacaoParaSalvarLancamento({ letra: 'A', proc: '0', processoId: null }),
    ).toBe('0');
    expect(
      grupoCompensacaoParaSalvarLancamento({ letra: 'A', proc: '12', processoId: 99 }),
    ).toBe('');
    expect(
      grupoCompensacaoParaSalvarLancamento({
        letra: 'A',
        proc: '',
        processoId: null,
        grupoAtual: '0',
      }),
    ).toBe('');
  });

  it('codigoClienteExtrato prefere codigoCliente retornado pela API', () => {
    registrarCodigoClienteFinanceiroPorPessoaId(6277, '986');
    expect(
      codigoClienteExtratoDesdeApiDto({ codigoCliente: '00000938', clienteId: 100, pessoaRefId: 6277 }),
    ).toBe('938');
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

  it('codClienteExibicao usa codigoCliente retornado pela API', () => {
    const row = mapApiLancamentoToExtratoRow(
      {
        id: 1,
        contaContabilNome: 'Conta Escritório',
        codigoCliente: '00000938',
        clienteId: 50,
        pessoaRefId: 6277,
        dataLancamento: '2026-05-19',
        descricao: 'PIX',
        valor: 100,
        natureza: 'DEBITO',
        etapa: 'FECHADO',
      },
      { 'Conta Escritório': 'A' },
    );
    expect(row.codCliente).toBe('938');
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

  it('contaCorrenteTransacaoParaExtratoDetailItem converte linha local', () => {
    const item = contaCorrenteTransacaoParaExtratoDetailItem({
      apiId: 42,
      letra: 'A',
      data: '18/06/2026',
      descricao: 'Pagamento recebido',
      valor: 1680,
      nomeBanco: 'Cora',
      numero: 'abc-123',
      codCliente: '00000149',
      proc: '155',
    });
    expect(item.id).toBe(42);
    expect(item.contaCodigo).toBe('A');
    expect(item.dataLancamento).toBe('2026-06-18');
    expect(item.natureza).toBe('CREDITO');
    expect(item.bancoNome).toBe('Cora');
  });
});
