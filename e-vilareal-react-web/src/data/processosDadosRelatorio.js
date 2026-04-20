/**
 * Dados alinhados à tela Processos (API + localStorage) para enriquecer linhas do Relatório Processos.
 */
import { getRegistroProcesso } from './processosHistoricoData.js';
import { featureFlags } from '../config/featureFlags.js';
import { listarAndamentosProcesso, listarPartesProcesso, obterCamposProcessoApiFirst, resolverProcessoId } from '../repositories/processosRepository.js';

/** Todos os estados brasileiros (UF) + Distrito Federal — ordem alfabética por sigla. */
export const UFS = [
  { sigla: 'AC', nome: 'ACRE' },
  { sigla: 'AL', nome: 'ALAGOAS' },
  { sigla: 'AP', nome: 'AMAPÁ' },
  { sigla: 'AM', nome: 'AMAZONAS' },
  { sigla: 'BA', nome: 'BAHIA' },
  { sigla: 'CE', nome: 'CEARÁ' },
  { sigla: 'DF', nome: 'DISTRITO FEDERAL' },
  { sigla: 'ES', nome: 'ESPÍRITO SANTO' },
  { sigla: 'GO', nome: 'GOIÁS' },
  { sigla: 'MA', nome: 'MARANHÃO' },
  { sigla: 'MT', nome: 'MATO GROSSO' },
  { sigla: 'MS', nome: 'MATO GROSSO DO SUL' },
  { sigla: 'MG', nome: 'MINAS GERAIS' },
  { sigla: 'PA', nome: 'PARÁ' },
  { sigla: 'PB', nome: 'PARAÍBA' },
  { sigla: 'PR', nome: 'PARANÁ' },
  { sigla: 'PE', nome: 'PERNAMBUCO' },
  { sigla: 'PI', nome: 'PIAUÍ' },
  { sigla: 'RJ', nome: 'RIO DE JANEIRO' },
  { sigla: 'RN', nome: 'RIO GRANDE DO NORTE' },
  { sigla: 'RS', nome: 'RIO GRANDE DO SUL' },
  { sigla: 'RO', nome: 'RONDÔNIA' },
  { sigla: 'RR', nome: 'RORAIMA' },
  { sigla: 'SC', nome: 'SANTA CATARINA' },
  { sigla: 'SP', nome: 'SÃO PAULO' },
  { sigla: 'SE', nome: 'SERGIPE' },
  { sigla: 'TO', nome: 'TOCANTINS' },
];

/**
 * Cidades sugeridas por UF (primeira = capital ou cidade principal do mock).
 * Mantém listas estendidas onde o app já usava mais de uma cidade.
 */
export const CIDADES_POR_UF = {
  AC: ['RIO BRANCO'],
  AL: ['MACEIÓ'],
  AP: ['MACAPÁ'],
  AM: ['MANAUS'],
  BA: ['SALVADOR'],
  CE: ['FORTALEZA'],
  DF: ['BRASÍLIA'],
  ES: ['VITÓRIA'],
  GO: ['RIO VERDE', 'GOIÂNIA', 'ANÁPOLIS', 'APARECIDA DE GOIÂNIA'],
  MA: ['SÃO LUÍS'],
  MT: ['CUIABÁ'],
  MS: ['CAMPO GRANDE'],
  MG: ['BELO HORIZONTE', 'UBERLÂNDIA'],
  PA: ['BELÉM'],
  PB: ['JOÃO PESSOA'],
  PR: ['CURITIBA'],
  PE: ['RECIFE'],
  PI: ['TERESINA', 'PARNÁIBA'],
  RJ: ['RIO DE JANEIRO', 'NITERÓI'],
  RN: ['NATAL'],
  RS: ['PORTO ALEGRE'],
  RO: ['PORTO VELHO'],
  RR: ['BOA VISTA'],
  SC: ['FLORIANÓPOLIS'],
  SP: ['SÃO PAULO', 'CAMPINAS', 'RIBEIRÃO PRETO'],
  SE: ['ARACAJU'],
  TO: ['PALMAS'],
};

