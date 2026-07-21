import { request } from '../api/httpClient.js';
import { decodificarEntidadesHtml } from '../data/manifestacoesProjudiDisplay.js';
import { ENDERECAMENTOS, TIPOS_PECA, CIDADE_ESTADO_PADRAO } from '../pages/documentos/constants.js';
import {
  primeiraPessoaIdParteCliente,
  primeiraPessoaIdParteOposta,
  poloJuridicoEscritorioEhAutor,
  textosPartesFromListaPartesApi,
} from '../data/partesLadoEscritorio.js';
import { listarPartesProcesso, papelParteUiParaApi } from '../repositories/processosRepository.js';

const ESTADOS_NOME = {
  GO: 'Goiás',
  SP: 'São Paulo',
  MG: 'Minas Gerais',
  RJ: 'Rio de Janeiro',
  BA: 'Bahia',
  PR: 'Paraná',
  RS: 'Rio Grande do Sul',
  PE: 'Pernambuco',
  CE: 'Ceará',
  PA: 'Pará',
  SC: 'Santa Catarina',
  MA: 'Maranhão',
  AM: 'Amazonas',
  ES: 'Espírito Santo',
  PB: 'Paraíba',
  RN: 'Rio Grande do Norte',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  DF: 'Distrito Federal',
  AL: 'Alagoas',
  PI: 'Piauí',
  SE: 'Sergipe',
  RO: 'Rondônia',
  TO: 'Tocantins',
  AC: 'Acre',
  AP: 'Amapá',
  RR: 'Roraima',
};

