import { describe, expect, it } from 'vitest';
import {
  mergeExtratoApiComLocal,
  mergeExtratoBancario,
  parseOfxToExtrato,
  readOfxFileAsText,
  sanitizarLancamentoImportacaoExtrato,
  contarLancamentosNovos,
  listarLancamentosNovosDedupe,
  analisarLancamentosNovosDedupe,
  diasIgnorarPorContagemIgual,
  chaveSemanticaLancamento,
  valorCentavosAssinadoDedupe,
  normalizarDescricaoParaDedupe,
} from './ofx.js';

describe('sanitizarLancamentoImportacaoExtrato', () => {
  it('zera vínculos e colunas à direita (Cód., Proc., Ref., Eq., Parcela, meta API)', () => {
    const sujo = {
      numero: '1',
      data: '01/01/2026',
      descricao: 'X',
      valor: -10,
      letra: 'N',
      codCliente: '00000090',
      proc: '0001',
      ref: 'R',
      eq: 'E1',
      dimensao: 'D1',
      parcela: 'P1',
      categoria: 'cat',
      apiId: 99,
      clienteId: 1,
      processoId: 2,
      _financeiroMeta: {
        clienteId: 3,
        processoId: 4,
      },
    };
    const limpo = sanitizarLancamentoImportacaoExtrato(sujo);
    expect(limpo.apiId).toBeUndefined();
    expect(limpo.codCliente).toBe('');
    expect(limpo.proc).toBe('');
    expect(limpo.ref).toBe('');
    expect(limpo.eq).toBe('');
    expect(limpo.dimensao).toBe('');
    expect(limpo.parcela).toBe('');
    expect(limpo.categoria).toBe('');
    expect(limpo.clienteId).toBeNull();
    expect(limpo.processoId).toBeNull();
    expect(limpo._financeiroMeta.clienteId).toBeNull();
    expect(limpo._financeiroMeta.processoId).toBeNull();
    expect(limpo.descricao).toBe('X');
    expect(limpo.valor).toBe(-10);
  });
});

