import { describe, expect, it } from 'vitest';
import {
  mergeExtratoApiComLocal,
  parseOfxToExtrato,
  readOfxFileAsText,
  sanitizarLancamentoImportacaoExtrato,
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
        eloFinanceiroId: 5,
        classificacaoFinanceiraId: 6,
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
    expect(limpo._financeiroMeta.eloFinanceiroId).toBeNull();
    expect(limpo._financeiroMeta.classificacaoFinanceiraId).toBeNull();
    expect(limpo.descricao).toBe('X');
    expect(limpo.valor).toBe(-10);
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
