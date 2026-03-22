/**
 * Dados alinhados à tela Processos (mock + localStorage) para enriquecer linhas do Relatório Processos.
 */
import { getDadosProcessoClienteUnificado } from './processoClienteProcUnificado.js';
import { getRegistroProcesso } from './processosHistoricoData.js';
import { loadCadastroClienteDados } from './cadastroClientesStorage.js';
import { getImovelMock, getImoveisMockTotal } from './imoveisMockData.js';
import { getIdPessoaPorCodCliente } from './clientesCadastradosMock.js';
import { getPessoaPorId } from './cadastroPessoasMock.js';

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
 * Nome no Cadastro de Pessoas para o código de cliente (vínculo mock PDF), ou null.
 * Alinhado ao campo "Cliente" na tela Processos (nome da pessoa vinculada ao código).
 */
export function getNomePessoaCadastroPorCodigoCliente(codNum) {
  const n = Number(normalizarCliente(codNum));
  if (!Number.isFinite(n) || n < 1) return null;
  const id = getIdPessoaPorCodCliente(padCliente(n));
  if (id == null) return null;
  const pes = getPessoaPorId(id);
  const nome = pes?.nome?.trim();
  return nome || null;
}

/**
 * Mesma lógica usada na tela Processos — fonte única para mock por cliente/processo
 * (números, partes e natureza alinhados a getDadosProcessoClienteUnificado / Cadastro de Clientes).
 */