describe('mergeExtratoBancario (mesclar OFX/PDF com extrato)', () => {
  const linha = (numero, data, valor) => ({
    letra: 'N',
    numero,
    data,
    valor,
    descricao: 'x',
    saldo: 0,
    origemImportacao: 'OFX',
  });

  it('mantém duas linhas idênticas quando ambas vêm só do arquivo novo (transações reais repetidas)', () => {
    const existente = [linha('A', '01/01/2026', 10)];
    const novo = [linha('B', '02/01/2026', -5), linha('B', '02/01/2026', -5)];
    const m = mergeExtratoBancario(existente, novo);
    expect(m.filter((t) => t.numero === 'B' && t.data === '02/01/2026')).toHaveLength(2);
    expect(contarLancamentosNovos(existente, novo)).toBe(2);
    expect(listarLancamentosNovosDedupe(existente, novo)).toHaveLength(2);
  });

  it('ignora REND com sufixo APR (planilha) vs MAIS (OFX)', () => {
    const existente = [
      {
        numero: 'PL-1',
        data: '06/05/2026',
        valor: 0.14,
        descricao: 'REND PAGO APLIC AUT APR',
      },
    ];
    const novo = [
      {
        numero: '20260506001',
        data: '06/05/2026',
        valor: 0.14,
        descricao: 'REND PAGO APLIC AUT MAIS',
        origemImportacao: 'OFX',
      },
    ];
    expect(listarLancamentosNovosDedupe(existente, novo)).toHaveLength(0);
  });

  it('ignora TED com pontos na planilha e espaços no OFX', () => {
    const existente = [
      {
        numero: 'PL-2',
        data: '18/05/2026',
        valor: 18000,
        descricao: 'TED 208.0001.ITAMAR A F',
      },
    ];
    const novo = [
      {
        numero: '20260518001',
        data: '18/05/2026',
        valor: 18000,
        descricao: 'TED 208 0001 ITAMAR A F',
        origemImportacao: 'OFX',
      },
    ];
    expect(listarLancamentosNovosDedupe(existente, novo)).toHaveLength(0);
  });

  it('segundo OFX no mesmo dia só acrescenta linhas novas (FITID)', () => {
    const existente = [
      { numero: 'fit-1', data: '19/05/2026', valor: -5000, descricao: 'PIX A', origemImportacao: 'OFX' },
    ];
    const ofxTarde = [
      { numero: 'fit-1', data: '19/05/2026', valor: -5000, descricao: 'PIX A', origemImportacao: 'OFX' },
      { numero: 'fit-2', data: '19/05/2026', valor: 100, descricao: 'PIX B', origemImportacao: 'OFX' },
    ];
    expect(listarLancamentosNovosDedupe(existente, ofxTarde)).toHaveLength(1);
    expect(listarLancamentosNovosDedupe(existente, ofxTarde)[0].numero).toBe('fit-2');
  });

  it('PDF com dois saques iguais inclui ambos quando banco vazio', () => {
    const novo = [
      {
        numero: 'SICOOB-PDF-00002-abc',
        data: '24/04/2026',
        valor: -2000,
        descricao: 'SAQ S/ CARTÃO (DOC.: 0003ATM)',
        origemImportacao: 'PDF',
      },
      {
        numero: 'SICOOB-PDF-00003-def',
        data: '24/04/2026',
        valor: -2000,
        descricao: 'SAQ S/ CARTÃO (DOC.: 0003ATM)',
        origemImportacao: 'PDF',
      },
    ];
    expect(listarLancamentosNovosDedupe([], novo)).toHaveLength(2);
  });

  it('PDF com dois saques iguais inclui o segundo quando banco tem só um', () => {
    const existente = [
      {
        numero: 'SICOOB-PDF-00002-abc',
        data: '24/04/2026',
        valor: -2000,
        descricao: 'SAQ S/ CARTÃO (DOC.: 0003ATM)',
        origemImportacao: 'PDF',
      },
    ];
    const novo = [
      {
        numero: 'SICOOB-PDF-00002-abc',
        data: '24/04/2026',
        valor: -2000,
        descricao: 'SAQ S/ CARTÃO (DOC.: 0003ATM)',
        origemImportacao: 'PDF',
      },
      {
        numero: 'SICOOB-PDF-00003-def',
        data: '24/04/2026',
        valor: -2000,
        descricao: 'SAQ S/ CARTÃO (DOC.: 0003ATM)',
        origemImportacao: 'PDF',
      },
    ];
    const r = listarLancamentosNovosDedupe(existente, novo, { respeitarExtratoComoMestre: true });
    expect(r).toHaveLength(1);
    expect(r[0].numero).toBe('SICOOB-PDF-00003-def');
  });

  it('ignora OFX quando planilha já tem mesmo data+valor+descrição (formato diferente)', () => {
    const existente = [
      {
        numero: 'PL-abc',
        data: '07/05/2026',
        valor: 339.5,
        descricao: 'PIX TRANSF CONDOMI07/05',
        origemImportacao: 'PLANILHA',
      },
      {
        numero: 'PL-def',
        data: '07/05/2026',
        valor: 725.1,
        descricao: 'PIX TRANSF VRV SOL07/05',
        origemImportacao: 'PLANILHA',
      },
    ];
    const novo = [
      {
        numero: 'ofx-1',
        data: '07/05/2026',
        valor: 339.5,
        descricao: 'PIX TRANSF CONDOMI07 05',
        origemImportacao: 'OFX',
      },
      {
        numero: 'ofx-2',
        data: '07/05/2026',
        valor: 725.1,
        descricao: 'PIX TRANSF VRV SOL07 05',
        origemImportacao: 'OFX',
      },
      {
        numero: 'ofx-3',
        data: '07/05/2026',
        valor: -100,
        descricao: 'LANÇAMENTO NOVO',
        origemImportacao: 'OFX',
      },
    ];
    expect(normalizarDescricaoParaDedupe('PIX TRANSF CONDOMI07/05')).toBe(
      normalizarDescricaoParaDedupe('PIX TRANSF CONDOMI07 05'),
    );
    expect(listarLancamentosNovosDedupe(existente, novo)).toHaveLength(1);
    expect(contarLancamentosNovos(existente, novo)).toBe(1);
    expect(chaveSemanticaLancamento(existente[0])).toBe(chaveSemanticaLancamento(novo[0]));
  });

  it('ignora linhas do arquivo novo que já existem no extrato; não usa duplicata interna do novo para pular a segunda', () => {
    const existente = [linha('X', '03/01/2026', 100)];
    const novo = [linha('X', '03/01/2026', 100), linha('Y', '04/01/2026', 20)];
    const m = mergeExtratoBancario(existente, novo);
    expect(m.filter((t) => t.numero === 'X').length).toBe(1);
    expect(m.some((t) => t.numero === 'Y')).toBe(true);
    expect(contarLancamentosNovos(existente, novo)).toBe(1);
    expect(listarLancamentosNovosDedupe(existente, novo)).toHaveLength(1);
  });

  it('ignora dia inteiro quando contagem coincide (último dia no banco = 12/05, FITIDs diferentes)', () => {
    const existente = [
      { numero: 'old-1', data: '12/05/2026', valor: -11120.48, descricao: 'Pix enviada', origemImportacao: 'OFX' },
      { numero: 'old-2', data: '12/05/2026', valor: -130.12, descricao: 'Boleto equatorial', origemImportacao: 'OFX' },
      { numero: 'old-3', data: '12/05/2026', valor: 105, descricao: 'Pagamento Maria', origemImportacao: 'OFX' },
      { numero: 'old-4', data: '12/05/2026', valor: 1605.6, descricao: 'Pagamento Bianca', origemImportacao: 'OFX' },
      { numero: 'old-5', data: '12/05/2026', valor: 2940, descricao: 'Pagamento Sergio', origemImportacao: 'OFX' },
      { numero: 'old-6', data: '12/05/2026', valor: 1600, descricao: 'Pagamento Maria 2', origemImportacao: 'OFX' },
      { numero: 'old-7', data: '12/05/2026', valor: 5000, descricao: 'Pix recebida', origemImportacao: 'OFX' },
      { numero: 'old-8', data: '11/05/2026', valor: -100, descricao: 'Dia anterior', origemImportacao: 'OFX' },
    ];
    const ofxMes = [
      { numero: '40198c8d', data: '01/05/2026', valor: 10, descricao: 'Maio inicio', origemImportacao: 'OFX' },
      { numero: 'fit-12-1', data: '12/05/2026', valor: -11120.48, descricao: 'Transf Pix enviada', origemImportacao: 'OFX' },
      { numero: 'fit-12-2', data: '12/05/2026', valor: -130.12, descricao: 'Boleto pago Equatorial', origemImportacao: 'OFX' },
      { numero: 'fit-12-3', data: '12/05/2026', valor: 105, descricao: 'Pagamento recebido Maria', origemImportacao: 'OFX' },
      { numero: 'fit-12-4', data: '12/05/2026', valor: 1605.6, descricao: 'Pagamento recebido Bianca', origemImportacao: 'OFX' },
      { numero: 'fit-12-5', data: '12/05/2026', valor: 2940, descricao: 'Pagamento recebido Sergio', origemImportacao: 'OFX' },
      { numero: 'fit-12-6', data: '12/05/2026', valor: 1600, descricao: 'Pagamento recebido Maria', origemImportacao: 'OFX' },
      { numero: 'fit-12-7', data: '12/05/2026', valor: 5000, descricao: 'Transf Pix recebida', origemImportacao: 'OFX' },
      { numero: 'fit-13-1', data: '13/05/2026', valor: 1000, descricao: 'Dia novo', origemImportacao: 'OFX' },
    ];
    expect(diasIgnorarPorContagemIgual(existente, ofxMes)).toEqual(new Set(['2026-05-12']));
    expect(listarLancamentosNovosDedupe(existente, ofxMes)).toHaveLength(2);
    const analise = analisarLancamentosNovosDedupe(existente, ofxMes);
    expect(analise.diasIgnoradosPorContagem).toEqual(['2026-05-12']);
    expect(analise.porDia.get('2026-05-12')?.ignoradosContagemDia).toBe(7);
  });

  it('no dia de fronteira, se contagem difere, ainda importa lançamentos não pareados', () => {
    const existente = [
      { numero: 'a', data: '12/05/2026', valor: 100, descricao: 'x', origemImportacao: 'OFX' },
      { numero: 'b', data: '12/05/2026', valor: 200, descricao: 'y', origemImportacao: 'OFX' },
    ];
    const novo = [
      { numero: 'c', data: '12/05/2026', valor: 100, descricao: 'x', origemImportacao: 'OFX' },
      { numero: 'd', data: '12/05/2026', valor: 200, descricao: 'y', origemImportacao: 'OFX' },
      { numero: 'e', data: '12/05/2026', valor: 300, descricao: 'z novo', origemImportacao: 'OFX' },
    ];
    expect(listarLancamentosNovosDedupe(existente, novo)).toHaveLength(1);
    expect(listarLancamentosNovosDedupe(existente, novo)[0].numero).toBe('e');
  });

  it('BB jan/2021: crédito poupança +680,01 importa mesmo com PIX -680,01 já no banco', () => {
    const existente = [
      {
        numero: '202101251680010',
        data: '25/01/2021',
        valor: -680.01,
        descricao: 'PIX - Enviado - 25/01 15:42 Itamar Alexandre F V Real',
        origemImportacao: 'OFX',
      },
    ];
    const novo = [
      {
        numero: '202101250680010',
        data: '25/01/2021',
        valor: 680.01,
        descricao: 'Transferido da poupança - 25/01 0324 453259-7 ITAMAR A F V R',
        origemImportacao: 'OFX',
      },
      {
        numero: '202101251680010',
        data: '25/01/2021',
        valor: -680.01,
        descricao: 'PIX - Enviado - 25/01 15:42 Itamar Alexandre F V Real',
        origemImportacao: 'OFX',
      },
    ];
    const analise = analisarLancamentosNovosDedupe(existente, novo, {
      numerosExistentes: new Set(['202101251680010']),
    });
    expect(analise.novos).toHaveLength(1);
    expect(analise.novos[0].numero).toBe('202101250680010');
    expect(analise.novos[0].valor).toBe(680.01);
    expect(analise.ignorados).toBe(1);
  });

  it('valorCentavosAssinadoDedupe distingue crédito e débito no mesmo |valor|', () => {
    expect(valorCentavosAssinadoDedupe({ valor: 680.01, natureza: 'DEBITO' })).toBe(-68001);
    expect(valorCentavosAssinadoDedupe({ valor: 680.01, natureza: 'CREDITO' })).toBe(68001);
    expect(valorCentavosAssinadoDedupe({ valor: -680.01 })).toBe(-68001);
    expect(chaveSemanticaLancamento({ data: '25/01/2021', valor: 680.01, natureza: 'CREDITO', descricao: 'a' })).not.toBe(
      chaveSemanticaLancamento({ data: '25/01/2021', valor: 680.01, natureza: 'DEBITO', descricao: 'b' })
    );
  });
});