/** @deprecated Prefer {@link textosPartesFromListaPartesApi} com papel_cliente do processo. */
export function poloEhLadoCliente(polo) {
  const poloNorm = String(polo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  return (
    poloNorm.includes('AUTOR') ||
    poloNorm.includes('REQUERENTE') ||
    poloNorm.includes('CLIENTE')
  );
}

export function poloEhAutorProcesso(polo) {
  const p = String(polo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  return p.includes('AUTOR') || p.includes('REQUERENTE');
}

export function poloEhReuProcesso(polo) {
  const p = String(polo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  return p.includes('REU') || p.includes('REQUERIDO');
}

/** Procedimento «JEC» (Juizado Especial Cível) — aceita variações com/sem acento. */
export function ehProcedimentoJec(valor) {
  const p = String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
  if (!p) return false;
  return /\bJEC\b/.test(p) || p.includes('JUIZADO ESPECIAL CIVEL');
}

/**
 * Órgão julgador é Juizado Especial? Decide pelo catálogo (campo `tipo`) e, como reforço,
 * pelo nome (cobre órgãos legados/sem tipo). `orgaoJulgador` = { tipo, nome } ou null.
 */
export function ehJuizadoEspecial(orgaoJulgador) {
  if (!orgaoJulgador) return false;
  const tipo = String(orgaoJulgador.tipo ?? '')
    .toUpperCase()
    .trim();
  if (tipo === 'JUIZADO') return true;
  return ehProcedimentoJec(orgaoJulgador.nome);
}

function montarEnderecamentoPorCompetencia(competencia, cidUpper, sigla) {
  const competenciaUpper = String(competencia || '').trim().toUpperCase();
  if (!competenciaUpper) {
    return `MERITÍSSIMO JUÍZO DA COMARCA DE ${cidUpper} - ${sigla}`;
  }
  const ehJuizado = competenciaUpper.includes('JUIZADO');
  const ehTrabalho = competenciaUpper.includes('TRABALHO');
  const artigo = ehJuizado ? 'DO' : 'DA';
  const local = ehTrabalho ? `DE ${cidUpper}` : `DA COMARCA DE ${cidUpper}`;
  return `MERITÍSSIMO JUÍZO ${artigo} ${competenciaUpper} ${local} - ${sigla}`;
}

/** Extrai ordinal do órgão (ex.: «1º», «3ª») a partir do nome ou da competência. */
function extrairPrefixoJuizado(texto) {
  const bruto = String(texto ?? '').trim();
  if (!bruto) return null;
  const m = bruto.match(/^(\d+\s*[ºªoa°]?)/iu);
  if (!m) return null;
  return m[1].replace(/\s+/g, '').replace(/o(?!\w)/iu, 'º').replace(/a(?!\w)/iu, 'ª').toUpperCase();
}

function montarEnderecamentoJuizado(orgaoJulgador, competencia, cidUpper, sigla) {
  const prefixoOrg = extrairPrefixoJuizado(orgaoJulgador?.nome);
  const competenciaNorm = String(competencia ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  const prefixo =
    prefixoOrg ||
    (competenciaNorm.includes('JUIZADO') ? extrairPrefixoJuizado(competencia) : null);
  const qualificacao = prefixo
    ? `${prefixo} JUIZADO ESPECIAL CÍVEL`
    : 'JUIZADO ESPECIAL CÍVEL';
  return `MERITÍSSIMO JUÍZO DO ${qualificacao} DA COMARCA DE ${cidUpper} - ${sigla}`;
}

/**
 * Endereçamento da petição.
 * Primário: órgão julgador vinculado (catálogo) — se for Juizado Especial, endereça ao JEC da comarca.
 * Fallback: competência (texto), comportamento anterior, quando não houver órgão Juizado.
 * @param {string} competencia
 * @param {string} cidade
 * @param {string} uf
 * @param {{tipo?: string, nome?: string}|null} [orgaoJulgador]
 */
export function inferirEnderecamento(competencia, cidade, uf, orgaoJulgador) {
  const cid = String(cidade || 'Anápolis').trim() || 'Anápolis';
  const cidUpper = cid.toUpperCase();
  const sigla = String(uf || 'GO').trim().toUpperCase() || 'GO';

  // Primário: órgão julgador do catálogo — Juizado Especial endereça ao JEC da comarca.
  if (ehJuizadoEspecial(orgaoJulgador)) {
    return montarEnderecamentoJuizado(orgaoJulgador, competencia, cidUpper, sigla);
  }

  // Fallback: competência (texto).
  return montarEnderecamentoPorCompetencia(competencia, cidUpper, sigla);
}

export function formatarCidadeEstado(cidade, uf) {
  const sigla = String(uf || 'GO').trim().toUpperCase() || 'GO';
  const nomeEstado = ESTADOS_NOME[sigla] || sigla;
  const cid = normalizarCidadeTitulo(cidade);
  return `${cid}, estado de ${nomeEstado}`;
}

/** Cidade em título (ex.: ANÁPOLIS → Anápolis), preservando acentos. */
export function normalizarCidadeTitulo(cidade) {
  const bruto = String(cidade ?? '').trim();
  if (!bruto) return 'Anápolis';
  if (bruto === bruto.toUpperCase() && bruto.length > 1) {
    return bruto.charAt(0) + bruto.slice(1).toLocaleLowerCase('pt-BR');
  }
  return bruto;
}

const MESES_PT = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  março: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

export function extrairDataIsoDeLocalData(texto) {
  const m = String(texto ?? '').match(/(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i);
  if (!m) return null;
  const dia = Number.parseInt(m[1], 10);
  const mes = MESES_PT[m[2].toLowerCase()];
  const ano = Number.parseInt(m[3], 10);
  if (!mes || !Number.isFinite(dia) || !Number.isFinite(ano) || dia < 1 || dia > 31) return null;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Só a parte «cidade, estado de …» — sem a data por extenso (evita duplicar no PDF). */
export function extrairCidadeEstadoDeLocalData(texto) {
  const entrada = String(texto ?? CIDADE_ESTADO_PADRAO).trim() || CIDADE_ESTADO_PADRAO;
  const semData =
    entrada
      .replace(/\s*,\s*\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4}\.?\s*$/i, '')
      .replace(/\.$/, '')
      .trim() || CIDADE_ESTADO_PADRAO;
  const idxEstado = semData.toLowerCase().indexOf(', estado de');
  if (idxEstado > 0) {
    const cidade = normalizarCidadeTitulo(semData.substring(0, idxEstado).trim());
    return `${cidade}${semData.substring(idxEstado)}`;
  }
  return normalizarCidadeTitulo(semData);
}

/** Espelha o backend: «24 de junho de 2026». */
export function formatarDataExtensoPeticao(isoOrDate) {
  const raw = String(isoOrDate ?? '').trim();
  let d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    d = new Date(`${raw}T12:00:00`);
  } else if (isoOrDate instanceof Date) {
    d = isoOrDate;
  } else {
    d = new Date(isoOrDate);
  }
  if (Number.isNaN(d.getTime())) {
    d = new Date();
  }
  return d.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** «Anápolis, estado de Goiás, 24 de junho de 2026.» */
export function formatarLocalData(cidadeEstado, dataIso) {
  const entrada = String(cidadeEstado ?? CIDADE_ESTADO_PADRAO).trim() || CIDADE_ESTADO_PADRAO;
  const isoExistente = extrairDataIsoDeLocalData(entrada);
  const iso = dataIso || isoExistente || new Date().toISOString().split('T')[0];
  const cidade = extrairCidadeEstadoDeLocalData(entrada);
  return `${cidade}, ${formatarDataExtensoPeticao(iso)}.`;
}

export const LOCAL_DATA_PADRAO = formatarLocalData(CIDADE_ESTADO_PADRAO);

export function resolveSelectInicial(valor, opcoes) {
  const v = String(valor ?? '').trim();
  if (!v) return { select: '', outro: '' };
  const match = opcoes.find((o) => o.toLowerCase() === v.toLowerCase());
  if (match) return { select: match, outro: '' };
  const parcial = opcoes.find((o) => v.toLowerCase().includes(o.toLowerCase().slice(0, 20)));
  if (parcial) return { select: parcial, outro: '' };
  return { select: '__outro__', outro: v };
}

export function resolveSelectExato(valor, opcoes) {
  const v = String(valor ?? '').trim();
  if (!v) return { select: '', outro: '' };
  const match = opcoes.find((o) => o.toLowerCase() === v.toLowerCase());
  if (match) return { select: match, outro: '' };
  return { select: '__outro__', outro: v };
}

/** Converte resposta da API (texto plano ou HTML legado) para exibição/cópia sem entidades visíveis. */
export function qualificacaoApiParaTextoPlano(texto) {
  const bruto = String(texto ?? '').trim();
  if (!bruto) return '';
  return decodificarEntidadesHtml(bruto.replace(/<\/?strong>/gi, ''));
}

export async function buscarQualificacaoCompleta(pessoaId, pessoaEnderecoId) {
  const id = Number(pessoaId);
  if (!Number.isFinite(id) || id < 1) return '';

  const enderecoId = Number(pessoaEnderecoId);
  const query =
    Number.isFinite(enderecoId) && enderecoId > 0 ? { pessoaEnderecoId: enderecoId } : undefined;

  try {
    const data = await request(`/api/pessoas/${id}/qualificacao-juridica`, query ? { query } : undefined);
    return qualificacaoApiParaTextoPlano(data?.qualificacao || data?.qualificacaoHtml || '');
  } catch (error) {
    console.error('Erro ao buscar qualificação:', error);
    return '';
  }
}

async function montarNomeQualificacaoJuridica(parte, textoFallback) {
  const nome = String(parte?.nomeExibicao || parte?.nomeLivre || textoFallback || '').trim();
  const pessoaId = Number(parte?.pessoaId);
  let qualificacao = '';
  if (Number.isFinite(pessoaId) && pessoaId > 0) {
    qualificacao = await buscarQualificacaoCompleta(pessoaId, parte?.pessoaEnderecoId);
  }
  return {
    nome: nome.toUpperCase(),
    qualificacao,
  };
}

function juntarNomesPartes(partes) {
  return (partes || [])
    .map((p) => String(p.nomeExibicao || p.nomeLivre || '').trim())
    .filter(Boolean)
    .join(' e ');
}

/**
 * @param {object} ctx — snapshot do formulário Processos
 */
export async function montarDadosParaDocumentoFromProcesso(ctx) {
  const cidade = String(ctx.cidade ?? 'Anápolis').trim() || 'Anápolis';
  const uf = String(ctx.estado ?? 'GO').trim().toUpperCase() || 'GO';
  const competencia = String(ctx.competencia ?? '').trim();
  const orgaoJulgador = ctx.orgaoJulgador ?? null;
  const naturezaAcao = String(ctx.naturezaAcao ?? '').trim();
  const numeroProcesso =
    String(ctx.numeroProcessoNovo ?? '').trim() ||
    String(ctx.numeroProcessoVelho ?? '').trim() ||
    '';
  const valorCausa = String(ctx.valorCausa ?? '').trim();
  const observacao = String(ctx.observacao ?? '').trim();
  const papelUi = String(ctx.papelParte ?? 'requerente').toLowerCase();

  let partes = ctx.partesApi;
  if (!Array.isArray(partes) && ctx.processoApiId) {
    partes = await listarPartesProcesso(ctx.processoApiId);
  }
  partes = Array.isArray(partes) ? partes : [];

  const textosPartes = textosPartesFromListaPartesApi(partes, papelUi);
  const textoParteCliente = String(
    ctx.textoParteCliente ?? ctx.parteCliente ?? textosPartes.parteCliente ?? '',
  ).trim();
  const textoParteOposta = String(
    ctx.textoParteOposta ?? ctx.parteOposta ?? textosPartes.parteOposta ?? '',
  ).trim();

  const partesAutor = partes.filter((p) => poloEhAutorProcesso(p.polo));
  const partesReu = partes.filter((p) => poloEhReuProcesso(p.polo));

  const autor = await montarNomeQualificacaoJuridica(partesAutor[0], textoParteOposta);
  const reu = await montarNomeQualificacaoJuridica(partesReu[0], textoParteCliente);

  const nomeAutor = juntarNomesPartes(partesAutor).toUpperCase() || autor.nome;
  const nomeReu = juntarNomesPartes(partesReu).toUpperCase() || reu.nome;
  const qualificacaoAutor = autor.qualificacao;
  const qualificacaoReu = reu.qualificacao;

  const enderecamento = inferirEnderecamento(competencia, cidade, uf, orgaoJulgador);
  const cidadeEstado = formatarLocalData(formatarCidadeEstado(cidade, uf));

  const pessoaIdOutorgante = primeiraPessoaIdParteCliente(partes, papelUi);
  const pessoaIdOposta = primeiraPessoaIdParteOposta(partes, papelUi);
  const enderecoIdOutorgante = partes.find(
    (p) => Number(p.pessoaId) === Number(pessoaIdOutorgante),
  )?.pessoaEnderecoId;
  const enderecoIdOposta = partes.find((p) => Number(p.pessoaId) === Number(pessoaIdOposta))
    ?.pessoaEnderecoId;
  const qualificacaoParteCliente = pessoaIdOutorgante
    ? await buscarQualificacaoCompleta(pessoaIdOutorgante, enderecoIdOutorgante)
    : '';
  const qualificacaoParteOposta = pessoaIdOposta
    ? await buscarQualificacaoCompleta(pessoaIdOposta, enderecoIdOposta)
    : '';
  const nomeOutorgante = textoParteCliente.toUpperCase();

  const nomeLocador = juntarNomesPartes(partesAutor).toUpperCase() || nomeAutor;
  const nomeLocatarios = juntarNomesPartes(partesReu).toUpperCase() || nomeReu;

  return {
    enderecamento,
    numeroProcesso,
    tipoPeca: naturezaAcao,
    nomeAutor,
    qualificacaoAutor,
    nomeReu,
    qualificacaoReu,
    fatos: observacao,
    valorCausa,
    cidadeEstado,
    pessoaIdOutorgante,
    nomeOutorgante,
    nomeLocador,
    nomeLocatarios,
    codigoCliente: ctx.codigoCliente,
    numeroInterno: ctx.numeroInterno ?? ctx.processo,
    processoApiId: ctx.processoApiId ?? null,
    parteCliente: textoParteCliente,
    parteOposta: textoParteOposta,
    qualificacaoParteCliente,
    qualificacaoParteOposta,
    papelParte: papelUi,
  };
}

function escaparHtmlBasico(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Trecho «na ação que move…» / «na ação que lhe move…» conforme o polo da parte cliente. */
export function montarTrechoAcaoPreambuloHtml(papelParte, parteOposta) {
  const opostaNome = String(parteOposta || 'XXXXXXXXXXXX').trim().toUpperCase();
  const opostaHtml = `<strong>${escaparHtmlBasico(opostaNome)}</strong>`;
  if (poloJuridicoEscritorioEhAutor(papelParte)) {
    return `na ação que move em face de ${opostaHtml}`;
  }
  return `na ação que lhe move ${opostaHtml}`;
}

/** Preâmbulo HTML sugerido para o modo manual (qualificação da parte cliente + trecho da ação). */
export function montarPreambuloSugerido(dadosProcesso) {
  if (!dadosProcesso) return '';
  const interlocutoria = Boolean(String(dadosProcesso.numeroProcesso ?? '').trim());
  const nomesAutor = String(dadosProcesso.nomeAutor || dadosProcesso.parteCliente || '').trim();
  const nomesReu = String(dadosProcesso.nomeReu || dadosProcesso.parteOposta || '').trim();
  if (!nomesAutor && !nomesReu) return '';

  if (interlocutoria) {
    return montarPreambuloInterlocutoria(dadosProcesso.papelParte, nomesAutor, nomesReu);
  }

  const nomeCliente = String(dadosProcesso.parteCliente || dadosProcesso.nomeOutorgante || '').trim();
  const parteOposta = String(dadosProcesso.parteOposta || '').trim();
  const qual = String(dadosProcesso.qualificacaoParteCliente || '').trim();
  const qualSuffix = qual ? escaparHtmlBasico(qual) : 'brasileiro(a)...';
  const nomeClienteHtml = `<strong>${escaparHtmlBasico(
    (nomeCliente || 'FULANO').toUpperCase(),
  )}</strong>`;
  const trechoAcao = montarTrechoAcaoPreambuloHtml(dadosProcesso.papelParte, parteOposta);

  return `<p>${nomeClienteHtml}, ${qualSuffix}, vem, respeitosamente, perante Vossa Excelência, ${trechoAcao}, requerer o que segue.</p>`;
}

function montarPreambuloInterlocutoria(papelParte, nomesAutor, nomesReu) {
  const autoresHtml = `<strong>${escaparHtmlBasico(nomesAutor.toUpperCase())}</strong>, já devidamente qualificado(s)`;
  const reusHtml = `<strong>${escaparHtmlBasico(nomesReu.toUpperCase())}</strong>, já devidamente qualificado(s)`;
  if (poloJuridicoEscritorioEhAutor(papelParte)) {
    return `<p>${autoresHtml}, vem, respeitosamente, perante Vossa Excelência, na ação que move em face de ${reusHtml}, requerer o que segue.</p>`;
  }
  return `<p>${reusHtml}, vem, respeitosamente, perante Vossa Excelência, na ação que lhe move ${autoresHtml}, requerer o que segue.</p>`;
}

function mapearEnderecamentoParaForm(enderecamento) {
  const end = resolveSelectExato(enderecamento, ENDERECAMENTOS);
  return {
    enderecamentoSelect: end.select,
    enderecamentoOutro: end.outro,
  };
}

export function mapearDadosProcessoParaFormIA(dadosProcesso) {
  if (!dadosProcesso) return estadoInicialFormVazio();

  const tipo = resolveSelectInicial(dadosProcesso.tipoPeca, TIPOS_PECA);

  return {
    ...mapearEnderecamentoParaForm(dadosProcesso.enderecamento),
    numeroProcesso: dadosProcesso.numeroProcesso || '',
    tipoPeca: tipo.select,
    tipoPecaOutro: tipo.outro,
    nomeAutor: dadosProcesso.nomeAutor || '',
    qualificacaoAutor: dadosProcesso.qualificacaoAutor || '',
    nomeReu: dadosProcesso.nomeReu || '',
    qualificacaoReu: dadosProcesso.qualificacaoReu || '',
    fatos: dadosProcesso.fatos || '',
    valorCausa: dadosProcesso.valorCausa || '',
    cidadeEstado: formatarLocalData(dadosProcesso.cidadeEstado || CIDADE_ESTADO_PADRAO),
  };
}

export function mapearDadosProcessoParaFormManual(dadosProcesso) {
  if (!dadosProcesso) return estadoInicialFormManualVazio();

  return {
    ...mapearEnderecamentoParaForm(dadosProcesso.enderecamento),
    numeroProcesso: dadosProcesso.numeroProcesso || '',
    preambulo: montarPreambuloSugerido(dadosProcesso),
    secoes: [
      { titulo: 'DOS FATOS', conteudo: '' },
      { titulo: 'DO DIREITO', conteudo: '' },
    ],
    pedidos: [''],
    cidadeEstado: formatarLocalData(dadosProcesso.cidadeEstado || CIDADE_ESTADO_PADRAO),
  };
}

function estadoInicialFormVazio() {
  return {
    enderecamentoSelect: '',
    enderecamentoOutro: '',
    numeroProcesso: '',
    tipoPeca: '',
    tipoPecaOutro: '',
    nomeAutor: '',
    qualificacaoAutor: '',
    nomeReu: '',
    qualificacaoReu: '',
    fatos: '',
    valorCausa: '',
    cidadeEstado: LOCAL_DATA_PADRAO,
  };
}

function estadoInicialFormManualVazio() {
  return {
    enderecamentoSelect: '',
    enderecamentoOutro: '',
    numeroProcesso: '',
    preambulo: '',
    secoes: [
      { titulo: 'DOS FATOS', conteudo: '' },
      { titulo: 'DO DIREITO', conteudo: '' },
    ],
    pedidos: [''],
    cidadeEstado: LOCAL_DATA_PADRAO,
  };
}