export function gerarMockProcesso(codigoCliente, processo) {
  const c = Number(normalizarCliente(codigoCliente));
  const p = Number(normalizarProcesso(processo));
  const nomeClienteCadastro = getNomePessoaCadastroPorCodigoCliente(c);
  const u = getDadosProcessoClienteUnificado(c, p);
  const uf = UFS[(c - 1) % UFS.length]?.sigla ?? 'GO';
  const cidade = (CIDADES_POR_UF[uf] || ['RIO VERDE'])[p % (CIDADES_POR_UF[uf]?.length || 1)] || 'RIO VERDE';
  const fase = FASES[(c + p) % FASES.length] ?? 'Em Andamento';
  const competencia = COMPETENCIAS[(p - 1) % COMPETENCIAS.length] ?? '2º JUIZADO ESPECIAL CÍVEL';

  if (!u) {
    return {
      codigoCliente: padCliente(c),
      processo: p,
      cliente: nomeClienteCadastro ?? `CLIENTE ${String(c).padStart(3, '0')} (MOCK)`,
      parteCliente: '',
      parteOposta: '',
      estado: uf,
      cidade,
      faseSelecionada: fase,
      competencia,
      numeroProcessoVelho: '',
      numeroProcessoNovo: '',
      statusAtivo: (c + p) % 3 !== 0,
      parteRequerente: (c + p) % 3 === 0,
      parteRevel: (c + p) % 3 === 1,
      parteRequerido: (c + p) % 3 === 2,
      dataProtocolo: `${String(((p - 1) % 28) + 1).padStart(2, '0')}/${String(((c - 1) % 12) + 1).padStart(2, '0')}/2025`,
      naturezaAcao: '—',
      valorCausa: `${(1000 + c * 37 + p * 41).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      consultaAutomatica: (c + p) % 2 === 0,
      observacao: `Dados mock do Processo.\nCliente: ${c}\nProcesso: ${p}`,
    };
  }

  return {
    codigoCliente: padCliente(c),
    processo: p,
    cliente: nomeClienteCadastro ?? u.autor,
    parteCliente: u.parteCliente,
    parteOposta: u.parteOposta,
    estado: uf,
    cidade,
    faseSelecionada: fase,
    competencia,
    numeroProcessoVelho: u.processoVelho,
    numeroProcessoNovo: u.processoNovo,
    statusAtivo: (c + p) % 3 !== 0,
    parteRequerente: (c + p) % 3 === 0,
    parteRevel: (c + p) % 3 === 1,
    parteRequerido: (c + p) % 3 === 2,
    dataProtocolo: `${String(((p - 1) % 28) + 1).padStart(2, '0')}/${String(((c - 1) % 12) + 1).padStart(2, '0')}/2025`,
    naturezaAcao: u.naturezaAcao,
    valorCausa: `${(1000 + c * 37 + p * 41).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    consultaAutomatica: (c + p) % 2 === 0,
    observacao: `Dados mock do Processo.\nCliente: ${c}\nProcesso: ${p}`,
  };
}

function simNao(v) {
  return v ? 'Sim' : 'Não';
}

/**
 * Mesmo registro da primeira linha da tabela «Histórico do Processos» (página 1): `historico[0]`.
 * Novas entradas são gravadas no início do array; o mock gera o maior «Inf.» nessa posição.
 */
function primeiroHistoricoComoNaTelaProcessos(historico) {
  const lista = Array.isArray(historico) ? historico : [];
  return lista.length ? lista[0] : null;
}

let _mapaImovelClienteProc = null;

function mapaImovelPorClienteProc() {
  if (_mapaImovelClienteProc) return _mapaImovelClienteProc;
  const map = new Map();
  const total = Number(getImoveisMockTotal?.() ?? 45);
  for (let id = 1; id <= total; id++) {
    const mock = getImovelMock(id);
    if (!mock) continue;
    const codMock = Number(String(mock.codigo ?? '').replace(/\D/g, ''));
    const procMock = Number(mock.proc ?? 0);
    if (Number.isFinite(codMock) && codMock >= 1 && Number.isFinite(procMock) && procMock >= 1) {
      map.set(`${codMock}|${procMock}`, { imovelId: id, mock });
    }
  }
  _mapaImovelClienteProc = map;
  return map;
}

function resolverVinculoImovel(codNum, procNum) {
  return mapaImovelPorClienteProc().get(`${codNum}|${procNum}`) ?? null;
}

/**
 * Mesmo rótulo do select «Cliente é Requerente ou Requerido?» em Processos (`papelParte` em `vilareal:processos-historico:v1`).
 * Sem persistência, usa o mesmo fallback da tela ao carregar: `mock.parteRequerido` → Requerido, senão Requerente.
 */
export function rotuloRequerenteRequeridoUnificado(reg, mock) {
  const papel = String(reg?.papelParte ?? '').trim().toLowerCase();
  if (papel === 'requerente') return 'Requerente';
  if (papel === 'requerido') return 'Requerido';
  return mock.parteRequerido ? 'Requerido' : 'Requerente';
}

/**
 * Campos extras por codCliente + proc (alinhados à tela Processos + persistência).
 * `ultimoHistorico*` usa o mesmo item que a primeira linha do histórico em Processos (`reg.historico[0]`).
 * Usado na coluna dinâmica do Relatório Processos.
 */
export function getCamposExtrasRelatorioPorProcesso(codClienteRaw, procRaw) {
  const mock = gerarMockProcesso(codClienteRaw, procRaw);
  const reg = getRegistroProcesso(mock.codigoCliente, mock.processo);
  const hist = Array.isArray(reg?.historico) ? reg.historico : [];
  const ult = primeiroHistoricoComoNaTelaProcessos(hist);

  const faseCadastro =
    reg?.faseSelecionada != null && String(reg.faseSelecionada).trim() !== ''
      ? String(reg.faseSelecionada)
      : mock.faseSelecionada;

  const parteCliente =
    reg?.parteCliente != null && String(reg.parteCliente).trim() !== '' ? String(reg.parteCliente) : mock.parteCliente;

  /** Mesma prioridade que Processos ao carregar: persistido → grade cadastro cliente → mock. */
  let parteOposta = String(reg?.parteOposta ?? '').trim();
  if (!parteOposta) {
    try {
      const cad = loadCadastroClienteDados(mock.codigoCliente);
      const rows = cad?.processos;
      if (Array.isArray(rows)) {
        const row = rows.find((p) => Number(p?.procNumero) === Number(mock.processo));
        parteOposta = String(row?.parteOposta ?? '').trim();
      }
    } catch {
      /* ignore */
    }
  }
  if (!parteOposta) parteOposta = mock.parteOposta;

  const tramitacao =
    reg?.tramitacao != null && String(reg.tramitacao).trim() !== ''
      ? String(reg.tramitacao)
      : TRAMITACAO_OPCOES[(Number(normalizarCliente(codClienteRaw)) + Number(normalizarProcesso(procRaw))) % TRAMITACAO_OPCOES.length];

  const cNum = Number(normalizarCliente(codClienteRaw));
  const pNum = Number(normalizarProcesso(procRaw));
  const vinculo = resolverVinculoImovel(cNum, pNum);
  const imovel = vinculo?.mock;

  /** Mesmo texto que «Natureza da Ação» no formulário Processos (histórico + mock). */
  const naturezaAcaoUnificada =
    String(reg?.naturezaAcao ?? '').trim() || String(mock.naturezaAcao ?? '').trim();

  const inRequerenteRotulo = rotuloRequerenteRequeridoUnificado(reg, mock);

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
    naturezaAcaoProcesso: naturezaAcaoUnificada,
    /** Coluna «Descrição da Ação» do relatório = mesma fonte que naturezaAcaoProcesso / tela Processos. */
    descricaoAcao: naturezaAcaoUnificada,
    /** Coluna «Requerente/Requerido» = `papelParte` persistido (mesmo campo que Processos). */
    inRequerente: inRequerenteRotulo,
    valorCausaProcesso: mock.valorCausa,
    consultaAutomaticaTexto: simNao(mock.consultaAutomatica),
    observacaoCadastroProcesso: mock.observacao,
    tramitacao,
    periodicidadeConsulta: reg?.periodicidadeConsulta ?? '',
    prazoFatalCadastroProcesso: reg?.prazoFatal ?? '',
    proximaConsultaCalculada: reg?.proximaConsultaData ?? '',
    ultimoHistoricoInfo: ult?.info ? String(ult.info) : '',
    ultimoHistoricoData: ult?.data ? String(ult.data) : '',
    ultimoHistoricoUsuario: ult?.usuario ? String(ult.usuario).trim() : '',
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