describe('mergeExtratoApiComLocal', () => {
  it('com lista da API vazia, não reidrata cache local com linhas que já tinham apiId (removidas no servidor)', () => {
    const local = [
      { numero: 'a', data: '01/01/2026', valor: -10, apiId: 1001, letra: 'N' },
      { numero: 'b', data: '02/01/2026', valor: 20, letra: 'N' },
    ];
    const merged = mergeExtratoApiComLocal([], local);
    expect(merged.length).toBe(1);
    expect(merged[0].numero).toBe('b');
  });

  it('com API vazia, descarta linha local que só expõe id (legado) em vez de apiId', () => {
    const local = [{ numero: 'x', data: '03/01/2026', valor: 5, id: 2002, letra: 'N' }];
    const merged = mergeExtratoApiComLocal([], local);
    expect(merged).toHaveLength(0);
  });

  it('linha API com origem OFX não herda Cód./Proc. do cache local na mesma chave', () => {
    const apiRows = [
      {
        numero: 'fit-1',
        data: '08/04/2026',
        valor: -100,
        letra: 'N',
        origemImportacao: 'OFX',
        codCliente: '',
        proc: '',
        apiId: 1,
      },
    ];
    const localRows = [
      {
        numero: 'fit-1',
        data: '08/04/2026',
        valor: -100,
        letra: 'N',
        codCliente: '00000076',
        proc: '0006',
        apiId: 1,
      },
    ];
    const merged = mergeExtratoApiComLocal(apiRows, localRows);
    expect(merged).toHaveLength(1);
    expect(merged[0].codCliente).toBe('');
    expect(merged[0].proc).toBe('');
  });

  it('linha API OFX com vínculo gravado mantém Cód./Proc. ao mesclar com cache local', () => {
    const apiRows = [
      {
        numero: 'fit-1',
        data: '08/04/2026',
        valor: -100,
        letra: 'A',
        origemImportacao: 'OFX',
        codCliente: '00000938',
        proc: '0017',
        apiId: 1,
        _financeiroMeta: { clienteId: 938, processoId: 17, contaContabilId: 1 },
      },
    ];
    const localRows = [
      {
        numero: 'fit-1',
        data: '08/04/2026',
        valor: -100,
        letra: 'A',
        codCliente: '',
        proc: '',
        apiId: 1,
      },
    ];
    const merged = mergeExtratoApiComLocal(apiRows, localRows);
    expect(merged[0].codCliente).toBe('00000938');
    expect(merged[0].proc).toBe('0017');
    expect(merged[0]._financeiroMeta.clienteId).toBe(938);
  });
});

