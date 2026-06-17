import { parsePersonFreeText } from './personTextParserService.js';
import { validateCPF, validateCNPJ } from './cpfValidatorService.js';

/**
 * Define qual documento (CPF ou CNPJ) preenche o campo Documento do formulário.
 * Em PJ, CNPJ válido sempre vence — CPF de representante legal fica fora do campo.
 * @param {{ tipoPessoa?: string, cpf?: string|null, cnpj?: string|null }} resultado
 */
export function resolverDocumentoParaFormulario(resultado) {
  const cpfSeguro =
    resultado.cpf && validateCPF(resultado.cpf).valido
      ? validateCPF(resultado.cpf).normalizado
      : null;
  const cnpjSeguro =
    resultado.cnpj && validateCNPJ(resultado.cnpj).valido
      ? validateCNPJ(resultado.cnpj).normalizado
      : null;

  if (resultado.tipoPessoa === 'juridica' && cnpjSeguro) {
    return {
      documento: cnpjSeguro,
      cpfSeguro,
      cnpjSeguro,
      preferiuCnpj: true,
    };
  }

  return {
    documento: cpfSeguro || cnpjSeguro,
    cpfSeguro,
    cnpjSeguro,
    preferiuCnpj: !cpfSeguro && !!cnpjSeguro,
  };
}

/**
 * Resultado para preenchimento do formulário + metadados.
 */
export function extrairDadosDeTextoLivre(textoBruto, options = {}) {
  const parsed = parsePersonFreeText(textoBruto, { debug: options.debug === true });
  const confiancaPorCampo = {
    nomeCompleto: parsed.candidatos.nomeCompleto[0]?.score ?? 0,
    cpf: parsed.candidatos.cpf.find((c) => c.valido)?.score ?? 0,
    cnpj: parsed.candidatos.cnpj?.find((c) => c.valido)?.score ?? 0,
    rg: parsed.candidatos.rg[0]?.score ?? 0,
    dataNascimento: parsed.candidatos.dataNascimento.find((d) => d.valido)?.score ?? 0,
    nacionalidade: parsed.candidatos.nacionalidade[0]?.score ?? 0,
    estadoCivil: parsed.candidatos.estadoCivil[0]?.score ?? 0,
    profissao: parsed.candidatos.profissao[0]?.score ?? 0,
    endereco: parsed.candidatos.endereco[0]?.score ?? 0,
    email: parsed.candidatos.email[0]?.score ?? 0,
  };
  const preenchidos = {
    nome: !!parsed.nomeCompleto,
    cpf: !!parsed.cpf,
    cnpj: !!parsed.cnpj,
    rg: !!parsed.rg,
    dataNascimento: !!parsed.dataNascimento,
    nacionalidade: !!parsed.nacionalidade,
    estadoCivil: !!parsed.estadoCivil,
    profissao: !!parsed.profissao,
    endereco: !!parsed.endereco,
    email: !!parsed.email,
  };
  const sucesso =
    preenchidos.nome ||
    preenchidos.cpf ||
    preenchidos.cnpj ||
    preenchidos.rg ||
    preenchidos.dataNascimento ||
    preenchidos.nacionalidade ||
    preenchidos.estadoCivil ||
    preenchidos.profissao ||
    preenchidos.endereco ||
    preenchidos.email;
  return {
    sucesso,
    tipoPessoa: parsed.tipoPessoa ?? 'fisica',
    nomeCompleto: parsed.nomeCompleto,
    cpf: parsed.cpf,
    cnpj: parsed.cnpj,
    rg: parsed.rg,
    dataNascimento: parsed.dataNascimento,
    nacionalidade: parsed.nacionalidade,
    estadoCivil: parsed.estadoCivil,
    profissao: parsed.profissao,
    endereco: parsed.endereco,
    email: parsed.email,
    confiancaPorCampo,
    candidatos: parsed.candidatos,
    avisos: parsed.avisos,
    textoOriginal: String(textoBruto || ''),
    /** Mesmo texto enviado ao parser (parágrafos → espaço). Refletir no textarea após extrair. */
    textoNormalizado: parsed.textoNormalizado ?? '',
    debug: parsed.debug,
    preenchidos,
  };
}
