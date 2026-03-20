import { normalizarTextoBruto } from './textNormalizationService.js';
import { extrairDadosDocumentoPessoal } from './documentParserService.js';
import { validateCPF, validateBirthDate, scoreName, scoreRG } from './brazilianDocumentValidators.js';

function detectarTipoDocumento(upperTexto) {
  if (
    /CARTEIRA NACIONAL DE HABILITA[CÇ][AÃ]O/.test(upperTexto) ||
    /PERMISO DE CONDUCCI[ÓO]N/.test(upperTexto) ||
    /SENATRAN/.test(upperTexto)
  ) {
    return 'CNH';
  }
  if (/CARTEIRA DE IDENTIDADE/.test(upperTexto) || /REGISTRO GERAL/.test(upperTexto)) {
    return 'RG';
  }
  if (/CADASTRO DE PESSOA F[IÍ]SICA/.test(upperTexto) || /\bCPF\b/.test(upperTexto)) {
    return 'CPF';
  }
  return 'DESCONHECIDO';
}

export function parseBrazilianDocument(textoBruto, metaArquivo = {}) {
  const avisos = [];
  const normalizado = normalizarTextoBruto(textoBruto || '');
  const tipoDocumentoDetectado = detectarTipoDocumento(normalizado.upper);

  const basico = extrairDadosDocumentoPessoal(normalizado.textoCorrigido);
  let { nomeCompleto, cpf, dataNascimento } = basico;
  let rg = null;

  const linhas = normalizado.linhas;
  for (let i = 0; i < linhas.length; i += 1) {
    const up = linhas[i].toUpperCase();
    if (up.includes('RG') || up.includes('IDENTIDADE') || up.includes('REGISTRO GERAL')) {
      const blocos = [linhas[i], linhas[i + 1] || '', linhas[i + 2] || ''].filter(Boolean).join(' ');
      rg = blocos.replace(/\s+/g, ' ').trim();
      break;
    }
  }

  const cpfVal = validateCPF(cpf);
  let cpfConfianca = 0;
  if (cpfVal.valido) {
    cpf = cpfVal.normalizado;
    cpfConfianca = 0.99;
  } else if (cpf) {
    avisos.push('CPF extraído não passou na validação; revise manualmente.');
    cpfConfianca = 0.3;
  }

  const nascVal = validateBirthDate(dataNascimento);
  const dataNascimentoConfianca = nascVal.valido ? 0.98 : dataNascimento ? 0.4 : 0;
  if (dataNascimento && !nascVal.valido) {
    avisos.push('Data de nascimento extraída parece inválida; revise manualmente.');
  }

  const nomeConfianca = scoreName(nomeCompleto);
  const rgConfianca = scoreRG(rg);

  const confiancaPorCampo = {
    nomeCompleto: nomeConfianca,
    cpf: cpfConfianca,
    rg: rgConfianca,
    dataNascimento: dataNascimentoConfianca,
  };

  const sucesso = !!(nomeCompleto && cpfVal.valido && nascVal.valido);

  return {
    nomeCompleto: nomeCompleto || null,
    cpf: cpf || null,
    rg: rg || null,
    dataNascimento: dataNascimento || null,
    tipoDocumentoDetectado,
    confiancaPorCampo,
    textoExtraidoBruto: normalizado.original,
    avisos,
    sucesso,
    metaArquivo,
  };
}