describe('parseOfxToExtrato (Cora / UTF-8)', () => {
  it('marca origem OFX e não preenche colunas de vínculo (ex.: FITID UUID no MEMO)', () => {
    const text = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260408000000[0:GMT]</DTPOSTED><TRNAMT>-135.91</TRNAMT><FITID>5ee9d135-b3b9-423f-a8e3-fe40745322e5</FITID><MEMO>Boleto pago - Equatorial</MEMO></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const rows = parseOfxToExtrato(text, { nomeBanco: 'CORA' });
    expect(rows.length).toBe(1);
    expect(rows[0].origemImportacao).toBe('OFX');
    expect(rows[0].codCliente).toBe('');
    expect(rows[0].proc).toBe('');
    expect(rows[0].ref).toBe('');
    expect(rows[0].eq).toBe('');
    expect(rows[0].numero).toBe('5ee9d135-b3b9-423f-a8e3-fe40745322e5');
  });

  it('com CHECKNUM 0 não ignora FITID (Cora / placeholder)', () => {
    const text = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260330000000[0:GMT]</DTPOSTED><TRNAMT>10.00</TRNAMT><FITID>cora-abc-1</FITID><CHECKNUM>0</CHECKNUM><MEMO>CR LV OR E</MEMO></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const rows = parseOfxToExtrato(text);
    expect(rows[0].numero).toBe('cora-abc-1');
    expect(rows[0].descricao).toBe('CR LV OR E');
  });

  it('sem FITID e CHECKNUM só zeros: usa ofx-N por transação no arquivo', () => {
    const text = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260330000000</DTPOSTED><TRNAMT>1</TRNAMT><CHECKNUM>0</CHECKNUM><MEMO>CR LV OR E</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260330000000</DTPOSTED><TRNAMT>2</TRNAMT><CHECKNUM>000</CHECKNUM><MEMO>CR LV OR E</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260330000000</DTPOSTED><TRNAMT>3</TRNAMT><CHECKNUM>0</CHECKNUM><MEMO>CR LV OR E</MEMO></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const rows = parseOfxToExtrato(text);
    expect(rows.map((r) => r.numero).sort()).toEqual(['ofx-1', 'ofx-2', 'ofx-3']);
  });

  it('FITID 0 (Caixa CR LV OR E): gera ofx-N distintos, sem colidir com FITID real', () => {
    const text = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260601120000</DTPOSTED><TRNAMT>1052.00</TRNAMT><FITID>0</FITID><CHECKNUM>0</CHECKNUM><MEMO>CR LV OR E</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260601120000</DTPOSTED><TRNAMT>4394.42</TRNAMT><FITID>0</FITID><CHECKNUM>0</CHECKNUM><MEMO>CR LV OR E</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260616120000</DTPOSTED><TRNAMT>4022.80</TRNAMT><FITID>14</FITID><CHECKNUM>14</CHECKNUM><MEMO>CR LEV JUD</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260616120000</DTPOSTED><TRNAMT>38.97</TRNAMT><FITID>0</FITID><CHECKNUM>0</CHECKNUM><MEMO>CR LV OR E</MEMO></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const rows = parseOfxToExtrato(text);
    const numeros = rows.map((r) => r.numero);
    expect(new Set(numeros).size).toBe(numeros.length);
    expect(numeros).toContain('14');
    expect(numeros).toContain('ofx-1');
    expect(numeros).toContain('ofx-2');
    expect(numeros).toContain('ofx-4');
  });

  it('FITID repetido no mesmo arquivo (Caixa CRED TED): sufixa com índice da linha', () => {
    const text = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260602120000</DTPOSTED><TRNAMT>799.35</TRNAMT><FITID>1</FITID><CHECKNUM>1</CHECKNUM><MEMO>CRED TED</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260602120000</DTPOSTED><TRNAMT>67.57</TRNAMT><FITID>1</FITID><CHECKNUM>1</CHECKNUM><MEMO>CRED TED</MEMO></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const rows = parseOfxToExtrato(text);
    expect(rows[0].numero).toBe('1');
    expect(rows[1].numero).toBe('1-2');
  });

  it('CHECKNUM real sem FITID continua como número do lançamento', () => {
    const text = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260101000000</DTPOSTED><TRNAMT>-5</TRNAMT><CHECKNUM>000042</CHECKNUM><MEMO>Cheque</MEMO></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const rows = parseOfxToExtrato(text);
    expect(rows[0].numero).toBe('000042');
  });

  it('OFX Sicoob VRV (internet banking, FITID composto data+valor)', () => {
    const text = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
ENCODING:USASCII
CHARSET:1252
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20260529120000[-3:BRT]</DTPOSTED>
<TRNAMT>2836.75</TRNAMT>
<FITID>202605292836751</FITID>
<CHECKNUM>0</CHECKNUM>
<MEMO>PIX RECEBIDO - OUTRA IF</MEMO>
<NAME>Recebimento Pix TERRA MUNDI ANAP</NAME>
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260511120000[-3:BRT]</DTPOSTED>
<TRNAMT>-2000.00</TRNAMT>
<FITID>202605112000001</FITID>
<CHECKNUM>0003</CHECKNUM>
<MEMO>SAQUE SEM CARTÃO</MEMO>
<NAME>SAQ.DIG. NOME: VRV SOLUCOES LTDA</NAME>
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const rows = parseOfxToExtrato(text, { nomeBanco: 'Sicoob VRV' });
    expect(rows).toHaveLength(2);
    const pix = rows.find((r) => r.numero === '202605292836751');
    const saque = rows.find((r) => r.numero === '202605112000001');
    expect(pix?.data).toBe('29/05/2026');
    expect(pix?.descricao).toBe('Recebimento Pix TERRA MUNDI ANAP');
    expect(pix?.descricaoDetalhada).toBe('CREDIT — PIX RECEBIDO - OUTRA IF');
    expect(saque?.valor).toBe(-2000);
    expect(saque?.descricao).toBe('SAQ.DIG. NOME: VRV SOLUCOES LTDA');
  });

  it('OFX Sicoob: NAME com contraparte aparece na descrição principal', () => {
    const text = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20260227120000[-3:BRT]</DTPOSTED>
<TRNAMT>4500.00</TRNAMT>
<FITID>202602274500001</FITID>
<MEMO>PIX RECEBIDO - OUTRA IF</MEMO>
<NAME>Recebimento Pix MICHELLE APARECI</NAME>
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const rows = parseOfxToExtrato(text);
    expect(rows[0].descricao).toBe('Recebimento Pix MICHELLE APARECI');
    expect(rows[0].descricaoDetalhada).toContain('PIX RECEBIDO - OUTRA IF');
  });

  it('OFX Itaú: MEMO detalhado permanece na descrição quando NAME é genérico', () => {
    const text = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260203120000</DTPOSTED>
<TRNAMT>-89.90</TRNAMT>
<FITID>ITAU1</FITID>
<NAME>PIX ENVIADO</NAME>
<MEMO>PIX QR ESTATICA - RECEBEDOR ***12345678900</MEMO>
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const rows = parseOfxToExtrato(text);
    expect(rows[0].descricao).toBe('PIX QR ESTATICA - RECEBEDOR ***12345678900');
    expect(rows[0].descricaoDetalhada).toBe('DEBIT — PIX ENVIADO');
  });
});

