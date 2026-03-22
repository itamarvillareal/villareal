/**
 * Dados alinhados à tela Processos (mock + localStorage) para enriquecer linhas do Relatório Processos.
 */
import { getMockProcesso10x10 } from './processosMock.js';
import { getRegistroProcesso, getHistoricoDoProcesso } from './processosHistoricoData.js';
import { getImovelMock, getImoveisMockTotal } from './imoveisMockData.js';

export const UFS = [
  { sigla: 'GO', nome: 'GOIÁS' },
  { sigla: 'SP', nome: 'SÃO PAULO' },
  { sigla: 'MG', nome: 'MINAS GERAIS' },
  { sigla: 'RJ', nome: 'RIO DE JANEIRO' },
  { sigla: 'PI', nome: 'PIAUÍ' },
];

export const CIDADES_POR_UF = {
  GO: ['RIO VERDE', 'GOIÂNIA', 'ANÁPOLIS', 'APARECIDA DE GOIÂNIA'],
  SP: ['SÃO PAULO', 'CAMPINAS', 'RIBEIRÃO PRETO'],
  MG: ['BELO HORIZONTE', 'UBERLÂNDIA'],
  RJ: ['RIO DE JANEIRO', 'NITERÓI'],
  PI: ['TERESINA', 'PARNÁIBA'],
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

export const COMPETENCIAS = [
  '1º JUIZADO ESPECIAL CÍVEL',
  '2º JUIZADO ESPECIAL CÍVEL',
  '3º JUIZADO ESPECIAL CÍVEL',
  'VARA CÍVEL',
];

export const TRAMITACAO_OPCOES = ['Projudi', 'PJe', 'TJ Go - Autos Físicos'];

const TIPOS_AUDIENCIA = ['Inicial', 'Instrução', 'Conciliação', 'Una', 'Rito sumaríssimo'];

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
 * Mesma lógica usada na tela Processos — fonte única para mock por cliente/processo.
 */
export function gerarMockProcesso(codigoCliente, processo) {
  const c = Number(normalizarCliente(codigoCliente));
  const p = Number(normalizarProcesso(processo));
  const mock10 = getMockProcesso10x10(c, p);
  if (mock10) {
    const uf = UFS[(c - 1) % UFS.length]?.sigla ?? 'GO';
    const cidade = (CIDADES_POR_UF[uf] || ['RIO VERDE'])[p % (CIDADES_POR_UF[uf]?.length || 1)] || 'RIO VERDE';
    const fase = FASES[(c + p) % FASES.length] ?? 'Em Andamento';
    const competencia = COMPETENCIAS[(p - 1) % COMPETENCIAS.length] ?? '2º JUIZADO ESPECIAL CÍVEL';
    return {
      codigoCliente: mock10.codigoCliente,
      processo: mock10.processo,
      cliente: mock10.autor,
      parteCliente: mock10.parteCliente,
      parteOposta: mock10.parteOposta,
      estado: uf,
      cidade,
      faseSelecionada: fase,
      competencia,
      numeroProcessoVelho: mock10.numeroProcessoVelho,
      numeroProcessoNovo: mock10.numeroProcessoNovo,
      statusAtivo: (c + p) % 3 !== 0,
      parteRequerente: (c + p) % 3 === 0,
      parteRevel: (c + p) % 3 === 1,
      parteRequerido: (c + p) % 3 === 2,
      dataProtocolo: `${String(((p - 1) % 28) + 1).padStart(2, '0')}/${String(((c - 1) % 12) + 1).padStart(2, '0')}/2025`,
      naturezaAcao: `AÇÃO (MOCK) — Cliente ${c} / Proc ${p}`,
      valorCausa: `${(1000 + c * 37 + p * 41).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      consultaAutomatica: (c + p) % 2 === 0,
      observacao: `Dados mock do Processo.\nCliente: ${c}\nProcesso: ${p}`,
    };
  }
  const uf = UFS[(c - 1) % UFS.length]?.sigla ?? 'GO';
  const cidade = (CIDADES_POR_UF[uf] || ['RIO VERDE'])[p % (CIDADES_POR_UF[uf]?.length || 1)] || 'RIO VERDE';
  const fase = FASES[(c + p) % FASES.length] ?? 'Em Andamento';
  const competencia = COMPETENCIAS[(p - 1) % COMPETENCIAS.length] ?? '2º JUIZADO ESPECIAL CÍVEL';
  const cliente = `CLIENTE ${String(c).padStart(3, '0')} (MOCK)`;
  const parteCliente = `PARTE CLIENTE ${String(c).padStart(3, '0')} — PROC ${String(p).padStart(2, '0')}`;
  const parteOposta = `PARTE OPOSTA ${String((c * 7 + p) % 999).padStart(3, '0')} — PROC ${String(p).padStart(2, '0')}`;
  const numeroProcessoNovo = `${String(5000000 + c * 13 + p).slice(0, 7)}-${String(10 + (p % 90)).padStart(2, '0')}.2025.8.09.${String(1000 + (c % 900)).slice(-4)}`;
  return {
    codigoCliente: padCliente(c),
    processo: p,
    cliente,
    parteCliente,
    parteOposta,
    estado: uf,
    cidade,
    faseSelecionada: fase,
    competencia,
    numeroProcessoVelho: '',
    numeroProcessoNovo,
    statusAtivo: (c + p) % 3 !== 0,
    parteRequerente: (c + p) % 3 === 0,
    parteRevel: (c + p) % 3 === 1,
    parteRequerido: (c + p) % 3 === 2,
    dataProtocolo: `${String(((p - 1) % 28) + 1).padStart(2, '0')}/${String(((c - 1) % 12) + 1).padStart(2, '0')}/2025`,
    naturezaAcao: `AÇÃO (MOCK) — Cliente ${c} / Proc ${p}`,
    valorCausa: `${(1000 + c * 37 + p * 41).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    consultaAutomatica: (c + p) % 2 === 0,
    observacao: `Dados mock do Processo.\nCliente: ${c}\nProcesso: ${p}`,
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

/** Último item do histórico pela maior data dd/mm/aaaa. */
function ultimoHistoricoPorData(historico) {
  const lista = Array.isArray(historico) ? historico : [];
  let best = null;
  let bestTs = -1;
  for (const h of lista) {
    const ts = parseDataBrParaTs(h?.data);
    if (ts >= bestTs) {
      bestTs = ts;
      best = h;
    }
  }
  return best;
}

function resolverVinculoImovel(codNum, procNum) {
  const total = Number(getImoveisMockTotal?.() ?? 45);
  for (let id = 1; id <= total; id++) {
    const mock = getImovelMock(id);
    if (!mock) continue;
    const codMock = Number(String(mock.codigo ?? '').replace(/\D/g, ''));
    const procMock = Number(mock.proc ?? 0);
    if (codMock === codNum && procMock === procNum) {
      return { imovelId: id, mock };
    }
  }
  return null;
}

/**
 * Campos extras por codCliente + proc (alinhados à tela Processos + persistência).
 * Usado na coluna dinâmica do Relatório Processos.
 */
export function getCamposExtrasRelatorioPorProcesso(codClienteRaw, procRaw) {
  const mock = gerarMockProcesso(codClienteRaw, procRaw);
  const reg = getRegistroProcesso(mock.codigoCliente, mock.processo);
  const hist = getHistoricoDoProcesso(mock.codigoCliente, mock.processo);
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
    reg?.tramitacao != null && String(reg.tramitacao).trim() !== ''
      ? String(reg.tramitacao)
      : TRAMITACAO_OPCOES[(Number(normalizarCliente(codClienteRaw)) + Number(normalizarProcesso(procRaw))) % TRAMITACAO_OPCOES.length];

  const cNum = Number(normalizarCliente(codClienteRaw));
  const pNum = Number(normalizarProcesso(procRaw));
  const vinculo = resolverVinculoImovel(cNum, pNum);
  const imovel = vinculo?.mock;

  return {
    codigoClienteProcesso: mock.codigoCliente,
    numeroProcessoInterno: String(mock.processo),
    clienteCadastroProcesso: mock.cliente,
    parteCliente,
    parteOposta,
    estadoProcesso: mock.estado,
    cidadeProcesso: mock.cidade,
    faseCadastroProcesso: faseCadastro,
    competenciaCadastroProcesso: mock.competencia,
    numeroProcessoVelho: mock.numeroProcessoVelho ?? '',
    numeroProcessoNovo: mock.numeroProcessoNovo ?? '',
    /** Alinhado ao cadastro Processos — usado para filtrar ativos/inativos no relatório. */
    processoCadastroAtivo: !!mock.statusAtivo,
    statusAtivoTexto: mock.statusAtivo ? 'Ativo' : 'Inativo',
    parteRequerenteTexto: simNao(mock.parteRequerente),
    parteRevelTexto: simNao(mock.parteRevel),
    parteRequeridoTexto: simNao(mock.parteRequerido),
    dataProtocolo: mock.dataProtocolo,
    naturezaAcaoProcesso: mock.naturezaAcao,
    valorCausaProcesso: mock.valorCausa,
    consultaAutomaticaTexto: simNao(mock.consultaAutomatica),
    observacaoCadastroProcesso: mock.observacao,
    tramitacao,
    periodicidadeConsulta: reg?.periodicidadeConsulta ?? '',
    prazoFatalCadastroProcesso: reg?.prazoFatal ?? '',
    proximaConsultaCalculada: reg?.proximaConsultaData ?? '',
    ultimoHistoricoInfo: ult?.info ? String(ult.info) : '',
    ultimoHistoricoData: ult?.data ? String(ult.data) : '',
    tipoAudienciaProcesso: TIPOS_AUDIENCIA[(cNum + pNum) % TIPOS_AUDIENCIA.length],
    audienciaDataProcesso: `${String(((cNum + pNum * 3) % 28) + 1).padStart(2, '0')}/${String(((cNum + pNum) % 12) + 1).padStart(2, '0')}/2026`,
    audienciaHoraProcesso: `${String(8 + ((cNum + pNum) % 10)).padStart(2, '0')}:00`,
    imovelIdVinculado: imovel ? String(vinculo.imovelId) : '',
    unidadeImovel: imovel ? String(imovel.unidade ?? '') : '',
    enderecoImovel: imovel ? String(imovel.endereco ?? '') : '',
    condominioImovel: imovel ? String(imovel.condominio ?? '') : '',
    pastaArquivoProcesso: `PASTA-${mock.codigoCliente}-${mock.processo}`,
    procedimentoProcesso: `PROC-ADM-${(cNum + pNum) % 900 + 100}`,
    responsavelProcesso: ['KARLA', 'ITAMAR', 'DAAE', 'ANA'][(cNum + pNum) % 4],
    // Pessoas (exibição tipo cadastro — determinístico por cliente/proc)
    tituloPessoa1Reu: pNum % 2 === 0 ? '1º Réu' : 'Corréu',
    nPessoa1Reu: `${String(10000000000 + cNum * 137 + pNum * 41).slice(0, 11)}`,
    nEndPessoa1Reu: `Rua Processo ${cNum}, ${100 + pNum} — CEP ${String(74000000 + (cNum + pNum) % 99999).slice(0, 8)}`,
    tituloPessoa1Autor: 'Autor',
    nPessoa1Autor: `${String(50000000000 + cNum * 211 + pNum * 17).slice(0, 11)}`,
    nEndPessoa1Autor: `Av. Central, ${200 + pNum} — Apto ${((cNum + pNum) % 40) + 1}`,
    unidade: imovel
      ? String(imovel.unidade ?? '')
      : `QD.${String((pNum % 6) + 1).padStart(2, '0')} LT.${String((cNum % 12) + 1).padStart(2, '0')}`,
    tipoAudiencia: TIPOS_AUDIENCIA[(cNum + pNum) % TIPOS_AUDIENCIA.length],
  };
}
