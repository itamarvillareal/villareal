import { describe, it, expect } from 'vitest';
import { validateCPF } from './cpfValidatorService.js';
import { parseBrazilianDate } from './dateParserService.js';
import {
  extrairDadosDeTextoLivre,
  resolverDocumentoParaFormulario,
} from './personTextAutofillService.js';

const CNPJ_FIXTURE = '04.252.011/0001-10';
const CPF_REPRESENTANTE = '390.533.447-05';

describe('validateCPF', () => {
  it('aceita CPF válido', () => {
    expect(validateCPF('390.533.447-05').valido).toBe(true);
    expect(validateCPF('39053344705').valido).toBe(true);
  });
  it('rejeita CPF inválido', () => {
    expect(validateCPF('111.111.111-11').valido).toBe(false);
  });
});

describe('parseBrazilianDate', () => {
  it('converte dd/mm/aaaa', () => {
    expect(parseBrazilianDate('4', '10', '2002')).toBe('2002-10-04');
  });
});

describe('extrairDadosDeTextoLivre — casos obrigatórios', () => {
  it('caso 1: texto estruturado', () => {
    const t =
      'Nome completo: Elizeu Souza de Oliveira\nCPF: 390.533.447-05\nRG: 3834914 DGPC GO\nData de nascimento: 04/10/2002';
    const r = extrairDadosDeTextoLivre(t);
    expect(r.nomeCompleto).toMatch(/Elizeu Souza de Oliveira/i);
    expect(r.cpf).toBeTruthy();
    expect(r.rg).toMatch(/3834914/i);
    expect(r.dataNascimento).toBe('2002-10-04');
    expect(r.sucesso).toBe(true);
  });

  it('caso 2: texto jurídico corrido', () => {
    const t =
      'ELIZEU SOUZA DE OLIVEIRA ("ELIZEU"), brasileiro, casado, empresário, portador da cédula de identidade n. 3843914 DGPC/GO, inscrito no CPF sob o n. 921.130.101-79, residente e domiciliado na Avenida Maranhão, Quadra 64B, Lote 30, Apto. 1702, Edifício Residencial Montpellier, Bairro Jundiaí, Anápolis/GO, CEP 75.114-150, endereço eletrônico: elizeu0419@gmail.com;';
    const r = extrairDadosDeTextoLivre(t);
    expect(r.nomeCompleto).toMatch(/ELIZEU SOUZA DE OLIVEIRA/i);
    expect(r.rg).toMatch(/3843914.*DGPC/i);
    expect(validateCPF('921.130.101-79').valido).toBe(false);
    expect(r.cpf).toBeNull();
    expect(r.nacionalidade).toBe('Brasileiro');
    expect(r.estadoCivil).toBe('casado');
    expect(r.profissao).toMatch(/^Empres[aá]rio$/i);
    expect(r.endereco).toBeTruthy();
    expect(r.endereco.estado).toBe('GO');
    expect(r.endereco.cidade).toMatch(/Anápolis/i);
    expect(r.endereco.cep).toBe('75114150');
    expect(r.endereco.rua).toMatch(/Avenida Maranhão/i);
    expect(r.email).toBe('elizeu0419@gmail.com');
    expect(r.preenchidos.email).toBe(true);
  });

  it('só e-mail no texto: preenche e conta como sucesso', () => {
    const r = extrairDadosDeTextoLivre('Contato: teste.user@exemplo.com.br');
    expect(r.email).toBe('teste.user@exemplo.com.br');
    expect(r.sucesso).toBe(true);
    expect(r.preenchidos.email).toBe(true);
  });

  it('qualificação por rótulos', () => {
    const r = extrairDadosDeTextoLivre(
      'Fulana de Tal. Nacionalidade: brasileira. Estado civil: divorciada. Profissão: professora.'
    );
    expect(r.nacionalidade).toBe('Brasileira');
    expect(r.estadoCivil).toBe('divorciado');
    expect(r.profissao).toMatch(/Professora/i);
  });

  it('caso 3: parcial', () => {
    const t = 'Elizeu Souza de Oliveira, CPF 39053344705';
    const r = extrairDadosDeTextoLivre(t);
    expect(r.nomeCompleto).toMatch(/Elizeu/i);
    expect(r.cpf).toBeTruthy();
    expect(r.rg).toBeNull();
    expect(r.dataNascimento).toBeNull();
  });

  it('caso 4: vazio', () => {
    const r = extrairDadosDeTextoLivre('');
    expect(r.sucesso).toBe(false);
    expect(r.avisos.some((a) => /vazio/i.test(a))).toBe(true);
  });

  it('multilinha: remove parágrafos antes da extração (nome e CPF em linhas diferentes)', () => {
    const t = 'ELIZEU SOUZA DE\nOLIVEIRA, CPF 390.533.447-05';
    const r = extrairDadosDeTextoLivre(t);
    expect(r.nomeCompleto).toMatch(/ELIZEU SOUZA DE OLIVEIRA/i);
    expect(r.cpf).toBeTruthy();
    expect(r.textoNormalizado).toMatch(/ELIZEU SOUZA DE OLIVEIRA, CPF 390\.533\.447-05/);
  });

  it('caso PJ: sociedade de advocacia com CNPJ e sede', () => {
    const t =
      'VIVIAN GARCIA CARRIJO MATIAS SOCIEDADE INDIVIDUAL DE ADVOCACIA, pessoa jurídica de direito privado, inscrita na OAB/GO sob n.º 6434, CNPJ sob n.º 54.635.015/0001 -55, com sede na Avenida Senador José Lourenço Dias, nº 1440, Edifício London Eye Offices, Sala 1301, andar 13, Centro, Anápolis/GO, CEP: 75020 -010, neste ato representada por sua titular, advogada inscrita na OAB/GO sob n.º 71.086';
    const r = extrairDadosDeTextoLivre(t);
    expect(r.tipoPessoa).toBe('juridica');
    expect(r.nomeCompleto).toBe(
      'VIVIAN GARCIA CARRIJO MATIAS SOCIEDADE INDIVIDUAL DE ADVOCACIA'
    );
    expect(r.cnpj).toBe('54.635.015/0001-55');
    expect(r.cpf).toBeNull();
    expect(r.rg).toBeNull();
    expect(r.dataNascimento).toBeNull();
    expect(r.nacionalidade).toBeNull();
    expect(r.estadoCivil).toBeNull();
    expect(r.email).toBeNull();
    expect(r.endereco).toBeTruthy();
    expect(r.endereco.rua).toBe('Avenida Senador José Lourenço Dias');
    expect(r.endereco.numero).toBe('1440');
    expect(r.endereco.complemento).toBe(
      'Edifício London Eye Offices, Sala 1301, andar 13'
    );
    expect(r.endereco.bairro).toBe('Centro');
    expect(r.endereco.cidade).toBe('Anápolis');
    expect(r.endereco.estado).toBe('GO');
    expect(r.endereco.cepFormatado).toBe('75020-010');
    expect(r.sucesso).toBe(true);
    expect(r.avisos.join(' ')).not.toMatch(
      /nome completo|CPF|RG|data de nascimento|nacionalidade|estado civil|profissão|e-mail/i
    );
  });

  it('PJ com representante PF: Documento recebe CNPJ, não CPF do representante', () => {
    const t = `CONSTRUTORA HORIZONTE LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o n.º ${CNPJ_FIXTURE}, com sede na Rua Alpha, nº 100, São Paulo/SP, CEP 01310-100, neste ato representada por João Silva, CPF ${CPF_REPRESENTANTE}`;
    const r = extrairDadosDeTextoLivre(t);
    expect(r.tipoPessoa).toBe('juridica');
    expect(r.cnpj).toBe(CNPJ_FIXTURE);
    expect(r.cpf).toBeTruthy();
    expect(validateCPF(r.cpf).valido).toBe(true);
    const doc = resolverDocumentoParaFormulario(r);
    expect(doc.documento).toBe(CNPJ_FIXTURE);
    expect(doc.preferiuCnpj).toBe(true);
    expect(doc.documento).not.toBe(doc.cpfSeguro);
  });

  it('PJ: razão social em Title Case', () => {
    const t = `Construtora Horizonte Ltda, pessoa jurídica, CNPJ n.º ${CNPJ_FIXTURE}, com sede na Av. Paulista, nº 900, Bela Vista, São Paulo/SP, CEP 01310-100`;
    const r = extrairDadosDeTextoLivre(t);
    expect(r.tipoPessoa).toBe('juridica');
    expect(r.nomeCompleto).toBe('Construtora Horizonte Ltda');
    expect(r.cnpj).toBe(CNPJ_FIXTURE);
  });

  it('PJ: variações de rótulo CNPJ (inscrita no CNPJ e CNPJ n.º)', () => {
    const tInscrita = `Alpha Serviços Ltda, pessoa jurídica, inscrita no CNPJ ${CNPJ_FIXTURE}, com sede na Rua Beta, nº 10, Curitiba/PR, CEP 80010-000`;
    const r1 = extrairDadosDeTextoLivre(tInscrita);
    expect(r1.cnpj).toBe(CNPJ_FIXTURE);

    const tRotulo = `Beta Comércio EIRELI, pessoa jurídica, CNPJ n.º ${CNPJ_FIXTURE}, com sede na Rua Gama, nº 20, Belo Horizonte/MG, CEP 30130-000`;
    const r2 = extrairDadosDeTextoLivre(tRotulo);
    expect(r2.cnpj).toBe(CNPJ_FIXTURE);
  });

  it('PJ sem complemento: endereço só rua, número e cidade', () => {
    const t = `Gamma Logística Ltda, pessoa jurídica, inscrita no CNPJ ${CNPJ_FIXTURE}, com sede na Rua das Flores, nº 50, Goiânia/GO, CEP 74000-000`;
    const r = extrairDadosDeTextoLivre(t);
    expect(r.tipoPessoa).toBe('juridica');
    expect(r.endereco).toBeTruthy();
    expect(r.endereco.rua).toBe('Rua das Flores');
    expect(r.endereco.numero).toBe('50');
    expect(r.endereco.complemento).toBeFalsy();
    expect(r.endereco.cidade).toBe('Goiânia');
    expect(r.endereco.estado).toBe('GO');
    expect(r.endereco.cepFormatado).toBe('74000-000');
  });
});