describe('readOfxFileAsText', () => {
  it('usa CHARSET 1252 do cabeçalho OFX para MEMO com acentos', async () => {
    const memoLatin = new Uint8Array([
      0x54, 0x72, 0x61, 0x6e, 0x73, 0x66, 0x65, 0x72, 0xea, 0x6e, 0x63, 0x69, 0x61, 0x20, 0x64, 0x65, 0x20, 0x43,
      0x72, 0xe9, 0x64, 0x69, 0x74, 0x6f,
    ]);
    const header = new TextEncoder().encode(
      'OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nENCODING:USASCII\nCHARSET:1252\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST><STMTTRN><MEMO>'
    );
    const footer = new TextEncoder().encode(
      '</MEMO><TRNAMT>1</TRNAMT><DTPOSTED>20260101000000</DTPOSTED><FITID>1</FITID></STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>'
    );
    const total = new Uint8Array(header.length + memoLatin.length + footer.length);
    total.set(header, 0);
    total.set(memoLatin, header.length);
    total.set(footer, header.length + memoLatin.length);
    const file = new File([total], 'bb.ofx');
    const text = await readOfxFileAsText(file);
    expect(text).toContain('Transferência');
    expect(text).toContain('Crédito');
    const tx = parseOfxToExtrato(text, { nomeBanco: 'BB' });
    expect(tx[0].descricao).toBe('Transferência de Crédito');
  });

  it('sem CHARSET: se UTF-8 inválido, faz fallback para Windows-1252', async () => {
    const memoLatin = new Uint8Array([0x54, 0x65, 0x73, 0x74, 0x65, 0x20, 0xe9, 0x20, 0x63, 0x6f, 0x72, 0x72, 0x65, 0x74, 0x6f]);
    const header = new TextEncoder().encode(
      'OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nENCODING:USASCII\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST><STMTTRN><MEMO>'
    );
    const footer = new TextEncoder().encode(
      '</MEMO><TRNAMT>1</TRNAMT><DTPOSTED>20260101000000</DTPOSTED><FITID>x</FITID></STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>'
    );
    const total = new Uint8Array(header.length + memoLatin.length + footer.length);
    total.set(header, 0);
    total.set(memoLatin, header.length);
    total.set(footer, header.length + memoLatin.length);
    const file = new File([total], 'x.ofx');
    const text = await readOfxFileAsText(file);
    expect(text).toContain('Teste é correto');
  });
});