export const FASES = [
  'Ag. Documentos',
  'Ag. Peticionar',
  'Ag. Verificação',
  'Protocolo / Movimentação',
  'Aguardando Providência',
  'Procedimento Adm.',
  'Em Andamento',
];

/** Mesma normalização usada em `Processos.jsx` para cores / detecção de fase. */
function faseProcessualCompactaPt(s) {
  return String(s ?? '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Mapeia texto vindo da API ou legado para um rótulo de {@link FASES}, quando reconhecível.
 * Ex.: «Aguardando Verificação» → «Ag. Verificação» (o cabeçalho pode continuar a mostrar o texto cru em `faseSelecionada`).
 */
export function canonicalizarFaseParaOpcoesRadiosProcessos(val) {
  const raw = String(val ?? '').trim();
  if (!raw) return '';
  if (FASES.includes(raw)) return raw;
  const c = faseProcessualCompactaPt(raw);
  if (!c) return '';

  if (c.includes('protoc') && c.includes('moviment')) return 'Protocolo / Movimentação';
  if (c.includes('aguard') && c.includes('provid')) return 'Aguardando Providência';
  if (c.includes('procadministrativo') || (c.includes('proced') && c.includes('adm'))) return 'Procedimento Adm.';

  const agPrefix = c.startsWith('ag');
  if (agPrefix && c.includes('docu') && (c.includes('ment') || c.includes('met'))) return 'Ag. Documentos';
  if (
    agPrefix &&
    c.includes('petic') &&
    (c.includes('ar') || c.includes('ionar') || c.includes('icion'))
  ) {
    return 'Ag. Peticionar';
  }
  if (agPrefix && (c.includes('verif') || c.includes('verificacao'))) return 'Ag. Verificação';

  if (c.includes('emandamento')) return 'Em Andamento';

  return '';
}

export const COMPETENCIAS = [
  '1º JUIZADO ESPECIAL CÍVEL',
  '2º JUIZADO ESPECIAL CÍVEL',
  '3º JUIZADO ESPECIAL CÍVEL',
  'VARA CÍVEL',
];

/** Opções do campo Tipo de audiência (Processos). */
export const TIPOS_AUDIENCIA = [
  'Conciliação',
  'Instrução',
  'Administrativa',
  'Sessão de Julgamento',
];

export const TRAMITACAO_OPCOES = ['Projudi', 'PJe', 'TJ Go - Autos Físicos'];

function formatarListaComConjuncaoE(itens) {
  const lista = (Array.isArray(itens) ? itens : [])
    .map((x) => String(x ?? '').trim())
    .filter(Boolean);
  if (lista.length === 0) return '';
  if (lista.length === 1) return lista[0];
  if (lista.length === 2) return `${lista[0]} e ${lista[1]}`;
  return `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`;
}

export function normalizarCliente(val) {
  const s = String(val ?? '').trim();
  if (!s) return '1';
  const n = Number(s);
  if (Number.isNaN(n) || n < 1) return '1';
  return String(n);
}

export function normalizarProcesso(val) {
  const s = String(val ?? '').trim();
  if (!s) return 1;
  const n = Number(s);
  if (Number.isNaN(n) || n < 1) return 1;
  return Math.floor(n);
}

export function padCliente(val) {
  const n = Number(normalizarCliente(val));
  return String(n).padStart(8, '0');
}

/**
 * Nome da pessoa vinculada ao código de cliente — preenchido pela API/tela Clientes; sem cache local estático.
 */
export function getNomePessoaCadastroPorCodigoCliente() {
  return null;
}

/**
 * Modelo vazio por par cliente×processo — sem dados fictícios (UF/cidade/CNJ/etc. vêm só de API,
 * persistência local ou cadastro gravado pelo usuário).
 */
export function gerarMockProcesso(codigoCliente, processo) {
  const c = Number(normalizarCliente(codigoCliente));
  const p = Number(normalizarProcesso(processo));
  return {
    codigoCliente: padCliente(c),
    processo: p,
    cliente: '',
    parteCliente: '',
    parteOposta: '',
    estado: '',
    cidade: '',
    faseSelecionada: '',
    competencia: '',
    numeroProcessoVelho: '',
    numeroProcessoNovo: '',
    statusAtivo: true,
    parteRequerente: false,
    parteRevel: false,
    parteRequerido: false,
    dataProtocolo: '',
    naturezaAcao: '',
    valorCausa: '',
    consultaAutomatica: false,
    observacao: '',
  };
}

function simNao(v) {
  return v ? 'Sim' : 'Não';
}

function parseDataBrParaTs(s) {
  const t = String(s ?? '').trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return 0;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const x = d.getTime();
  return Number.isNaN(x) ? 0 : x;
}

/** Último item do histórico: maior data dd/mm/aaaa; em empate, maior `id` (alinha à ordem “Inf.” da tela Processos). */
function ultimoHistoricoPorData(historico) {
  const lista = Array.isArray(historico) ? historico : [];
  let best = null;
  let bestTs = -1;
  let bestId = -1;
  for (const h of lista) {
    const ts = parseDataBrParaTs(h?.data);
    const id = Number(h?.id);
    const idNum = Number.isFinite(id) ? id : 0;
    if (ts > bestTs || (ts === bestTs && idNum > bestId)) {
      bestTs = ts;
      bestId = idNum;
      best = h;
    }
  }
  return best;
}

let _mapaImovelClienteProc = null;
const _cacheCamposApi = new Map();

function mapaImovelPorClienteProc() {
  if (_mapaImovelClienteProc) return _mapaImovelClienteProc;
  _mapaImovelClienteProc = new Map();
  return _mapaImovelClienteProc;
}

function resolverVinculoImovel(codNum, procNum) {
  return mapaImovelPorClienteProc().get(`${codNum}|${procNum}`) ?? null;
}

function keyClienteProc(codNum, procNum) {
  return `${Number(normalizarCliente(codNum))}|${Number(normalizarProcesso(procNum))}`;
}

function extrairUltimoAndamento(lista = []) {
  if (!Array.isArray(lista) || lista.length === 0) return { info: '', data: '' };
  const primeiro = lista[0];
  const info = String(primeiro?.titulo || '').trim();
  const dataIso = String(primeiro?.movimentoEm || '').slice(0, 10);
  const data = dataIso ? `${dataIso.slice(8, 10)}/${dataIso.slice(5, 7)}/${dataIso.slice(0, 4)}` : '';
  return { info, data };
}

export async function preaquecerCamposRelatorioApiFirst(paresClienteProc = []) {
  if (!featureFlags.useApiProcessos) return;
  const pares = Array.isArray(paresClienteProc) ? paresClienteProc : [];
  for (const [codRaw, procRaw] of pares) {
    const cod = padCliente(codRaw);
    const proc = Number(normalizarProcesso(procRaw));
    const key = keyClienteProc(cod, proc);
    if (_cacheCamposApi.has(key)) continue;
    try {
      const processoId = await resolverProcessoId({ codigoCliente: cod, numeroInterno: proc });
      if (!processoId) continue;
      const [cabecalho, partes, andamentos] = await Promise.all([
        obterCamposProcessoApiFirst({ processoId, codigoCliente: cod, numeroInterno: proc }),
        listarPartesProcesso(processoId),
        listarAndamentosProcesso(processoId),
      ]);
      const nomesCliente = [];
      const nomesOposta = [];
      for (const p of partes || []) {
        const polo = String(p.polo || '').toUpperCase();
        const nome = p.nomeExibicao || p.nomeLivre || '';
        if (!nome) continue;
        if (polo.includes('AUTOR') || polo.includes('REQUERENTE') || polo.includes('CLIENTE')) nomesCliente.push(nome);
        else nomesOposta.push(nome);
      }
      const ultimo = extrairUltimoAndamento(andamentos || []);
      _cacheCamposApi.set(key, {
        processoId,
        numeroProcessoNovo: cabecalho?.numeroProcessoNovo || '',
        numeroProcessoVelho: cabecalho?.numeroProcessoVelho || '',
        naturezaAcaoProcesso: cabecalho?.naturezaAcao || '',
        competenciaCadastroProcesso: cabecalho?.competencia || '',
        faseCadastroProcesso: cabecalho?.faseSelecionada || '',
        statusAtivoTexto: cabecalho?.statusAtivo === false ? 'Inativo' : 'Ativo',
        processoCadastroAtivo: cabecalho?.statusAtivo !== false,
        prazoFatalCadastroProcesso: cabecalho?.prazoFatal || '',
        observacaoCadastroProcesso: cabecalho?.observacao || '',
        parteCliente: formatarListaComConjuncaoE(nomesCliente),
        parteOposta: formatarListaComConjuncaoE(nomesOposta),
        ultimoHistoricoInfo: ultimo.info,
        ultimoHistoricoData: ultimo.data,
      });
    } catch {
      // fallback local/mock permanece soberano
    }
  }
}

/**
 * Campos extras por codCliente + proc (alinhados à tela Processos + persistência).
 * Usado na coluna dinâmica do Relatório Processos.
 */
export function getCamposExtrasRelatorioPorProcesso(codClienteRaw, procRaw) {
  const mock = gerarMockProcesso(codClienteRaw, procRaw);
  const reg = getRegistroProcesso(mock.codigoCliente, mock.processo);
  const hist = Array.isArray(reg?.historico) ? reg.historico : [];
  const ult = ultimoHistoricoPorData(hist);

  const faseCadastro =
    reg?.faseSelecionada != null && String(reg.faseSelecionada).trim() !== ''
      ? String(reg.faseSelecionada)
      : mock.faseSelecionada;

  const parteCliente =
    reg?.parteCliente != null && String(reg.parteCliente).trim() !== '' ? String(reg.parteCliente) : mock.parteCliente;

  const parteOposta =
    reg?.parteOposta != null && String(reg.parteOposta).trim() !== '' ? String(reg.parteOposta) : mock.parteOposta;

  const tramitacao =
    reg?.tramitacao != null && String(reg.tramitacao).trim() !== '' ? String(reg.tramitacao) : '';

  const cNum = Number(normalizarCliente(codClienteRaw));
  const pNum = Number(normalizarProcesso(procRaw));
  const vinculo = resolverVinculoImovel(cNum, pNum);
  const imovel = vinculo?.mock;

  const papel = String(reg?.papelParte ?? '').toLowerCase();
  const temRegistro = !!reg;
  /** Sem persistência local: coluna de status fica vazia; filtro «ativos» ainda inclui a linha (boolean true). */
  const processoCadastroAtivo = temRegistro ? reg.statusAtivo !== false : true;
  const statusAtivoTexto =
    temRegistro ? (reg.statusAtivo === false ? 'Inativo' : 'Ativo') : '';

  const base = {
    codigoClienteProcesso: mock.codigoCliente,
    numeroProcessoInterno: String(mock.processo),
    clienteCadastroProcesso:
      reg?.cliente != null && String(reg.cliente).trim() !== '' ? String(reg.cliente) : mock.cliente,
    parteCliente,
    parteOposta,
    estadoProcesso:
      reg?.estado != null && String(reg.estado).trim() !== '' ? String(reg.estado) : mock.estado,
    cidadeProcesso:
      reg?.cidade != null && String(reg.cidade).trim() !== '' ? String(reg.cidade) : mock.cidade,
    faseCadastroProcesso: faseCadastro,
    competenciaCadastroProcesso:
      reg?.competencia != null && String(reg.competencia).trim() !== ''
        ? String(reg.competencia)
        : mock.competencia,
    numeroProcessoVelho:
      reg?.numeroProcessoVelho != null && String(reg.numeroProcessoVelho).trim() !== ''
        ? String(reg.numeroProcessoVelho)
        : mock.numeroProcessoVelho ?? '',
    numeroProcessoNovo:
      reg?.numeroProcessoNovo != null && String(reg.numeroProcessoNovo).trim() !== ''
        ? String(reg.numeroProcessoNovo)
        : mock.numeroProcessoNovo ?? '',
    processoCadastroAtivo,
    statusAtivoTexto,
    parteRequerenteTexto: temRegistro ? simNao(papel === 'requerente') : '',
    parteRevelTexto: '',
    parteRequeridoTexto: temRegistro ? simNao(papel === 'requerido') : '',
    dataProtocolo:
      reg?.dataProtocolo != null && String(reg.dataProtocolo).trim() !== ''
        ? String(reg.dataProtocolo)
        : mock.dataProtocolo,
    naturezaAcaoProcesso:
      reg?.naturezaAcao != null && String(reg.naturezaAcao).trim() !== ''
        ? String(reg.naturezaAcao)
        : mock.naturezaAcao,
    valorCausaProcesso:
      reg?.valorCausa != null && String(reg.valorCausa).trim() !== ''
        ? String(reg.valorCausa)
        : mock.valorCausa,
    consultaAutomaticaTexto:
      temRegistro && reg.consultaAutomatica != null ? simNao(reg.consultaAutomatica) : '',
    observacaoCadastroProcesso:
      reg?.observacao != null && String(reg.observacao).trim() !== ''
        ? String(reg.observacao)
        : mock.observacao,
    tramitacao,
    periodicidadeConsulta: reg?.periodicidadeConsulta ?? '',
    prazoFatalCadastroProcesso: reg?.prazoFatal ?? '',
    proximaConsultaCalculada: reg?.proximaConsultaData ?? '',
    ultimoHistoricoInfo: ult?.info ? String(ult.info) : '',
    ultimoHistoricoData: ult?.data ? String(ult.data) : '',
    ultimoHistoricoUsuario: ult?.usuario ? String(ult.usuario).trim() : '',
    tipoAudienciaProcesso: String(reg?.audienciaTipo ?? '').trim(),
    audienciaDataProcesso: String(reg?.audienciaData ?? '').trim(),
    audienciaHoraProcesso: String(reg?.audienciaHora ?? '').trim(),
    imovelIdVinculado: imovel ? String(vinculo.imovelId) : String(reg?.imovelId ?? '').trim(),
    unidadeImovel: imovel ? String(imovel.unidade ?? '') : '',
    enderecoImovel: imovel ? String(imovel.endereco ?? '') : '',
    condominioImovel: imovel ? String(imovel.condominio ?? '') : '',
    pastaArquivoProcesso: String(reg?.pastaArquivo ?? '').trim(),
    procedimentoProcesso: String(reg?.procedimento ?? '').trim(),
    responsavelProcesso: String(reg?.responsavel ?? '').trim(),
    tituloPessoa1Reu: '',
    nPessoa1Reu: '',
    nEndPessoa1Reu: '',
    tituloPessoa1Autor: '',
    nPessoa1Autor: '',
    nEndPessoa1Autor: '',
    unidade: imovel
      ? String(imovel.unidade ?? '')
      : String(reg?.unidade ?? reg?.unidadeEndereco ?? '').trim(),
    tipoAudiencia: String(reg?.audienciaTipo ?? '').trim(),
  };
  const cacheApi = _cacheCamposApi.get(keyClienteProc(codClienteRaw, procRaw));
  return cacheApi ? { ...base, ...cacheApi } : base;
}
