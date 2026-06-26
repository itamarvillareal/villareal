import { describe, expect, it } from 'vitest';
import { parseOfxContaBancaria } from './ofx.js';
import {
  formatarRotuloContaOfx,
  identificarContaPorOfx,
  validarOfxParaContaDestino,
} from './ofxContaValidacao.js';

const OFX_SICOOB_VRV = `<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKACCTFROM>
<BANKID>756</BANKID>
<BRANCHID>5024-5</BRANCHID>
<ACCTID>2754-5</ACCTID>
<ACCTTYPE>CHECKING</ACCTTYPE>
</BANKACCTFROM>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

const BANCOS = [
  { nome: 'Itaú', numero: 1 },
  {
    nome: 'CEF',
    numero: 5,
    ofxBankId: '104',
    ofxAgencia: null,
    ofxConta: '0007770852952',
  },
  {
    nome: 'Sicoob VRV',
    numero: 29,
    ofxBankId: '756',
    ofxAgencia: '5024-5',
    ofxConta: '2754-5',
  },
  {
    nome: 'Sicoob JA',
    numero: 31,
    ofxBankId: '756',
    ofxAgencia: '5024-5',
    ofxConta: '31707-1',
  },
  { nome: 'Bradesco', numero: 2 },
];

const OFX_SICOOB_JA = `<BANKACCTFROM><BANKID>756</BANKID><BRANCHID>5024-5</BRANCHID><ACCTID>31707-1</ACCTID></BANKACCTFROM>`;

const OFX_CEF = `<OFX>
<BANKACCTFROM>
<BANKID>0104</BANKID>
<ACCTID>0007770852952</ACCTID>
<ACCTTYPE>CHECKING</ACCTTYPE>
</BANKACCTFROM>
</OFX>`;

describe('parseOfxContaBancaria', () => {
  it('extrai BANKID, agência e conta do BANKACCTFROM', () => {
    expect(parseOfxContaBancaria(OFX_SICOOB_VRV)).toEqual({
      bankId: '756',
      agencia: '5024-5',
      conta: '2754-5',
      acctType: 'CHECKING',
    });
  });
});

describe('validarOfxParaContaDestino', () => {
  const ofxConta = parseOfxContaBancaria(OFX_SICOOB_VRV);

  it('aceita quando destino coincide com cadastro', () => {
    const res = validarOfxParaContaDestino(ofxConta, BANCOS[2], BANCOS);
    expect(res.ok).toBe(true);
  });

  it('bloqueia e sugere conta correta quando destino é outro banco', () => {
    const res = validarOfxParaContaDestino(ofxConta, BANCOS[0], BANCOS);
    expect(res.ok).toBe(false);
    expect(res.contaSugerida).toEqual({ nome: 'Sicoob VRV', numero: 29 });
    expect(res.message).toContain('Sicoob VRV');
  });

  it('identifica conta pelo OFX', () => {
    expect(identificarContaPorOfx(ofxConta, BANCOS)?.nome).toBe('Sicoob VRV');
    expect(formatarRotuloContaOfx(BANCOS[2])).toBe('756 / 5024-5 / 2754-5');
  });

  it('aceita CEF com BANKID 0104 (normalizado para 104)', () => {
    const ofxCef = parseOfxContaBancaria(OFX_CEF);
    const res = validarOfxParaContaDestino(ofxCef, BANCOS[1], BANCOS);
    expect(res.ok).toBe(true);
    expect(identificarContaPorOfx(ofxCef, BANCOS)?.nome).toBe('CEF');
  });

  it('aceita Sicoob JA com conta 31707-1', () => {
    const ofxJa = parseOfxContaBancaria(OFX_SICOOB_JA);
    const bancoJa = BANCOS.find((b) => b.nome === 'Sicoob JA');
    expect(validarOfxParaContaDestino(ofxJa, bancoJa, BANCOS).ok).toBe(true);
    expect(identificarContaPorOfx(ofxJa, BANCOS)?.nome).toBe('Sicoob JA');
  });

  it('distingue Sicoob JA de Sicoob VRV na mesma agência', () => {
    const ofxJa = parseOfxContaBancaria(OFX_SICOOB_JA);
    const vrv = BANCOS.find((b) => b.nome === 'Sicoob VRV');
    expect(validarOfxParaContaDestino(ofxJa, vrv, BANCOS).ok).toBe(false);
  });
});
