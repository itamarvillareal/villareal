import { parsePersonFreeText } from './personTextParserService.js';

/**
 * Resultado para preenchimento do formulário + metadados.
 */
export function extrairDadosDeTextoLivre(textoBruto, options = {}) {
  const parsed = parsePersonFreeText(textoBruto, { debug: options.debug === true });
  const confiancaPorCampo = {
    nomeCompleto: parsed.candidatos.nomeCompleto[0]?.score ?? 0,
    cpf: parsed.candidatos.cpf.find((c) => c.valido)?.score ?? 0,
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
    preenchidos.rg ||
    preenchidos.dataNascimento ||
    preenchidos.nacionalidade ||
    preenchidos.estadoCivil ||
    preenchidos.profissao ||
    preenchidos.endereco ||
    preenchidos.email;
  return {
    sucesso,
    nomeCompleto: parsed.nomeCompleto,
    cpf: parsed.cpf,
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
