import { request } from '../api/httpClient.js';
import { formatValorMoedaCampo } from '../utils/moneyBr.js';
import { parseValorMonetarioBr } from '../utils/parseValorMonetarioBr.js';
import { featureFlags, FEATURE_IPTU_NOVO } from '../config/featureFlags.js';
import {
  carregarVinculoLocatarioImovel,
  extrairExtrasVinculoLocatarioJsonDoUi,
  mesclarCamposVinculoLocatarioDoUiNoItem,
  mesclarExtrasVinculoLocatarioNoItem,
  removerExtrasVinculoLocatarioDoObjeto,
  resolverProcessoIdParaVinculoUi,
  salvarVinculoLocatarioImovel,
  usuarioAlterouVinculoProcessoNoFormulario,
} from './imoveisVinculoLocatario.js';
import {
  getTransacoesContaCorrenteCompleto,
  normalizarCodigoClienteFinanceiro,
  normalizarProcFinanceiro,
} from '../data/financeiroData.js';
import {
  mapRelatorioFinanceiroBackendParaLinhas,
  montarPainelAdministracaoImovelDeTransacoes,
} from '../data/imoveisAdministracaoFinanceiro.js';
import { TAG_ADM_ALUGUEL } from '../data/imoveisAdministracaoFinanceiro.js';
import {
  construirPerfilHistoricoImovel,
  gerarSugestoesVinculoImoveis,
  lancamentoApiCreditoBanco,
  lancamentoApiExtratoBanco,
  lancamentoApiSemVinculoProcesso,
  lancamentoUiParaPerfilHistorico,
  mesesRecentesParaBusca,
} from '../data/imoveisVinculoSugestoes.js';
import { filtrarSugestoesSemDescartadas } from '../data/imoveisVinculoSugestoesDescartes.js';
import { mapApiLancamentoToExtratoRow, extratoRowToUi } from '../components/financeiro/extrato/extratoMappers.js';
import { buscarCliente } from '../api/clientesService.js';
import {
  buscarLancamentoFinanceiroApi,
  listarLancamentosExtratoNoIntervalo,
  listarLancamentosFinanceiroPaginados,
  listarLancamentosProcessoApiFirst,
  salvarOuAtualizarLancamentoFinanceiroApi,
} from './financeiroRepository.js';
import {
  buscarClientePorCodigo,
  buscarProcessoPorChaveNatural,
  buscarProcessoPorId,
  resolverProcessoId,
} from './processosRepository.js';
import { listarParesCodProcPorNumeroImovelProcessos } from '../data/processosHistoricoData.js';

/** Cache em memória: número da pessoa → nome (evita N×GET no relatório). */
const cacheNomePessoa = new Map();
/** Cache curto para dados completos de pessoa (nome/cpf/contato) usados nas partes do imóvel. */
const cacheDadosPessoa = new Map();

function formatDocBrExibicao(digits) {
  const d = String(digits ?? '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return d || '—';
}

/**
 * Observações canônicas na leitura: coluna imovel → contrato → extras legado.
 * @param {object|null|undefined} imovel
 * @param {object|null|undefined} contrato
 * @param {Record<string, unknown>} [extras]
 */
export function resolverObservacoesImovelParaUi(imovel, contrato, extras = {}) {
  const col = String(imovel?.observacoes ?? '').trim();
  if (col) return col;
  const contr = String(contrato?.observacoes ?? '').trim();
  if (contr) return contr;
  return String(extras.observacoesInquilino ?? extras.obsInquilino ?? '').trim();
}

function preservarChaveExtrasLegado(extrasOrig, chaves) {
  for (const chave of chaves) {
    const v = String(extrasOrig?.[chave] ?? '').trim();
    if (v) return v;
  }
  return '';
}

async function resolverDadosPessoaPorId(idPessoa) {
  if (!idPessoa) return null;
  if (cacheDadosPessoa.has(idPessoa)) return cacheDadosPessoa.get(idPessoa);
  try {
    const p = await buscarCliente(idPessoa);
    if (!p) {
      cacheDadosPessoa.set(idPessoa, null);
      return null;
    }
    const dados = {
      nome: String(p.nome ?? '').trim(),
      cpf: formatDocBrExibicao(p.cpf),
      contato: String(p.telefone ?? '').trim() || '—',
    };
    cacheDadosPessoa.set(idPessoa, dados);
    cacheNomePessoa.set(idPessoa, dados.nome);
    return dados;
  } catch {
    cacheDadosPessoa.set(idPessoa, null);
    return null;
  }
}

// -----------------------------------------------------------------------------
// Fase 7 — imóveis / locações
// - API-first: leitura e persistência via REST quando `featureFlags.useApiImoveis`.
// - Sem API de imóveis: não há cadastro legado local — use `VITE_USE_API_IMOVEIS=true`.
// - Transição: resolução de cliente/processo por Cod.+Proc. ao salvar imóvel na API.
// -----------------------------------------------------------------------------

function padCliente8(value) {
  const d = String(value ?? '').replace(/\D/g, '');
  const n = Number(d || '1');
  const safe = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  return String(safe).padStart(8, '0');
}

function normalizarProcUi(proc) {
  const n = Number.parseInt(String(proc ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n >= 1 ? String(n) : String(proc ?? '').trim();
}

/**
 * Cod+proc exibidos no formulário: N:N da API (processoId + codigoCliente + numeroInterno) antes dos extras.
 */
export function derivarCodProcUiImovel(imovel, extras = {}) {
  const processoIdApi = imovel?.processoId;
  if (processoIdApi != null && Number(processoIdApi) > 0) {
    const codNn = imovel?.codigoCliente ? padCliente8(imovel.codigoCliente) : '';
    const procNn =
      imovel?.numeroInternoProcesso != null ? normalizarProcUi(imovel.numeroInternoProcesso) : '';
    if (codNn && procNn) {
      return { codigo: codNn, proc: procNn, fonte: 'nn' };
    }
  }
  const codigo = String(extras.codigo || imovel?.codigoCliente || '').trim();
  const proc = String(
    extras.proc || (imovel?.numeroInternoProcesso != null ? imovel.numeroInternoProcesso : ''),
  ).trim();
  return {
    codigo: codigo ? padCliente8(codigo) : '',
    proc: proc ? normalizarProcUi(proc) : '',
    fonte: 'extras',
  };
}

function usuarioAlterouVinculoProcessoNoForm(uiPayload) {
  const codForm = String(uiPayload.codigo ?? '').trim();
  const procForm = normalizarProcUi(uiPayload.proc);
  const codOrig = String(uiPayload._vinculoCodigoOriginal ?? uiPayload.codigo ?? '').trim();
  const procOrig = normalizarProcUi(uiPayload._vinculoProcOriginal ?? uiPayload.proc);
  return codForm !== codOrig || procForm !== procOrig;
}

function toIsoDate(dateBr) {
  const s = String(dateBr ?? '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function toBrDate(dateIso) {
  const s = String(dateIso ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function toNumberOrNull(v) {
  const n = parseValorMonetarioBr(v);
  return n != null && Number.isFinite(n) ? n : null;
}

function parseJsonSafe(s, fallback = {}) {
  try {
    const p = JSON.parse(String(s || ''));
    return p && typeof p === 'object' ? p : fallback;
  } catch {
    return fallback;
  }
}

function simNaoParaUi(v) {
  if (v === true) return 'sim';
  if (v === false) return 'nao';
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'true' || s === 'sim') return 'sim';
  if (s === 'false' || s === 'nao' || s === 'não') return 'nao';
  return String(v ?? '');
}

function toBrDateFlex(v) {
  if (v == null || v === '') return '';
  const iso = toBrDate(v);
  if (iso) return iso;
  const s = String(v).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const digits = s.replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  }
  return '';
}

/**
 * Unifica chaves de `campos_extras_json` (import Java, import Node layout Itamar e UI).
 * @param {Record<string, unknown>} rawExtras
 */
export function normalizarExtrasImovelParaUi(rawExtras = {}) {
  const e = rawExtras && typeof rawExtras === 'object' ? rawExtras : {};
  return {
    codigo: String(e.codigo ?? ''),
    proc: String(e.proc ?? ''),
    observacoesInquilino: String(e.observacoesInquilino ?? e.obsInquilino ?? ''),
    dataPag1TxCond: toBrDateFlex(e.dataPag1TxCond ?? e.dataPagamento1TxCondominial),
    ...(!FEATURE_IPTU_NOVO
      ? {
          existeDebIptu: simNaoParaUi(e.existeDebIptu ?? e.existeDebitoIptu),
          dataConsIptu: toBrDateFlex(e.dataConsIptu ?? e.dataConsultaDebitoIptu),
          infoIptuTexto: String(e.infoIptuTexto ?? e.iptuTexto ?? ''),
        }
      : {}),
    aguaNumero: String(e.aguaNumero ?? e.saneagoMatricula ?? ''),
    diaVencAgua: e.diaVencAgua != null && String(e.diaVencAgua) !== '' ? String(e.diaVencAgua) : e.diaVencSaneago != null ? String(e.diaVencSaneago) : '',
    existeDebAgua: simNaoParaUi(e.existeDebAgua ?? e.existeDebitoAgua),
    dataConsAgua: toBrDateFlex(e.dataConsAgua ?? e.dataConsultaDebitoAgua),
    energiaNumero: String(e.energiaNumero ?? e.energiaMatricula ?? ''),
    diaVencEnergia: e.diaVencEnergia != null && String(e.diaVencEnergia) !== '' ? String(e.diaVencEnergia) : e.diaVencEnel != null ? String(e.diaVencEnel) : '',
    existeDebEnergia: simNaoParaUi(e.existeDebEnergia ?? e.existeDebitoEnergia),
    dataConsEnergia: toBrDateFlex(e.dataConsEnergia ?? e.dataConsultaDebitoEnergia),
    gasNumero: String(e.gasNumero ?? e.gasMatricula ?? ''),
    diaVencGas: e.diaVencGas != null && String(e.diaVencGas) !== '' ? String(e.diaVencGas) : '',
    existeDebGas: simNaoParaUi(e.existeDebGas ?? e.existeDebitoGas),
    dataConsGas: toBrDateFlex(e.dataConsGas ?? e.dataConsultaDebitoGas),
    dataConsDebitoCond: toBrDateFlex(e.dataConsDebitoCond ?? e.dataConsultaDebitoCondominio),
    existeDebitoCond: simNaoParaUi(e.existeDebitoCond ?? e.existeDebitoCondominio),
    valorGarantia: e.valorGarantia != null ? String(e.valorGarantia) : '',
    proprietario: String(e.proprietario ?? ''),
    proprietarioCpf: String(e.proprietarioCpf ?? ''),
    proprietarioContato: String(e.proprietarioContato ?? ''),
    linkVistoria: String(e.linkVistoria ?? ''),
    inquilino: String(e.inquilino ?? ''),
    inquilinoCpf: String(e.inquilinoCpf ?? ''),
    inquilinoContato: String(e.inquilinoContato ?? ''),
    contratoAssinadoInquilino: String(e.contratoAssinadoInquilino ?? 'nao'),
    contratoAssinadoProprietario: String(e.contratoAssinadoProprietario ?? 'nao'),
    contratoAssinadoGarantidor: String(e.contratoAssinadoGarantidor ?? 'nao'),
    contratoAssinadoTestemunhas: String(e.contratoAssinadoTestemunhas ?? 'nao'),
    contratoArquivado: String(e.contratoArquivado ?? 'nao'),
    contratoIntermediacaoArquivado: String(
      e.contratoIntermediacaoArquivado ?? e.contIntermImobArquivado ?? 'nao',
    ),
    contratoIntermediacaoAssinadoProprietario: String(
      e.contratoIntermediacaoAssinadoProprietario ?? e.contIntermImobAssProprietario ?? 'nao',
    ),
    inscricaoMunicipal: String(e.inscricaoMunicipal ?? ''),
  };
}

async function enriquecerCodigoProcDoVinculo(item, apiImovel) {
  if (!item) return item;
  const principal = await resolverVinculoPrincipalProcessoImovel({
    ...item,
    _apiImovelId: item._apiImovelId ?? apiImovel?.id ?? null,
    numeroPlanilhaColA: item.numeroPlanilhaColA ?? apiImovel?.numeroPlanilha ?? null,
  });
  if (principal) {
    return {
      ...item,
      codigo: principal.codigo,
      proc: principal.proc,
      _vinculoCodigoOriginal: principal.codigo,
      _vinculoProcOriginal: principal.proc,
      _apiProcessoId: principal.processoId ?? item._apiProcessoId ?? null,
    };
  }
  return item;
}

const STATUS_ORDEM_CONTRATO = { VIGENTE: 0, RASCUNHO: 1, ENCERRADO: 2, RESCINDIDO: 3 };

function parseIsoDateInicio(s) {
  if (!s) return null;
  const d = new Date(`${String(s).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ordenarContratoPreferido(a, b) {
  const c = String(b.dataInicio || '').localeCompare(String(a.dataInicio || ''));
  if (c !== 0) return c;
  return Number(b.id || 0) - Number(a.id || 0);
}

/**
 * Contrato de referência por imóvel quando existem vários registros em `contratos_locacao`.
 * Regra (detalhes em docs/frontend-phase-7-imoveis-stabilization.md):
 * 1) Entre os de status VIGENTE, preferir o cuja data de referência (padrão: hoje) esteja entre dataInicio e dataFim (dataFim ausente = sem limite superior).
 * 2) Se nenhum VIGENTE couber no período: entre os VIGENTE, dataInicio mais recente (e id maior em empate).
 * 3) Se não houver VIGENTE: RASCUNHO com dataInicio mais recente.
 * 4) Caso contrário: menor ordem de status (ENCERRADO antes de RESCINDIDO, etc.) e dataInicio mais recente.
 *
 * @param {Array<object>} contratos — lista de `GET /api/locacoes/contratos?imovelId=`
 * @param {Date} [dataReferencia]
 * @returns {object|null}
 */
export function selecionarContratoVigente(contratos, dataReferencia = new Date()) {
  if (!Array.isArray(contratos) || contratos.length === 0) return null;
  const ref = new Date(dataReferencia);
  ref.setHours(12, 0, 0, 0);
  const st = (x) => String(x?.status ?? '').toUpperCase();

  const vigNoPeriodo = contratos.filter((c) => {
    if (st(c) !== 'VIGENTE') return false;
    const i = parseIsoDateInicio(c.dataInicio);
    const f = parseIsoDateInicio(c.dataFim);
    if (!i) return false;
    if (ref < i) return false;
    if (f && ref > f) return false;
    return true;
  });
  if (vigNoPeriodo.length) return [...vigNoPeriodo].sort(ordenarContratoPreferido)[0];

  const soVigentes = contratos.filter((c) => st(c) === 'VIGENTE');
  if (soVigentes.length) return [...soVigentes].sort(ordenarContratoPreferido)[0];

  const rascunhos = contratos.filter((c) => st(c) === 'RASCUNHO');
  if (rascunhos.length) return [...rascunhos].sort(ordenarContratoPreferido)[0];

  return [...contratos].sort((a, b) => {
    const oa = STATUS_ORDEM_CONTRATO[st(a)] ?? 99;
    const ob = STATUS_ORDEM_CONTRATO[st(b)] ?? 99;
    if (oa !== ob) return oa - ob;
    return ordenarContratoPreferido(a, b);
  })[0];
}

/**
 * Descarta id de contrato que não pertence ao imóvel e devolve o vigente desta lista.
 * Evita PUT/PDF com contrato de outro imóvel (erro «Contrato não pertence ao imóvel informado»).
 */
export function alinharContratoIdAoImovel(contratoIdHint, contratosLista) {
  const lista = Array.isArray(contratosLista) ? contratosLista : [];
  if (!lista.length) return null;
  const hint =
    contratoIdHint != null && Number.isFinite(Number(contratoIdHint)) && Number(contratoIdHint) > 0
      ? Number(contratoIdHint)
      : null;
  const referenciado = hint != null ? lista.find((c) => Number(c.id) === hint) : null;
  const base = referenciado ?? selecionarContratoVigente(lista);
  return base?.id != null && Number(base.id) > 0 ? Number(base.id) : null;
}

export async function resolverContratoLocacaoIdParaImovel(imovelIdApi, contratoIdHint = null) {
  const imovelId = Number(imovelIdApi);
  if (!Number.isFinite(imovelId) || imovelId < 1) {
    const hint = Number(contratoIdHint);
    return Number.isFinite(hint) && hint > 0 ? hint : null;
  }
  try {
    const contratos = await request('/api/locacoes/contratos', { query: { imovelId } });
    return alinharContratoIdAoImovel(contratoIdHint, Array.isArray(contratos) ? contratos : []);
  } catch {
    const hint = Number(contratoIdHint);
    return Number.isFinite(hint) && hint > 0 ? hint : null;
  }
}

/** Mapeia o objeto legado `getImovelMock` para o formato de formulário/UI (sem IDs de API). */
export function mapMockToUi(mock, imovelId) {
  if (!mock) return null;
  return {
    imovelId: Number(imovelId),
    imovelOcupado: !!mock.imovelOcupado,
    codigo: String(mock.codigo ?? ''),
    proc: String(mock.proc ?? ''),
    observacoesInquilino: String(mock.observacoesInquilino ?? ''),
    endereco: String(mock.endereco ?? ''),
    condominio: String(mock.condominio ?? ''),
    unidade: String(mock.unidade ?? ''),
    garagens: String(mock.garagens ?? ''),
    garantia: String(mock.garantia ?? ''),
    valorGarantia: String(mock.valorGarantia ?? ''),
    valorLocacao: String(mock.valorLocacao ?? ''),
    taxaAdministracaoPercent: String(mock.taxaAdministracaoPercent ?? '10'),
    diaPagAluguel: String(mock.diaPagAluguel ?? ''),
    dataPag1TxCond: String(mock.dataPag1TxCond ?? ''),
    inscricaoImobiliaria: String(mock.inscricaoImobiliaria ?? ''),
    numeroPlanilhaColA: Number.isFinite(Number(imovelId)) ? Number(imovelId) : null,
    ...(FEATURE_IPTU_NOVO
      ? {}
      : {
          existeDebIptu: String(mock.existeDebIptu ?? ''),
          dataConsIptu: String(mock.dataConsIptu ?? ''),
          infoIptuTexto: String(mock.infoIptuTexto ?? ''),
        }),
    aguaNumero: String(mock.aguaNumero ?? ''),
    dataConsAgua: String(mock.dataConsAgua ?? ''),
    existeDebAgua: String(mock.existeDebAgua ?? ''),
    diaVencAgua: String(mock.diaVencAgua ?? ''),
    energiaNumero: String(mock.energiaNumero ?? ''),
    dataConsEnergia: String(mock.dataConsEnergia ?? ''),
    existeDebEnergia: String(mock.existeDebEnergia ?? ''),
    diaVencEnergia: String(mock.diaVencEnergia ?? ''),
    gasNumero: String(mock.gasNumero ?? ''),
    dataConsGas: String(mock.dataConsGas ?? ''),
    existeDebGas: String(mock.existeDebGas ?? ''),
    diaVencGas: String(mock.diaVencGas ?? ''),
    dataInicioContrato: String(mock.dataInicioContrato ?? ''),
    dataFimContrato: String(mock.dataFimContrato ?? ''),
    dataConsDebitoCond: String(mock.dataConsDebitoCond ?? ''),
    existeDebitoCond: String(mock.existeDebitoCond ?? ''),
    diaRepasse: String(mock.diaRepasse ?? ''),
    banco: String(mock.banco ?? ''),
    agencia: String(mock.agencia ?? ''),
    numeroBanco: String(mock.numeroBanco ?? ''),
    conta: String(mock.conta ?? ''),
    cpfBanco: String(mock.cpfBanco ?? ''),
    titular: String(mock.titular ?? ''),
    chavePix: String(mock.chavePix ?? ''),
    proprietarioNumeroPessoa: String(mock.proprietarioNumeroPessoa ?? ''),
    proprietario: String(mock.proprietario ?? ''),
    proprietarioCpf: String(mock.proprietarioCpf ?? ''),
    proprietarioContato: String(mock.proprietarioContato ?? ''),
    linkVistoria: String(mock.linkVistoria ?? ''),
    inquilinoNumeroPessoa: String(mock.inquilinoNumeroPessoa ?? ''),
    inquilino: String(mock.inquilino ?? ''),
    inquilinoCpf: String(mock.inquilinoCpf ?? ''),
    inquilinoContato: String(mock.inquilinoContato ?? ''),
    contratoAssinadoInquilino: 'nao',
    contratoAssinadoProprietario: 'nao',
    contratoAssinadoGarantidor: 'nao',
    contratoAssinadoTestemunhas: 'nao',
    contratoArquivado: 'nao',
    contratoIntermediacaoArquivado: 'nao',
    contratoIntermediacaoAssinadoProprietario: 'nao',
    _apiImovelId: null,
    _apiContratoId: null,
    _apiClienteId: null,
    _apiProcessoId: null,
  };
}

function parseIdPessoa(raw) {
  const id = Number.parseInt(String(raw ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(id) && id >= 1 ? id : null;
}

async function resolverNomePessoaPorId(idPessoa) {
  if (!idPessoa) return '';
  if (cacheNomePessoa.has(idPessoa)) return cacheNomePessoa.get(idPessoa);
  try {
    const p = await buscarCliente(idPessoa);
    const nome = String(p?.nome ?? '').trim();
    cacheNomePessoa.set(idPessoa, nome);
    return nome;
  } catch {
    cacheNomePessoa.set(idPessoa, '');
    return '';
  }
}

/**
 * Preenche inquilino/proprietário: FK (pessoa) tem prioridade; JSON legado só sem FK.
 */
function mapFiadoresUi(contrato, extras) {
  const ids = Array.isArray(contrato?.fiadoresPessoaIds)
    ? contrato.fiadoresPessoaIds.filter((id) => id != null && Number(id) > 0)
    : [];
  if (ids.length) {
    return ids.map((id) => ({ pessoaId: String(id), nome: '', cpf: '', contato: '' }));
  }
  const legado = Array.isArray(extras?.fiadores) ? extras.fiadores : [];
  return legado
    .map((f) => ({
      pessoaId: String(f?.pessoaId ?? f?.id ?? '').trim(),
      nome: String(f?.nome ?? '').trim(),
      cpf: String(f?.cpf ?? '').trim(),
      contato: String(f?.contato ?? '').trim(),
    }))
    .filter((f) => f.pessoaId);
}

function extrairFiadoresPessoaIds(ui) {
  return (Array.isArray(ui?.fiadores) ? ui.fiadores : [])
    .map((f) => parseIdPessoa(f?.pessoaId))
    .filter((id) => id != null && id > 0);
}

function normalizarEntradaInquilinoUi(f) {
  const pessoaId = String(f?.pessoaId ?? f?.id ?? '').trim();
  if (!pessoaId) return null;
  return {
    pessoaId,
    nome: String(f?.nome ?? '').trim(),
    cpf: String(f?.cpf ?? '').trim(),
    contato: String(f?.contato ?? '').trim(),
  };
}

function mesclarInquilinosListaUi(contratoLista, extrasLista) {
  const map = new Map();
  for (const f of [...(contratoLista || []), ...(extrasLista || [])]) {
    const row = normalizarEntradaInquilinoUi(f);
    if (!row) continue;
    const prev = map.get(row.pessoaId) ?? {};
    map.set(row.pessoaId, {
      pessoaId: row.pessoaId,
      nome: String(row.nome || prev.nome || '').trim(),
      cpf: String(row.cpf || prev.cpf || '').trim(),
      contato: String(row.contato || prev.contato || '').trim(),
    });
  }
  return [...map.values()];
}

function mapInquilinosUi(contrato, extras) {
  const ids = Array.isArray(contrato?.inquilinosPessoaIds)
    ? contrato.inquilinosPessoaIds.filter((id) => id != null && Number(id) > 0)
    : [];
  let fromContrato = [];
  if (ids.length) {
    fromContrato = ids.map((id) => ({ pessoaId: String(id), nome: '', cpf: '', contato: '' }));
  } else {
    const legadoId = parseIdPessoa(
      contrato?.inquilinoPessoaId ?? extras?.inquilinoPessoaId ?? extras?.inquilinoNumeroPessoa,
    );
    if (legadoId) {
      fromContrato = [
        {
          pessoaId: String(legadoId),
          nome: String(extras?.inquilino ?? '').trim(),
          cpf: String(extras?.inquilinoCpf ?? '').trim(),
          contato: String(extras?.inquilinoContato ?? '').trim(),
        },
      ];
    }
  }
  const fromExtras = Array.isArray(extras?.inquilinos)
    ? extras.inquilinos.map(normalizarEntradaInquilinoUi).filter(Boolean)
    : [];
  return mesclarInquilinosListaUi(fromContrato, fromExtras);
}

function extrairInquilinosPessoaIds(ui) {
  if (Array.isArray(ui?.inquilinos) && ui.inquilinos.length) {
    return ui.inquilinos
      .map((f) => parseIdPessoa(f?.pessoaId))
      .filter((id) => id != null && id > 0);
  }
  const legado = parseIdPessoa(ui?.inquilinoNumeroPessoa);
  return legado != null ? [legado] : [];
}

export async function enriquecerNomesPartesImovelUi(item) {
  if (!item) return item;
  const idInq = parseIdPessoa(item.inquilinoNumeroPessoa);
  const idProp = parseIdPessoa(item.proprietarioNumeroPessoa);

  let inquilino = String(item.inquilino ?? '').trim();
  let inquilinoCpf = String(item.inquilinoCpf ?? '').trim();
  let inquilinoContato = String(item.inquilinoContato ?? '').trim();
  let proprietario = String(item.proprietario ?? '').trim();
  let proprietarioCpf = String(item.proprietarioCpf ?? '').trim();
  let proprietarioContato = String(item.proprietarioContato ?? '').trim();

  if (idProp) {
    const p = await resolverDadosPessoaPorId(idProp);
    if (p?.nome) proprietario = p.nome;
    if (p?.cpf) proprietarioCpf = p.cpf;
    if (p?.contato) proprietarioContato = p.contato;
  }

  if (idInq) {
    const p = await resolverDadosPessoaPorId(idInq);
    if (p?.nome) inquilino = p.nome;
    if (p?.cpf) inquilinoCpf = p.cpf;
    if (p?.contato) inquilinoContato = p.contato;
  }

  const fiadoresBase = Array.isArray(item.fiadores) ? item.fiadores : [];
  const fiadores = await Promise.all(
    fiadoresBase.map(async (f) => {
      const id = parseIdPessoa(f?.pessoaId);
      if (!id) return f;
      const p = await resolverDadosPessoaPorId(id);
      return {
        pessoaId: String(id),
        nome: String(p?.nome ?? f?.nome ?? '').trim(),
        cpf: String(p?.cpf ?? f?.cpf ?? '').trim(),
        contato: String(p?.contato ?? f?.contato ?? '').trim(),
      };
    }),
  );

  const inquilinosBase = Array.isArray(item.inquilinos) ? item.inquilinos : [];
  const inquilinos = await Promise.all(
    inquilinosBase.map(async (f) => {
      const id = parseIdPessoa(f?.pessoaId);
      if (!id) return f;
      const p = await resolverDadosPessoaPorId(id);
      return {
        pessoaId: String(id),
        nome: String(p?.nome ?? f?.nome ?? '').trim(),
        cpf: String(p?.cpf ?? f?.cpf ?? '').trim(),
        contato: String(p?.contato ?? f?.contato ?? '').trim(),
      };
    }),
  );

  return {
    ...item,
    inquilino,
    inquilinoCpf,
    inquilinoContato,
    proprietario,
    proprietarioCpf,
    proprietarioContato,
    fiadores,
    inquilinos,
  };
}

export async function enriquecerNomesPartesImoveisLote(itens) {
  const lista = Array.isArray(itens) ? itens : [];
  const ids = new Set();
  for (const item of lista) {
    const idInq = parseIdPessoa(item.inquilinoNumeroPessoa);
    const idProp = parseIdPessoa(item.proprietarioNumeroPessoa);
    if (idInq) ids.add(idInq);
    if (idProp) ids.add(idProp);
    for (const f of Array.isArray(item.fiadores) ? item.fiadores : []) {
      const idF = parseIdPessoa(f?.pessoaId);
      if (idF) ids.add(idF);
    }
  }
  await Promise.all([...ids].map((id) => resolverDadosPessoaPorId(id)));
  return Promise.all(lista.map((item) => enriquecerNomesPartesImovelUi(item)));
}

function mapApiToUi(imovel, contrato) {
  const extrasRaw = parseJsonSafe(imovel?.camposExtrasJson, {});
  const extras = normalizarExtrasImovelParaUi(extrasRaw);
  const dadosBanc = parseJsonSafe(contrato?.dadosBancariosRepasseJson, {});
  const idApi = Number(imovel?.id);
  const np = imovel?.numeroPlanilha != null ? Number(imovel.numeroPlanilha) : null;
  const { codigo, proc } = derivarCodProcUiImovel(imovel, extras);
  /** No formulário Imóveis (API): o inteiro exibido é o da col. A da planilha; sem planilha, cai no id interno. */
  const imovelIdUi = np != null && Number.isFinite(np) && np >= 1 ? np : idApi;
  return {
    imovelId: imovelIdUi,
    imovelOcupado: (() => {
      const sit = String(imovel?.situacao || '').toUpperCase();
      if (sit === 'OCUPADO') return true;
      if (sit === 'DESOCUPADO') {
        const stContrato = String(contrato?.status ?? '').toUpperCase();
        return stContrato === 'VIGENTE';
      }
      return true;
    })(),
    codigo,
    proc,
    _vinculoCodigoOriginal: codigo,
    _vinculoProcOriginal: proc,
    observacoesInquilino: resolverObservacoesImovelParaUi(imovel, contrato, extras),
    endereco: String(imovel?.enderecoCompleto ?? ''),
    municipioId: imovel?.municipioId ?? imovel?.municipio?.id ?? null,
    municipio: imovel?.municipio ?? null,
    condominio: String(imovel?.condominio ?? ''),
    unidade: String(imovel?.unidade ?? ''),
    garagens: String(imovel?.garagens ?? ''),
    garantia: String(contrato?.garantiaTipo ?? ''),
    valorGarantia:
      extras.valorGarantia != null && String(extras.valorGarantia).trim() !== ''
        ? formatValorMoedaCampo(extras.valorGarantia)
        : contrato?.valorGarantia != null
          ? formatValorMoedaCampo(contrato.valorGarantia)
          : '',
    valorLocacao:
      contrato?.valorAluguel != null ? formatValorMoedaCampo(contrato.valorAluguel) : '',
    taxaAdministracaoPercent:
      contrato?.taxaAdministracaoPercent != null
        ? String(contrato.taxaAdministracaoPercent).replace('.', ',')
        : '10',
    diaPagAluguel: contrato?.diaVencimentoAluguel != null ? String(contrato.diaVencimentoAluguel).padStart(2, '0') : '',
    formaPagamentoAluguel: String(contrato?.formaPagamentoAluguel ?? ''),
    dataPag1TxCond: String(extras.dataPag1TxCond ?? ''),
    inscricaoImobiliaria: String(imovel?.inscricaoImobiliaria ?? extras.inscricaoMunicipal ?? ''),
    // IPTU: dedicated module (V38). Legacy JSON keys are only mapped when rollback flag is off.
    numeroPlanilhaColA: np != null && Number.isFinite(np) ? np : null,
    ...(FEATURE_IPTU_NOVO
      ? {}
      : {
          existeDebIptu: String(extras.existeDebIptu ?? ''),
          dataConsIptu: String(extras.dataConsIptu ?? ''),
          infoIptuTexto: String(extras.infoIptuTexto ?? ''),
        }),
    aguaNumero: String(extras.aguaNumero ?? ''),
    dataConsAgua: String(extras.dataConsAgua ?? ''),
    existeDebAgua: String(extras.existeDebAgua ?? ''),
    diaVencAgua: String(extras.diaVencAgua ?? ''),
    energiaNumero: String(extras.energiaNumero ?? ''),
    dataConsEnergia: String(extras.dataConsEnergia ?? ''),
    existeDebEnergia: String(extras.existeDebEnergia ?? ''),
    diaVencEnergia: String(extras.diaVencEnergia ?? ''),
    gasNumero: String(extras.gasNumero ?? ''),
    dataConsGas: String(extras.dataConsGas ?? ''),
    existeDebGas: String(extras.existeDebGas ?? ''),
    diaVencGas: String(extras.diaVencGas ?? ''),
    dataInicioContrato: toBrDateFlex(contrato?.dataInicio),
    dataFimContrato: toBrDateFlex(contrato?.dataFim),
    dataConsDebitoCond: String(extras.dataConsDebitoCond ?? ''),
    existeDebitoCond: String(extras.existeDebitoCond ?? ''),
    diaRepasse: contrato?.diaRepasse != null ? String(contrato.diaRepasse).padStart(2, '0') : '',
    banco: String(dadosBanc.banco ?? ''),
    agencia: String(dadosBanc.agencia ?? ''),
    numeroBanco: String(dadosBanc.numeroBanco ?? ''),
    conta: String(dadosBanc.conta ?? ''),
    cpfBanco: String(dadosBanc.cpfBanco ?? ''),
    titular: String(dadosBanc.titular ?? ''),
    chavePix: String(dadosBanc.chavePix ?? ''),
    proprietarioNumeroPessoa: String(
      contrato?.locadorPessoaId ?? extras.proprietarioPessoaId ?? extras.locadorPessoaId ?? '',
    ),
    proprietario: String(extras.proprietario ?? ''),
    proprietarioCpf: String(extras.proprietarioCpf ?? ''),
    proprietarioContato: String(extras.proprietarioContato ?? ''),
    linkVistoria: String(extras.linkVistoria ?? ''),
    inquilinoNumeroPessoa: String(
      contrato?.inquilinoPessoaId ?? extras.inquilinoPessoaId ?? extras.inquilinoNumeroPessoa ?? '',
    ),
    inquilino: String(extras.inquilino ?? ''),
    inquilinoCpf: String(extras.inquilinoCpf ?? ''),
    inquilinoContato: String(extras.inquilinoContato ?? ''),
    inquilinos: mapInquilinosUi(contrato, extras),
    fiadores: mapFiadoresUi(contrato, extras),
    contratoAssinadoInquilino: String(extras.contratoAssinadoInquilino ?? 'nao'),
    contratoAssinadoProprietario: String(extras.contratoAssinadoProprietario ?? 'nao'),
    contratoAssinadoGarantidor: String(extras.contratoAssinadoGarantidor ?? 'nao'),
    contratoAssinadoTestemunhas: String(extras.contratoAssinadoTestemunhas ?? 'nao'),
    contratoArquivado: String(extras.contratoArquivado ?? 'nao'),
    contratoIntermediacaoArquivado: String(extras.contratoIntermediacaoArquivado ?? 'nao'),
    contratoIntermediacaoAssinadoProprietario: String(extras.contratoIntermediacaoAssinadoProprietario ?? 'nao'),
    _apiImovelId: imovel?.id ?? null,
    _apiContratoId: contrato?.id ?? null,
    _apiClienteId: imovel?.clienteId ?? null,
    _apiProcessoId: imovel?.processoId ?? null,
    _jsonExtrasOriginal: extrasRaw,
    _contratoObservacoesOriginal: contrato?.observacoes ?? null,
    _contratoSnapshotOriginal: contratoSnapshotFromApi(contrato),
  };
}

export async function resolverClienteIdPorCodigo(codigoCliente) {
  const cod = padCliente8(codigoCliente);
  const list = await request('/api/clientes');
  const c = (list || []).find((x) => String(x.codigoCliente) === cod);
  if (!c) return null;
  if (c.clienteId != null && Number.isFinite(Number(c.clienteId))) return Number(c.clienteId);
  if (c.id != null && Number.isFinite(Number(c.id))) return Number(c.id);
  return null;
}

/** Antes de POST/PUT: mantém o imóvel em edição; só resolve por (cliente, planilha) em cadastro novo. */
async function resolverIdImovelParaPersistencia(clienteId, numeroPlanilha, apiImovelIdAtual) {
  const atual = Number(apiImovelIdAtual);
  if (Number.isFinite(atual) && atual > 0) {
    return atual;
  }
  const cli = Number(clienteId);
  const np = Number(numeroPlanilha);
  if (!Number.isFinite(cli) || cli < 1 || !Number.isFinite(np) || np < 1) {
    return null;
  }
  try {
    const im = await request(`/api/imoveis/por-numero-planilha/${Math.floor(np)}`, {
      query: { clienteId: cli },
    });
    if (im?.id != null) return Number(im.id);
  } catch {
    // par inexistente — POST
  }
  return null;
}

export async function resolverProcessoIdPorChave(codigoCliente, procInterno) {
  const p = await buscarProcessoPorChaveNatural(codigoCliente, procInterno);
  return p?.id ?? null;
}

function montarPayloadImovelFromUi(ui, clienteId, processoId, espelhoCodProc = null) {
  const extrasOrig =
    ui._jsonExtrasOriginal && typeof ui._jsonExtrasOriginal === 'object' ? ui._jsonExtrasOriginal : {};
  const idProp = parseIdPessoa(ui.proprietarioNumeroPessoa);
  const inquilinosUi = Array.isArray(ui.inquilinos)
    ? ui.inquilinos.map(normalizarEntradaInquilinoUi).filter(Boolean)
    : [];
  const idInq =
    parseIdPessoa(ui.inquilinoNumeroPessoa) ?? parseIdPessoa(inquilinosUi[0]?.pessoaId);
  const codEspelho = espelhoCodProc?.codigo ?? String(ui.codigo ?? '');
  const procEspelho = espelhoCodProc?.proc ?? String(ui.proc ?? '');

  const extras = {
    ...extrasOrig,
    codigo: codEspelho,
    proc: procEspelho,
    dataPag1TxCond: String(ui.dataPag1TxCond ?? ''),
    ...(!FEATURE_IPTU_NOVO
      ? {
          existeDebIptu: String(ui.existeDebIptu ?? ''),
          dataConsIptu: String(ui.dataConsIptu ?? ''),
          infoIptuTexto: String(ui.infoIptuTexto ?? ''),
        }
      : {}),
    aguaNumero: String(ui.aguaNumero ?? ''),
    dataConsAgua: String(ui.dataConsAgua ?? ''),
    existeDebAgua: String(ui.existeDebAgua ?? ''),
    diaVencAgua: String(ui.diaVencAgua ?? ''),
    energiaNumero: String(ui.energiaNumero ?? ''),
    dataConsEnergia: String(ui.dataConsEnergia ?? ''),
    existeDebEnergia: String(ui.existeDebEnergia ?? ''),
    diaVencEnergia: String(ui.diaVencEnergia ?? ''),
    gasNumero: String(ui.gasNumero ?? ''),
    dataConsGas: String(ui.dataConsGas ?? ''),
    existeDebGas: String(ui.existeDebGas ?? ''),
    diaVencGas: String(ui.diaVencGas ?? ''),
    dataConsDebitoCond: String(ui.dataConsDebitoCond ?? ''),
    existeDebitoCond: String(ui.existeDebitoCond ?? ''),
    linkVistoria: String(ui.linkVistoria ?? ''),
    contratoAssinadoInquilino: String(ui.contratoAssinadoInquilino ?? 'nao'),
    contratoAssinadoProprietario: String(ui.contratoAssinadoProprietario ?? 'nao'),
    contratoAssinadoGarantidor: String(ui.contratoAssinadoGarantidor ?? 'nao'),
    contratoAssinadoTestemunhas: String(ui.contratoAssinadoTestemunhas ?? 'nao'),
    contratoArquivado: String(ui.contratoArquivado ?? 'nao'),
    contratoIntermediacaoArquivado: String(ui.contratoIntermediacaoArquivado ?? 'nao'),
    contratoIntermediacaoAssinadoProprietario: String(ui.contratoIntermediacaoAssinadoProprietario ?? 'nao'),
    valorGarantia: String(ui.valorGarantia ?? ''),
  };

  const obsExtraLegado = preservarChaveExtrasLegado(extrasOrig, ['observacoesInquilino', 'obsInquilino']);
  if (obsExtraLegado) extras.observacoesInquilino = obsExtraLegado;

  if (idProp) {
    extras.proprietarioPessoaId = String(idProp);
    extras.proprietario = String(ui.proprietario ?? '').trim();
    extras.proprietarioCpf = String(ui.proprietarioCpf ?? '').trim();
    extras.proprietarioContato = String(ui.proprietarioContato ?? '').trim();
  } else {
    delete extras.proprietarioPessoaId;
    delete extras.locadorPessoaId;
    extras.proprietario = String(ui.proprietario ?? '');
    extras.proprietarioCpf = String(ui.proprietarioCpf ?? '');
    extras.proprietarioContato = String(ui.proprietarioContato ?? '');
  }

  const inquilinosExtras = Array.isArray(ui.inquilinos)
    ? ui.inquilinos.map(normalizarEntradaInquilinoUi).filter(Boolean)
    : [];
  if (inquilinosExtras.length) {
    extras.inquilinos = inquilinosExtras;
  } else {
    delete extras.inquilinos;
  }

  if (idInq) {
    extras.inquilinoPessoaId = String(idInq);
    extras.inquilino = String(ui.inquilino ?? '').trim();
    extras.inquilinoCpf = String(ui.inquilinoCpf ?? '').trim();
    extras.inquilinoContato = String(ui.inquilinoContato ?? '').trim();
  } else {
    delete extras.inquilinoPessoaId;
    extras.inquilino = String(ui.inquilino ?? '');
    extras.inquilinoCpf = String(ui.inquilinoCpf ?? '');
    extras.inquilinoContato = String(ui.inquilinoContato ?? '');
  }
  const nPlan = Number(ui.imovelId);
  const numeroPlanilhaBody =
    Number.isFinite(nPlan) && nPlan >= 1 ? Math.floor(nPlan) : null;

  const extrasImovel = removerExtrasVinculoLocatarioDoObjeto(extras);

  return {
    clienteId,
    processoId: processoId || null,
    numeroPlanilha: numeroPlanilhaBody,
    titulo: String(ui.unidade || ui.condominio || '').trim() || null,
    enderecoCompleto: String(ui.endereco || '').trim() || null,
    municipioId:
      ui.municipioId != null && Number.isFinite(Number(ui.municipioId)) ? Number(ui.municipioId) : null,
    condominio: String(ui.condominio || '').trim() || null,
    unidade: String(ui.unidade || '').trim() || null,
    tipoImovel: null,
    situacao: ui.imovelOcupado ? 'OCUPADO' : 'DESOCUPADO',
    garagens: String(ui.garagens || '').trim() || null,
    inscricaoImobiliaria: String(ui.inscricaoImobiliaria || '').trim() || null,
    observacoes: null,
    camposExtrasJson: JSON.stringify(extrasImovel),
    ativo: true,
  };
}

function contratoSnapshotFromApi(contrato) {
  if (!contrato) return null;
  return {
    dataInicio: contrato.dataInicio ?? null,
    dataFim: contrato.dataFim ?? null,
    valorAluguel: contrato.valorAluguel ?? null,
    diaVencimentoAluguel: contrato.diaVencimentoAluguel ?? null,
    formaPagamentoAluguel: contrato.formaPagamentoAluguel ?? null,
    diaRepasse: contrato.diaRepasse ?? null,
    taxaAdministracaoPercent: contrato.taxaAdministracaoPercent ?? null,
    garantiaTipo: contrato.garantiaTipo ?? null,
    valorGarantia: contrato.valorGarantia ?? null,
    dadosBancariosRepasseJson: contrato.dadosBancariosRepasseJson ?? null,
    fiadoresPessoaIds: Array.isArray(contrato?.fiadoresPessoaIds) ? contrato.fiadoresPessoaIds : [],
    inquilinosPessoaIds: Array.isArray(contrato?.inquilinosPessoaIds) ? contrato.inquilinosPessoaIds : [],
    status: contrato.status ?? 'VIGENTE',
  };
}

async function resolverContratoParaSaveImovel(imovelIdApi, uiPayload, processoIdEfetivo = null) {
  const alterouVinculo = usuarioAlterouVinculoProcessoNoFormulario(uiPayload);
  let contratoId =
    !alterouVinculo && uiPayload?._apiContratoId != null && Number(uiPayload._apiContratoId) > 0
      ? Number(uiPayload._apiContratoId)
      : null;
  let snapshot =
    uiPayload?._contratoSnapshotOriginal && typeof uiPayload._contratoSnapshotOriginal === 'object'
      ? uiPayload._contratoSnapshotOriginal
      : null;

  try {
    const query = { imovelId: imovelIdApi };
    if (processoIdEfetivo != null && Number(processoIdEfetivo) > 0) {
      query.processoId = Number(processoIdEfetivo);
    }
    const contratos = await request('/api/locacoes/contratos', { query });
    const lista = Array.isArray(contratos) ? contratos : [];
    const alinhado = alinharContratoIdAoImovel(contratoId, lista);
    if (alinhado != null) {
      contratoId = alinhado;
      const contratoBase = lista.find((c) => Number(c.id) === Number(contratoId));
      if (contratoBase) {
        snapshot = contratoSnapshotFromApi(contratoBase);
      }
    } else {
      contratoId = null;
    }
  } catch {
    /* mantém refs carregadas na UI */
  }

  return { contratoId, snapshot };
}

function isoDataContratoSnapshot(val) {
  const s = String(val ?? '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return toIsoDate(s);
}

/** Data do contrato a persistir: form tem prioridade; vazio no form grava null (não mantém snapshot). */
function isoDataContratoFromForm(campoBr, origIso) {
  const br = String(campoBr ?? '').trim();
  if (br) {
    const iso = toIsoDate(br);
    return iso ?? isoDataContratoSnapshot(origIso);
  }
  return null;
}

function montarPayloadContratoFromUi(ui, imovelId) {
  const obsContratoLegado = String(ui._contratoObservacoesOriginal ?? '').trim();
  const orig =
    ui._contratoSnapshotOriginal && typeof ui._contratoSnapshotOriginal === 'object'
      ? ui._contratoSnapshotOriginal
      : null;
  const dataInicio = isoDataContratoFromForm(ui.dataInicioContrato, orig?.dataInicio);
  const dataFim = isoDataContratoFromForm(ui.dataFimContrato, orig?.dataFim);
  const valorAluguel =
    toNumberOrNull(ui.valorLocacao) ??
    (orig?.valorAluguel != null ? Number(orig.valorAluguel) : null);
  const taxaUi = toNumberOrNull(String(ui.taxaAdministracaoPercent ?? '').replace(',', '.'));
  const taxaOrig =
    orig?.taxaAdministracaoPercent != null ? Number(orig.taxaAdministracaoPercent) : null;
  const diaVencUi = Number(String(ui.diaPagAluguel ?? '').replace(/\D/g, ''));
  const diaRepasseUi = Number(String(ui.diaRepasse ?? '').replace(/\D/g, ''));
  const dadosBancUi = {
    banco: String(ui.banco ?? ''),
    agencia: String(ui.agencia ?? ''),
    numeroBanco: String(ui.numeroBanco ?? ''),
    conta: String(ui.conta ?? ''),
    cpfBanco: String(ui.cpfBanco ?? ''),
    titular: String(ui.titular ?? ''),
    chavePix: String(ui.chavePix ?? ''),
  };
  const dadosBancTemValor = Object.values(dadosBancUi).some((v) => String(v ?? '').trim());
  const dadosBancariosRepasseJson = dadosBancTemValor
    ? JSON.stringify(dadosBancUi)
    : orig?.dadosBancariosRepasseJson ?? JSON.stringify(dadosBancUi);

  const inquilinosIds = extrairInquilinosPessoaIds(ui);
  const formaPagUi = String(ui.formaPagamentoAluguel ?? '').trim();

  return {
    imovelId,
    processoId:
      ui._apiProcessoId != null && Number(ui._apiProcessoId) > 0 ? Number(ui._apiProcessoId) : null,
    locadorPessoaId: parseIdPessoa(ui.proprietarioNumeroPessoa),
    inquilinoPessoaId: inquilinosIds[0] ?? parseIdPessoa(ui.inquilinoNumeroPessoa),
    ...(inquilinosIds.length > 0 ? { inquilinosPessoaIds: inquilinosIds } : {}),
    dataInicio,
    dataFim,
    valorAluguel,
    taxaAdministracaoPercent: taxaUi ?? taxaOrig ?? 10,
    valorRepassePactuado: null,
    diaVencimentoAluguel:
      Number.isFinite(diaVencUi) && diaVencUi >= 1
        ? diaVencUi
        : orig?.diaVencimentoAluguel != null
          ? Number(orig.diaVencimentoAluguel)
          : null,
    formaPagamentoAluguel: formaPagUi || orig?.formaPagamentoAluguel || null,
    diaRepasse:
      Number.isFinite(diaRepasseUi) && diaRepasseUi >= 1
        ? diaRepasseUi
        : orig?.diaRepasse != null
          ? Number(orig.diaRepasse)
          : null,
    garantiaTipo: String(ui.garantia || '').trim() || orig?.garantiaTipo || null,
    valorGarantia: toNumberOrNull(ui.valorGarantia) ?? (orig?.valorGarantia != null ? Number(orig.valorGarantia) : null),
    fiadoresPessoaIds: extrairFiadoresPessoaIds(ui),
    dadosBancariosRepasseJson,
    status: String(orig?.status ?? 'VIGENTE').trim() || 'VIGENTE',
    observacoes: obsContratoLegado || null,
  };
}

function contratoProntoParaPersistir(contratoBody, contratoId, uiPayload) {
  if (contratoId) return true;
  const temContratoMinimo = Boolean(contratoBody.dataInicio && contratoBody.valorAluguel != null);
  return temContratoMinimo;
}

/** Lista imóveis da API (cada item tem `id` interno e opcionalmente `numeroPlanilha`, col. A). */
export async function listarImoveisApi() {
  if (!featureFlags.useApiImoveis) return [];
  try {
    const list = await request('/api/imoveis');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function chaveVinculoCodProc(codigoCliente, numeroInterno) {
  return `${padCliente8(codigoCliente)}|${Math.trunc(Number(numeroInterno))}`;
}

function vinculoMarcadoComoPrincipal(item) {
  return item?.principal === true || item?.isPrincipal === true;
}

/** Marca exatamente um par Cod.+Proc. como principal na lista (UI imediata). */
export function marcarVinculoPrincipalNaLista(vinculos, codigoCliente, numeroInterno) {
  const chaveAlvo = chaveVinculoCodProc(codigoCliente, numeroInterno);
  return (Array.isArray(vinculos) ? vinculos : []).map((v) => ({
    ...v,
    principal: chaveVinculoCodProc(v.codigoCliente, v.numeroInterno) === chaveAlvo,
  }));
}

function mesclarVinculosProcessoImovel(apiPayload, numeroPlanilha) {
  const np = Number(numeroPlanilha);
  const fromApi = Array.isArray(apiPayload?.vinculos) ? apiPayload.vinculos.map((v) => ({ ...v })) : [];
  const merged = [...fromApi];
  const seen = new Set(merged.map((v) => chaveVinculoCodProc(v.codigoCliente, v.numeroInterno)));

  for (const lp of listarParesCodProcPorNumeroImovelProcessos(np)) {
    const chave = chaveVinculoCodProc(lp.codigoCliente, lp.numeroInterno);
    if (seen.has(chave)) continue;
    seen.add(chave);
    merged.push({
      codigoCliente: padCliente8(lp.codigoCliente),
      numeroInterno: lp.numeroInterno,
      processoId: null,
      imovelId: null,
      cadastroAtual: false,
      principal: false,
    });
  }

  /** Principal = escolha persistida na API; senão último vínculo cadastrado. */
  merged.forEach((v) => {
    v.principal = false;
  });
  if (fromApi.length > 0) {
    const apiPrincipal =
      fromApi.find(vinculoMarcadoComoPrincipal) || fromApi[fromApi.length - 1];
    const chavePrincipal = chaveVinculoCodProc(apiPrincipal.codigoCliente, apiPrincipal.numeroInterno);
    const item = merged.find((v) => chaveVinculoCodProc(v.codigoCliente, v.numeroInterno) === chavePrincipal);
    if (item) item.principal = true;
  } else if (merged.length > 0) {
    merged[merged.length - 1].principal = true;
  }

  return {
    numeroPlanilha: apiPayload?.numeroPlanilha ?? (np >= 1 ? np : null),
    vinculos: merged,
  };
}

/**
 * Todos os pares (codigoCliente, numeroInterno) com imóvel ligado ao nº da planilha.
 * @param {{ numeroPlanilha?: number, imovelIdApi?: number }} opts
 */
export async function listarVinculosProcessoImovel(opts = {}) {
  const np = Number(opts.numeroPlanilha);
  const idApi = Number(opts.imovelIdApi);

  if (!featureFlags.useApiImoveis) {
    return mesclarVinculosProcessoImovel({ numeroPlanilha: np >= 1 ? np : null, vinculos: [] }, np);
  }

  try {
    let apiPayload;
    if (Number.isFinite(idApi) && idApi > 0) {
      apiPayload = await request(`/api/imoveis/${idApi}/vinculos-processo`);
    } else if (Number.isFinite(np) && np >= 1) {
      apiPayload = await request(`/api/imoveis/por-numero-planilha/${np}/vinculos-processo`);
    } else {
      return mesclarVinculosProcessoImovel({ numeroPlanilha: null, vinculos: [] }, np);
    }
    return mesclarVinculosProcessoImovel(apiPayload, apiPayload?.numeroPlanilha ?? np);
  } catch {
    return mesclarVinculosProcessoImovel({ numeroPlanilha: np >= 1 ? np : null, vinculos: [] }, np);
  }
}

/** Escolhe o vínculo atual: principal (definido pelo usuário) > cadastro atual > último da lista. */
export function escolherVinculoPrincipalProcessoLista(vinculos) {
  const lista = Array.isArray(vinculos) ? vinculos : [];
  return (
    lista.find((x) => x.principal) ||
    lista.find((x) => x.cadastroAtual) ||
    lista[lista.length - 1] ||
    null
  );
}

const cacheVinculoPrincipalProcesso = new Map();

export function invalidarCacheVinculoPrincipalProcessoImovel() {
  cacheVinculoPrincipalProcesso.clear();
}

/** Par Cod.+Proc. vigente do imóvel (conta corrente / relatório), alinhado ao modal «Processos do imóvel». */
export async function resolverVinculoPrincipalProcessoImovel(imovel) {
  if (!featureFlags.useApiImoveis || !imovel) return null;
  const np = Number(imovel.imovelId ?? imovel.numeroPlanilhaColA ?? imovel.numeroPlanilha);
  const idApi = Number(imovel._apiImovelId);
  const cacheKey =
    Number.isFinite(np) && np >= 1 ? `np:${np}` : Number.isFinite(idApi) && idApi > 0 ? `id:${idApi}` : null;
  if (cacheKey && cacheVinculoPrincipalProcesso.has(cacheKey)) {
    return cacheVinculoPrincipalProcesso.get(cacheKey);
  }

  let resultado = null;
  try {
    const r = await listarVinculosProcessoImovel({
      numeroPlanilha: Number.isFinite(np) && np >= 1 ? np : undefined,
      imovelIdApi: Number.isFinite(idApi) && idApi > 0 ? idApi : undefined,
    });
    const prim = escolherVinculoPrincipalProcessoLista(r.vinculos);
    if (prim?.codigoCliente && prim.numeroInterno != null && Number(prim.numeroInterno) >= 1) {
      resultado = {
        codigo: padCliente8(prim.codigoCliente),
        proc: String(Math.trunc(Number(prim.numeroInterno))),
        processoId:
          prim.processoId != null && Number.isFinite(Number(prim.processoId)) && Number(prim.processoId) > 0
            ? Number(prim.processoId)
            : null,
        fonteChave: 'principal',
      };
    }
  } catch {
    resultado = null;
  }

  if (cacheKey) cacheVinculoPrincipalProcesso.set(cacheKey, resultado);
  return resultado;
}

/** Define o par Cod.+Proc. principal (vínculo atual) do imóvel — reflete no relatório e conta corrente. */
export async function definirVinculoPrincipalProcessoImovelApi(opts = {}) {
  if (!featureFlags.useApiImoveis) {
    throw new Error('Ative a API de imóveis para definir o vínculo principal.');
  }
  const np = Number(opts.numeroPlanilha);
  const idApi = Number(opts.imovelIdApi);
  const codigoCliente = padCliente8(opts.codigoCliente);
  const numeroInterno = Number(opts.numeroInterno);
  if (!codigoCliente || !Number.isFinite(numeroInterno) || numeroInterno < 1) {
    throw new Error('Informe código de cliente e proc. válidos.');
  }
  const body = { codigoCliente, numeroInterno: Math.trunc(numeroInterno) };
  let payload;
  if (Number.isFinite(idApi) && idApi > 0) {
    payload = await request(`/api/imoveis/${idApi}/vinculo-principal`, { method: 'PUT', body });
  } else if (Number.isFinite(np) && np >= 1) {
    payload = await request(`/api/imoveis/por-numero-planilha/${np}/vinculo-principal`, { method: 'PUT', body });
  } else {
    throw new Error('Informe o imóvel (nº planilha ou id API).');
  }
  invalidarCacheVinculoPrincipalProcessoImovel();
  const merged = mesclarVinculosProcessoImovel(payload, payload?.numeroPlanilha ?? np);
  return {
    ...merged,
    vinculos: marcarVinculoPrincipalNaLista(merged.vinculos, codigoCliente, numeroInterno),
  };
}

function corpoPutImovelFromApi(imo, patch) {
  return {
    clienteId: patch.clienteId !== undefined ? patch.clienteId : (imo.clienteId ?? null),
    processoId: patch.processoId !== undefined ? patch.processoId : (imo.processoId ?? null),
    numeroPlanilha: patch.numeroPlanilha !== undefined ? patch.numeroPlanilha : (imo.numeroPlanilha ?? null),
    responsavelPessoaId: imo.responsavelPessoaId ?? null,
    titulo: imo.titulo ?? null,
    enderecoCompleto: imo.enderecoCompleto ?? null,
    condominio: imo.condominio ?? null,
    unidade: patch.unidade !== undefined ? patch.unidade : (imo.unidade ?? null),
    tipoImovel: imo.tipoImovel ?? null,
    situacao: imo.situacao ?? 'DESOCUPADO',
    garagens: imo.garagens ?? null,
    inscricaoImobiliaria: imo.inscricaoImobiliaria ?? null,
    observacoes: patch.observacoes !== undefined ? patch.observacoes : (imo.observacoes ?? null),
    camposExtrasJson: imo.camposExtrasJson ?? null,
    ativo: imo.ativo ?? true,
  };
}

/**
 * Vincula o par código cliente + proc. ao nº sequencial do imóvel (col. A da planilha).
 * Vários processos podem partilhar o mesmo nº (linhas distintas em `imovel`, ver Proc/0.89.1).
 * @param {string} codigoCliente
 * @param {number} numeroInterno
 * @param {number} numeroPlanilha
 */
export async function vincularProcessoAoNumeroImovel(codigoCliente, numeroInterno, numeroPlanilha) {
  if (!featureFlags.useApiImoveis) {
    return { ok: false, acao: 'api_desligada', mensagem: 'API de imóveis desligada.' };
  }
  const np = Math.trunc(Number(numeroPlanilha));
  const proc = Math.trunc(Number(numeroInterno));
  if (!Number.isFinite(np) || np < 1) {
    return { ok: false, acao: 'numero_invalido', mensagem: 'Informe um nº de imóvel válido.' };
  }
  if (!Number.isFinite(proc) || proc < 1) {
    return { ok: false, acao: 'processo_invalido', mensagem: 'Selecione um processo válido.' };
  }

  const procApi = await buscarProcessoPorChaveNatural(codigoCliente, proc);
  if (!procApi?.id) {
    return { ok: false, acao: 'sem_processo', mensagem: 'Processo não encontrado na API.' };
  }

  const clienteApi = await buscarClientePorCodigo(codigoCliente);
  const clientePk =
    clienteApi?.clienteId != null
      ? Number(clienteApi.clienteId)
      : clienteApi?.id != null
        ? Number(clienteApi.id)
        : procApi.clienteId != null
          ? Number(procApi.clienteId)
          : null;
  if (!Number.isFinite(clientePk) || clientePk < 1) {
    return { ok: false, acao: 'sem_cliente', mensagem: 'Cliente não encontrado na API.' };
  }

  const todos = await listarImoveisApi();
  let imovel = todos.find(
    (i) => Number(i.clienteId) === clientePk && Number(i.numeroPlanilha) === np
  );

  if (!imovel) {
    try {
      const global = await request(`/api/imoveis/por-numero-planilha/${np}`);
      if (global && Number(global.clienteId) === clientePk) {
        imovel = global;
      }
    } catch {
      /* sem imóvel com esse nº para este cliente */
    }
  }

  if (imovel?.processoId != null && Number(imovel.processoId) === Number(procApi.id)) {
    return {
      ok: true,
      acao: 'ja_vinculado',
      mensagem: 'Este processo já está vinculado a este imóvel.',
      numeroPlanilha: np,
      imovelIdApi: imovel.id,
      unidade: imovel.unidade ?? null,
    };
  }

  if (imovel?.id) {
    const putBody = corpoPutImovelFromApi(imovel, {
      clienteId: clientePk,
      processoId: procApi.id,
    });
    const atualizado = await request(`/api/imoveis/${imovel.id}`, { method: 'PUT', body: putBody });
    return {
      ok: true,
      acao: 'atualizado',
      mensagem: 'Processo vinculado ao imóvel.',
      numeroPlanilha: np,
      imovelIdApi: atualizado.id,
      unidade: atualizado.unidade ?? null,
    };
  }

  const baseBody = {
    clienteId: clientePk,
    processoId: procApi.id,
    situacao: 'DESOCUPADO',
    ativo: true,
    observacoes: `Vínculo Processos (planilha legado ${np}).`,
  };

  try {
    const criado = await request('/api/imoveis', {
      method: 'POST',
      body: { ...baseBody, numeroPlanilha: np },
    });
    return {
      ok: true,
      acao: 'criado',
      mensagem: 'Imóvel vinculado — use «Abrir Proc.» no cadastro Imóveis para ver todos os processos.',
      numeroPlanilha: np,
      imovelIdApi: criado.id,
      unidade: criado.unidade ?? null,
    };
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (!/já vinculado|ja vinculado|duplicate|unique|planilha/i.test(msg)) {
      return { ok: false, acao: 'erro_criar', mensagem: msg.slice(0, 300) };
    }
  }

  const criadoLegado = await request('/api/imoveis', { method: 'POST', body: baseBody });
  return {
    ok: true,
    acao: 'criado_legado',
    mensagem:
      'Processo vinculado (nº já usado por outro registo — listado em «Abrir Proc.» pelo nº do imóvel).',
    numeroPlanilha: np,
    imovelIdApi: criadoLegado.id,
    unidade: criadoLegado.unidade ?? null,
  };
}

/** Número da planilha (col. A) para o par código de cliente + proc; null se não houver imóvel ou API desligada. */
export async function buscarNumeroImovelPorVinculo(codigoCliente, numeroInterno) {
  if (!featureFlags.useApiImoveis) return null;
  const proc = Number(numeroInterno);
  if (!Number.isFinite(proc) || proc < 1) return null;
  try {
    const r = await request('/api/imoveis/numero-por-vinculo', {
      query: { codigoCliente: padCliente8(codigoCliente), numeroInterno: proc },
    });
    return r?.numeroPlanilha != null ? String(r.numeroPlanilha) : null;
  } catch {
    return null;
  }
}

function scoreImovelApiListItem(item) {
  let s = 0;
  if (String(item?.unidade ?? '').trim()) s += 4;
  if (String(item?.condominio ?? '').trim()) s += 2;
  if (String(item?.enderecoCompleto ?? '').trim()) s += 2;
  if (item?.processoId != null) s += 1;
  if (item?.clienteId != null) s += 1;
  if (String(item?.situacao ?? '').toUpperCase() === 'OCUPADO') s += 1;
  return s;
}

function escolherMelhorImovelApiPorNumeroPlanilha(candidatos) {
  return (candidatos || []).reduce((best, cur) => {
    if (!best) return cur;
    const sb = scoreImovelApiListItem(best);
    const sc = scoreImovelApiListItem(cur);
    if (sc > sb) return cur;
    if (sc < sb) return best;
    return Number(cur.id) > Number(best.id) ? cur : best;
  }, null);
}

async function aplicarInquilinosMescladosComProcesso(item) {
  try {
    const { carregarInquilinosMescladosComProcesso, derivarCamposLegadoInquilino } = await import(
      './imovelInquilinoProcessoSync.js'
    );
    item.inquilinos = await carregarInquilinosMescladosComProcesso(item);
    Object.assign(item, derivarCamposLegadoInquilino(item.inquilinos));
  } catch {
    /* mantém inquilinos do contrato */
  }
  return item;
}

async function aplicarVinculoLocatarioNaUi(item) {
  if (!item) return item;
  const np = Number(item.numeroPlanilhaColA ?? item.imovelId);
  const cod = padCliente8(item.codigo);
  const proc = normalizarProcUi(item.proc);
  if (!Number.isFinite(np) || np < 1 || !cod || !proc) return item;
  const vinculo = await carregarVinculoLocatarioImovel({
    numeroPlanilha: np,
    codigoCliente: cod,
    numeroInterno: Number(proc),
  });
  if (!vinculo?.camposExtrasJson) return item;
  const extrasRaw = parseJsonSafe(vinculo.camposExtrasJson, {});
  let merged = mesclarExtrasVinculoLocatarioNoItem(item, extrasRaw, normalizarExtrasImovelParaUi);
  if (vinculo.processoId != null && Number(vinculo.processoId) > 0) {
    merged = { ...merged, _apiProcessoId: Number(vinculo.processoId) };
  }
  return merged;
}

async function montarItemCadastroFromApiImovel(apiImovel) {
  let itemPreview = mapApiToUi(apiImovel, null);
  itemPreview = await enriquecerCodigoProcDoVinculo(itemPreview, apiImovel);
  const processoId = await resolverProcessoIdParaVinculoUi(itemPreview, resolverProcessoIdPorChave);

  const queryContratos = { imovelId: apiImovel.id };
  if (processoId != null && Number(processoId) > 0) {
    queryContratos.processoId = Number(processoId);
  }
  const contratos = await request('/api/locacoes/contratos', { query: queryContratos });
  const contratoAtual = selecionarContratoVigente(Array.isArray(contratos) ? contratos : []);
  let item = mapApiToUi(apiImovel, contratoAtual);
  item.codigo = itemPreview.codigo;
  item.proc = itemPreview.proc;
  item._vinculoCodigoOriginal = itemPreview._vinculoCodigoOriginal ?? itemPreview.codigo;
  item._vinculoProcOriginal = itemPreview._vinculoProcOriginal ?? itemPreview.proc;
  if (processoId != null && Number(processoId) > 0) {
    item._apiProcessoId = Number(processoId);
  }
  item = await aplicarVinculoLocatarioNaUi(item);
  item = await enriquecerNomesPartesImovelUi(item);
  return aplicarInquilinosMescladosComProcesso(item);
}

/**
 * Carrega o cadastro do imóvel com locatário/contrato do par Cod.+Proc. escolhido (modal «Abrir Proc.»).
 * Não usa o vínculo principal — respeita exatamente o par selecionado.
 */
export async function carregarCadastroPorVinculoImovel({
  numeroPlanilha,
  imovelIdApi,
  codigoCliente,
  numeroInterno,
}) {
  if (!featureFlags.useApiImoveis) {
    return null;
  }
  const np = Number(numeroPlanilha);
  const cod = padCliente8(codigoCliente);
  const proc = normalizarProcUi(numeroInterno);
  if (!Number.isFinite(np) || np < 1 || !cod || !proc) {
    return null;
  }

  let apiImovel = null;
  const preferId = Number(imovelIdApi);
  if (Number.isFinite(preferId) && preferId >= 1) {
    try {
      apiImovel = await request(`/api/imoveis/${Math.floor(preferId)}`);
    } catch {
      apiImovel = null;
    }
  }
  if (!apiImovel) {
    try {
      apiImovel = await request(`/api/imoveis/por-numero-planilha/${Math.floor(np)}`);
    } catch {
      const list = await listarImoveisApi();
      const candidatos = (Array.isArray(list) ? list : []).filter((i) => Number(i.numeroPlanilha) === np);
      apiImovel = escolherMelhorImovelApiPorNumeroPlanilha(candidatos);
      if (apiImovel?.id) {
        try {
          apiImovel = await request(`/api/imoveis/${apiImovel.id}`);
        } catch {
          /* usa resumo da listagem */
        }
      }
    }
  }
  if (!apiImovel?.id) {
    return null;
  }

  let processoId = null;
  try {
    processoId = await resolverProcessoIdPorChave(cod, proc);
  } catch {
    processoId = null;
  }

  const queryContratos = { imovelId: apiImovel.id };
  if (processoId != null && Number(processoId) > 0) {
    queryContratos.processoId = Number(processoId);
  }
  const contratos = await request('/api/locacoes/contratos', { query: queryContratos });
  const contratoAtual = selecionarContratoVigente(Array.isArray(contratos) ? contratos : []);

  let item = mapApiToUi(apiImovel, contratoAtual);
  item.codigo = cod;
  item.proc = proc;
  item._vinculoCodigoOriginal = cod;
  item._vinculoProcOriginal = proc;
  if (processoId != null && Number(processoId) > 0) {
    item._apiProcessoId = Number(processoId);
  }

  item = await aplicarVinculoLocatarioNaUi(item);
  item = await enriquecerNomesPartesImovelUi(item);
  return aplicarInquilinosMescladosComProcesso(item);
}

/** Igual a {@link montarItemCadastroFromApiImovel}, mas cai no shape básico da listagem se contrato/vínculos falharem. */
async function montarItemCadastroResiliente(apiImovel) {
  try {
    return await montarItemCadastroFromApiImovel(apiImovel);
  } catch {
    let item = mapApiToUi(apiImovel, null);
    item = await enriquecerCodigoProcDoVinculo(item, apiImovel);
    return enriquecerNomesPartesImovelUi(item);
  }
}

export async function carregarImovelCadastroPorNumeroPlanilha(numeroPlanilha, opts = {}) {
  if (!featureFlags.useApiImoveis) {
    return { fonte: 'legado', item: null, encontrado: false };
  }
  const n = Number(numeroPlanilha);
  if (!Number.isFinite(n) || n < 1) {
    return { fonte: 'api', item: null, encontrado: false };
  }
  const preferId = Number(opts.preferirImovelId ?? opts.imovelIdApi);
  if (Number.isFinite(preferId) && preferId >= 1) {
    try {
      const apiImovel = await request(`/api/imoveis/${Math.floor(preferId)}`);
      if (Number(apiImovel?.numeroPlanilha) === n) {
        const item = await montarItemCadastroResiliente(apiImovel);
        return { fonte: 'api', item, encontrado: true };
      }
    } catch {
      /* tenta rotas abaixo */
    }
  }
  const query = {};
  const clienteIdOpt = Number(opts.clienteId);
  if (Number.isFinite(clienteIdOpt) && clienteIdOpt >= 1) {
    query.clienteId = clienteIdOpt;
  } else {
    const codigo = String(opts.codigoCliente ?? '').trim();
    if (codigo) query.codigoCliente = padCliente8(codigo);
  }
  try {
    const apiImovel = await request(`/api/imoveis/por-numero-planilha/${n}`, {
      query: Object.keys(query).length ? query : undefined,
    });
    const item = await montarItemCadastroResiliente(apiImovel);
    return { fonte: 'api', item, encontrado: true };
  } catch {
    try {
      const list = await listarImoveisApi();
      const candidatos = (Array.isArray(list) ? list : []).filter((i) => Number(i.numeroPlanilha) === n);
      const preferido =
        Number.isFinite(preferId) && preferId >= 1
          ? candidatos.find((i) => Number(i.id) === preferId)
          : null;
      const melhor = preferido ?? escolherMelhorImovelApiPorNumeroPlanilha(candidatos);
      if (!melhor?.id) {
        return { fonte: 'api', item: null, encontrado: false };
      }
      try {
        const apiImovel = await request(`/api/imoveis/${melhor.id}`);
        const item = await montarItemCadastroResiliente(apiImovel);
        return { fonte: 'api', item, encontrado: true };
      } catch {
        const item = await montarItemCadastroResiliente(melhor);
        return { fonte: 'api', item, encontrado: true };
      }
    } catch {
      return { fonte: 'api', item: null, encontrado: false };
    }
  }
}

/**
 * Resolve cadastro para painéis/navegação: prioriza nº da planilha (col. A).
 * Só usa `imovelIdApi` como PK interna — nunca confunde nº da planilha com `GET /api/imoveis/{id}`.
 */
export async function carregarImovelCadastroParaPainel({ imovelId, imovelIdApi, codigoCliente, clienteId } = {}) {
  if (!featureFlags.useApiImoveis) {
    return { fonte: 'legado', item: null, encontrado: false };
  }
  const np = Number(imovelId);
  if (Number.isFinite(np) && np >= 1) {
    const porPlanilha = await carregarImovelCadastroPorNumeroPlanilha(np, {
      codigoCliente,
      clienteId,
      preferirImovelId: imovelIdApi,
    });
    if (porPlanilha.item) return porPlanilha;
  }
  const apiId = Number(imovelIdApi);
  if (Number.isFinite(apiId) && apiId >= 1) {
    return carregarImovelCadastro({ imovelId: apiId });
  }
  return { fonte: 'api', item: null, encontrado: false };
}

/**
 * Cadastro completo por **id interno** da API (`imovel.id`).
 * Não use o nº da planilha (col. A) aqui — risco de carregar outro imóvel (ex.: planilha 6 → id 21, mas id 6 → planilha 31).
 * Para UI com nº da planilha, use {@link carregarImovelCadastroParaPainel}.
 */
export async function carregarImovelCadastro({ imovelId }) {
  if (!featureFlags.useApiImoveis) {
    return { fonte: 'legado', item: null, encontrado: false };
  }
  try {
    const apiImovel = await request(`/api/imoveis/${Number(imovelId)}`);
    return montarItemCadastroFromApiImovel(apiImovel).then((item) => ({
      fonte: 'api',
      item,
      encontrado: true,
    }));
  } catch {
    return { fonte: 'api', item: null, encontrado: false };
  }
}

function scoreItemRelatorioImovel(item) {
  let s = 0;
  if (String(item?.unidade ?? '').trim()) s += 4;
  if (String(item?.condominio ?? '').trim()) s += 2;
  if (String(item?.codigo ?? '').trim()) s += 1;
  if (item?.imovelOcupado) s += 1;
  return s;
}

/** Uma linha por nº da planilha (col. A, sem teto); descarta duplicados de import-real e registos com nº inválido. */
export function filtrarItensRelatorioPlanilhaAdmin(itens) {
  const porNumero = new Map();
  for (const item of itens || []) {
    const np = Number(item?.imovelId ?? item?.numeroPlanilhaColA);
    if (!Number.isFinite(np) || np < 1) continue;
    const prev = porNumero.get(np);
    if (!prev || scoreItemRelatorioImovel(item) > scoreItemRelatorioImovel(prev)) {
      porNumero.set(np, item);
    }
  }
  return [...porNumero.values()].sort((a, b) => Number(a.imovelId) - Number(b.imovelId));
}

/**
 * Itens de formulário/UI (como em `mapApiToUi`) para o Relatório Imóveis.
 * Um GET de cadastro completo por imóvel; em paralelo — cuidado com bases muito grandes.
 */
export async function carregarItensRelatorioImoveisApi() {
  if (!featureFlags.useApiImoveis) {
    return { ok: false, motivo: 'Ative VITE_USE_API_IMOVEIS e use o backend para gerar o relatório.', itens: [] };
  }
  const list = await listarImoveisApi();
  if (!Array.isArray(list) || list.length === 0) {
    return { ok: true, itens: [] };
  }
  try {
    const numerosPlanilha = new Set();
    const extrasSemPlanilha = [];
    for (const im of list) {
      const np = im.numeroPlanilha != null ? Number(im.numeroPlanilha) : null;
      if (Number.isFinite(np) && np >= 1) {
        numerosPlanilha.add(np);
      } else if (im?.id) {
        extrasSemPlanilha.push(im);
      }
    }

    const numerosOrdenados = [...numerosPlanilha].sort((a, b) => a - b);
    const porPlanilha = await mapComLimiteConcorrencia(numerosOrdenados, 4, async (np) => {
      const r = await carregarImovelCadastroPorNumeroPlanilha(np);
      if (r.item) return r.item;
      const candidatos = list.filter((i) => Number(i.numeroPlanilha) === np);
      const melhor = escolherMelhorImovelApiPorNumeroPlanilha(candidatos);
      if (!melhor) return null;
      let base = mapApiToUi(melhor, null);
      base = await enriquecerCodigoProcDoVinculo(base, melhor);
      return enriquecerNomesPartesImovelUi(base);
    });

    const extras = await mapComLimiteConcorrencia(extrasSemPlanilha, 2, async (im) => {
      const r = await carregarImovelCadastro({ imovelId: im.id });
      if (r.item) return r.item;
      let base = mapApiToUi(im, null);
      base = await enriquecerCodigoProcDoVinculo(base, im);
      return enriquecerNomesPartesImovelUi(base);
    });

    const results = [...porPlanilha, ...extras].filter(Boolean);
    const itens = filtrarItensRelatorioPlanilhaAdmin(
      await enriquecerNomesPartesImoveisLote(results),
    );
    return { ok: true, itens };
  } catch (e) {
    return { ok: false, motivo: e?.message || 'Falha ao carregar dados para o relatório.', itens: [] };
  }
}

/** Mapa lancamentoFinanceiroId → { papel, competenciaMes } a partir da API de reconciliação. */
export function vinculosMapFromApiRows(rows) {
  const map = new Map();
  for (const v of rows || []) {
    const id = Number(v?.lancamentoFinanceiroId);
    if (!Number.isFinite(id)) continue;
    map.set(id, {
      papel: v.papel,
      competenciaMes: v.competenciaMes,
    });
  }
  return map;
}

/**
 * Auto-conciliar aluguéis Cora inequívocos da competência (origem=AUTO).
 * Idempotente no backend — não duplica nem altera vínculos manuais.
 */
export async function conciliarAlugueisAutomaticoApi({ competencia } = {}) {
  if (!featureFlags.useApiImoveis) {
    return { competencia: competencia ?? null, autoVinculados: 0, autoVinculadosDetalhes: [], paraRevisao: [], semCredito: [] };
  }
  return request('/api/locacoes/conciliar-alugueis', {
    method: 'POST',
    query: { competencia: competencia || undefined },
  });
}

/**
 * Sugestões de aluguel (read-only): para cada contrato vigente sem crédito na competência,
 * lista créditos do extrato que casam por nome do pagador × valor × dia. A confirmação usa
 * vincularReconciliacaoApi(contratoId, [...]), que adota o lançamento órfão.
 */
export async function listarSugestoesAlugueisPendentesApi({ competencia, signal } = {}) {
  if (!featureFlags.useApiImoveis) {
    return { competencia: competencia ?? null, totalContratosPendentes: 0, totalComSugestao: 0, contratos: [] };
  }
  return request('/api/locacoes/sugestoes-alugueis-pendentes', {
    signal,
    query: { competencia: competencia || undefined },
  });
}

/** Contratos de locação do imóvel (id interno da API), mais recentes primeiro. */
export async function listarContratosLocacaoImovelApi(imovelIdApi, { signal } = {}) {
  if (!featureFlags.useApiImoveis) return [];
  const id = Number(imovelIdApi);
  if (!Number.isFinite(id) || id < 1) return [];
  const contratos = await request('/api/locacoes/contratos', { signal, query: { imovelId: id } });
  return Array.isArray(contratos) ? contratos : [];
}

/**
 * Visão geral do portfólio (uma chamada): cadastro resumido + contrato vigente + status
 * financeiro da competência para todos os imóveis, sem teto de nº de planilha.
 */
export async function carregarVisaoGeralImoveisApi({ competencia, soOcupados = false, signal } = {}) {
  if (!featureFlags.useApiImoveis) {
    return { ok: false, motivo: 'Ative VITE_USE_API_IMOVEIS para carregar a visão geral.', competencia: null, itens: [] };
  }
  try {
    const res = await request('/api/imoveis/visao-geral', {
      signal,
      query: {
        competencia: competencia || undefined,
        soOcupados,
      },
    });
    return {
      ok: true,
      competencia: res?.competencia ?? competencia ?? null,
      itens: Array.isArray(res?.itens) ? res.itens : [],
    };
  } catch (e) {
    return { ok: false, motivo: e?.message || 'Falha ao carregar a visão geral de imóveis.', competencia: null, itens: [] };
  }
}

/**
 * Relatório financeiro (imóveis × mês): totais calculados no backend (sem extrato no browser).
 */
export async function carregarRelatorioFinanceiroImoveisMes(chaveMesYYYYMM, opts = {}) {
  const { soOcupados = true, signal } = opts;
  if (!featureFlags.useApiImoveis) {
    return { ok: false, motivo: 'Ative VITE_USE_API_IMOVEIS e use o backend para gerar o relatório.', linhas: [], ultimaCarga: null };
  }
  try {
    const res = await request('/api/imoveis/relatorio-financeiro', {
      signal,
      query: {
        competencia: chaveMesYYYYMM,
        soOcupados,
      },
    });
    const linhas = mapRelatorioFinanceiroBackendParaLinhas(res?.linhas, chaveMesYYYYMM);
    return { ok: true, linhas, ultimaCarga: new Date() };
  } catch (e) {
    return { ok: false, motivo: e?.message || 'Falha ao gerar o relatório.', linhas: [], ultimaCarga: null };
  }
}

export async function salvarImovelCadastro(uiPayload) {
  if (!featureFlags.useApiImoveis) {
    return { fonte: 'legado', salvo: false, motivo: 'Mock sem persistência real.' };
  }
  const vinculo = await resolverVinculoProcessoParaSaveImovel(uiPayload);
  const codigoTrim = String(vinculo.espelhoCodigo || uiPayload.codigo || '').trim();
  let clienteId = null;
  if (codigoTrim) {
    clienteId = await resolverClienteIdPorCodigo(codigoTrim);
    if (!clienteId) {
      throw new Error('Cliente não encontrado para o código informado.');
    }
  } else if (uiPayload._apiClienteId != null && Number(uiPayload._apiClienteId) > 0) {
    clienteId = Number(uiPayload._apiClienteId);
  }

  const bodyImovel = montarPayloadImovelFromUi(uiPayload, clienteId, vinculo.processoIdPayload, {
    codigo: vinculo.espelhoCodigo,
    proc: vinculo.espelhoProc,
  });
  const idPersistencia = await resolverIdImovelParaPersistencia(
    clienteId,
    bodyImovel.numeroPlanilha,
    uiPayload._apiImovelId,
  );
  const imovelSalvo = idPersistencia
    ? await request(`/api/imoveis/${idPersistencia}`, { method: 'PUT', body: bodyImovel })
    : await request('/api/imoveis', { method: 'POST', body: bodyImovel });

  const processoIdEfetivo =
    vinculo.processoIdPayload ??
    (uiPayload._apiProcessoId != null && Number(uiPayload._apiProcessoId) > 0
      ? Number(uiPayload._apiProcessoId)
      : null);

  if (vinculo.espelhoCodigo && vinculo.espelhoProc && bodyImovel.numeroPlanilha) {
    await salvarVinculoLocatarioImovel({
      numeroPlanilha: bodyImovel.numeroPlanilha,
      codigoCliente: vinculo.espelhoCodigo,
      numeroInterno: Number(vinculo.espelhoProc),
      processoId: processoIdEfetivo,
      camposExtrasJson: extrairExtrasVinculoLocatarioJsonDoUi(
        uiPayload,
        uiPayload._jsonExtrasOriginal,
      ),
    });
  }

  const { contratoId, snapshot } = await resolverContratoParaSaveImovel(
    imovelSalvo.id,
    uiPayload,
    processoIdEfetivo,
  );
  const uiContrato = {
    ...uiPayload,
    _apiContratoId: contratoId ?? uiPayload._apiContratoId,
    _apiProcessoId: processoIdEfetivo ?? uiPayload._apiProcessoId,
    _contratoSnapshotOriginal: snapshot ?? uiPayload._contratoSnapshotOriginal,
  };
  const contratoBody = montarPayloadContratoFromUi(uiContrato, imovelSalvo.id);
  if (processoIdEfetivo != null && Number(processoIdEfetivo) > 0) {
    contratoBody.processoId = Number(processoIdEfetivo);
  }
  let contratoSalvo = null;
  if (contratoProntoParaPersistir(contratoBody, contratoId, uiContrato)) {
    contratoSalvo = contratoId
      ? await request(`/api/locacoes/contratos/${contratoId}`, { method: 'PUT', body: contratoBody })
      : await request('/api/locacoes/contratos', { method: 'POST', body: contratoBody });
  }

  let contratoAtual = contratoSalvo;
  if (!contratoAtual) {
    try {
      const contratos = await request('/api/locacoes/contratos', { query: { imovelId: imovelSalvo.id } });
      contratoAtual = selecionarContratoVigente(Array.isArray(contratos) ? contratos : []);
    } catch {
      contratoAtual = null;
    }
  }

  let item = await enriquecerNomesPartesImovelUi(mapApiToUi(imovelSalvo, contratoAtual));
  item.codigo = vinculo.espelhoCodigo || item.codigo;
  item.proc = vinculo.espelhoProc || item.proc;
  item._vinculoCodigoOriginal = vinculo.espelhoCodigo || item.codigo;
  item._vinculoProcOriginal = vinculo.espelhoProc || item.proc;
  if (processoIdEfetivo != null && Number(processoIdEfetivo) > 0) {
    item._apiProcessoId = Number(processoIdEfetivo);
  }
  item = await aplicarVinculoLocatarioNaUi(item);
  item = mesclarCamposVinculoLocatarioDoUiNoItem(item, uiPayload);
  item = await enriquecerNomesPartesImovelUi(item);

  const enviados = Array.isArray(uiPayload.inquilinos)
    ? uiPayload.inquilinos.map(normalizarEntradaInquilinoUi).filter(Boolean)
    : [];
  if (enviados.length > 0) {
    try {
      const { derivarCamposLegadoInquilino, mesclarInquilinosUi } = await import(
        './imovelInquilinoProcessoSync.js'
      );
      item.inquilinos = mesclarInquilinosUi(enviados, item.inquilinos);
      Object.assign(item, derivarCamposLegadoInquilino(item.inquilinos));
      if (item._contratoSnapshotOriginal && typeof item._contratoSnapshotOriginal === 'object') {
        item._contratoSnapshotOriginal = {
          ...item._contratoSnapshotOriginal,
          inquilinosPessoaIds: extrairInquilinosPessoaIds(item),
        };
      }
      item = await enriquecerNomesPartesImovelUi(item);
    } catch {
      item.inquilinos = enviados;
    }
  }

  try {
    const { sincronizarInquilinosImovelParaProcesso } = await import('./imovelInquilinoProcessoSync.js');
    await sincronizarInquilinosImovelParaProcesso(item, item.inquilinos);
  } catch {
    /* sync best-effort */
  }

  return {
    fonte: 'api',
    salvo: true,
    item: {
      ...item,
      _vinculoCodigoOriginal: vinculo.espelhoCodigo || item.codigo,
      _vinculoProcOriginal: vinculo.espelhoProc || item.proc,
      _apiProcessoId: processoIdEfetivo ?? item._apiProcessoId,
    },
  };
}

/**
 * Chave do processo para conta corrente / painel financeiro do imóvel (somente leitura).
 * Prioridade: vínculo principal (último proc. do imóvel) → N:N ({@code _apiProcessoId}) → extras.
 */
export async function resolverChaveProcessoContaCorrentePainel(imovel) {
  const principal = await resolverVinculoPrincipalProcessoImovel(imovel);
  if (principal?.codigo && principal.proc) {
    return principal;
  }

  const fallbackCodigo = String(imovel?.codigo ?? '').trim();
  const fallbackProc = String(imovel?.proc ?? '').trim();
  const processoIdRaw = imovel?._apiProcessoId;
  const processoId =
    processoIdRaw != null && Number.isFinite(Number(processoIdRaw)) && Number(processoIdRaw) > 0
      ? Number(processoIdRaw)
      : null;

  if (processoId && featureFlags.useApiProcessos) {
    try {
      const procApi = await buscarProcessoPorId(processoId);
      const ni = procApi?.numeroInterno ?? procApi?.numeroInternoProcesso;
      const codRaw = procApi?.codigoCliente ?? fallbackCodigo;
      const codigo = padCliente8(codRaw);
      if (codigo && ni != null && Number(ni) >= 1) {
        return {
          codigo,
          proc: String(Math.trunc(Number(ni))),
          processoId,
          fonteChave: 'nn',
        };
      }
    } catch {
      /* fallback abaixo */
    }
  }

  return {
    codigo: fallbackCodigo,
    proc: fallbackProc,
    processoId,
    fonteChave: 'extras',
  };
}

/**
 * Resolve processoId do PUT e cod+proc espelho nos extras no save do cadastro imóvel.
 * Sem alteração deliberada de cod+proc: mantém N:N e reescreve extras como espelho canônico.
 */
export async function resolverVinculoProcessoParaSaveImovel(uiPayload) {
  const codForm = String(uiPayload.codigo ?? '').trim();
  const procForm = normalizarProcUi(uiPayload.proc);
  const apiProcessoId =
    uiPayload._apiProcessoId != null && Number(uiPayload._apiProcessoId) > 0
      ? Number(uiPayload._apiProcessoId)
      : null;
  let alterouVinculo = usuarioAlterouVinculoProcessoNoForm(uiPayload);

  let chaveNn = null;
  if (!alterouVinculo && apiProcessoId && codForm && procForm) {
    chaveNn = await resolverChaveProcessoContaCorrentePainel(uiPayload);
    if (chaveNn.fonteChave === 'nn') {
      const codNn = padCliente8(chaveNn.codigo);
      const procNn = normalizarProcUi(chaveNn.proc);
      if (codNn !== padCliente8(codForm) || procNn !== procForm) {
        alterouVinculo = true;
      }
    }
  }

  if (alterouVinculo) {
    if (!codForm || !procForm) {
      return {
        alterouVinculo: true,
        processoIdPayload: null,
        espelhoCodigo: codForm ? padCliente8(codForm) : '',
        espelhoProc: procForm,
      };
    }
    const novoId = await resolverProcessoIdPorChave(codForm, procForm);
    if (!novoId) {
      throw new Error('Processo não encontrado para o código e proc. informados.');
    }
    return {
      alterouVinculo: true,
      processoIdPayload: novoId,
      espelhoCodigo: padCliente8(codForm),
      espelhoProc: procForm,
    };
  }

  if (chaveNn?.fonteChave === 'nn') {
    return {
      alterouVinculo: false,
      processoIdPayload: chaveNn.processoId,
      espelhoCodigo: chaveNn.codigo,
      espelhoProc: chaveNn.proc,
    };
  }

  let processoIdPayload = null;
  if (codForm && procForm) {
    processoIdPayload = await resolverProcessoIdPorChave(codForm, procForm);
  }
  return {
    alterouVinculo: false,
    processoIdPayload,
    espelhoCodigo: codForm ? padCliente8(codForm) : '',
    espelhoProc: procForm,
  };
}

export async function carregarPainelAdministracaoImovel({ imovelId, imovelIdApi, codigoFallback, procFallback }) {
  let codigo = String(codigoFallback ?? '').trim();
  let proc = String(procFallback ?? '').trim();
  let imovel = null;
  let processoIdPainel = null;

  if (featureFlags.useApiImoveis) {
    const r = await carregarImovelCadastroParaPainel({ imovelId, imovelIdApi });
    imovel = r.item;
    if (imovel) {
      const chave = await resolverChaveProcessoContaCorrentePainel(imovel);
      codigo = String(chave.codigo || codigo).trim();
      proc = String(chave.proc || proc).trim();
      processoIdPainel = chave.processoId ?? null;
      if (chave.fonteChave === 'nn') {
        imovel = { ...imovel, codigo, proc };
      }
    }
  }

  const vinculoOk = codigo !== '' && proc !== '';

  let contratos = [];
  let contratoVigente = null;
  if (featureFlags.useApiImoveis && imovel?._apiImovelId) {
    contratos = await request('/api/locacoes/contratos', { query: { imovelId: imovel._apiImovelId } });
    contratoVigente = selecionarContratoVigente(Array.isArray(contratos) ? contratos : []);
    if (contratoVigente?.id) {
      imovel = { ...imovel, _apiContratoId: contratoVigente.id };
    }
  }

  let painelFinanceiro = null;
  if (vinculoOk) {
    const cod8 = padCliente8(codigo);
    const procNum = Number.parseInt(String(proc).replace(/\D/g, ''), 10);
    let transacoes;
    let fonte = 'local';
    if (featureFlags.useApiFinanceiro) {
      transacoes = await listarLancamentosProcessoApiFirst({
        codigoCliente: cod8,
        numeroInterno: Number.isFinite(procNum) && procNum >= 1 ? procNum : proc,
        processoId: processoIdPainel ?? imovel?._apiProcessoId ?? null,
      });
      fonte = 'api';
    } else {
      transacoes = getTransacoesContaCorrenteCompleto(codigo, proc);
    }
    painelFinanceiro = montarPainelAdministracaoImovelDeTransacoes(transacoes, codigo, proc, {
      fonte,
      valorAluguelContrato: contratoVigente?.valorAluguel ?? imovel?.valorLocacao ?? null,
      nomeInquilino: imovel?.inquilino ?? contratoVigente?.inquilinoNome ?? null,
    });
  }

  return {
    imovel,
    codigo,
    proc,
    vinculoOk,
    painelFinanceiro,
    contratos: contratos || [],
    contratoVigente,
  };
}

// Repasse/despesa LEGADO (locacao_repasse/locacao_despesa) removido — C9/A8.
// O caixa real é reconciliado via locacao_repasse_lancamento (sugerir/vincular/resultado).

// -----------------------------------------------------------------------------
// Fase B — reconciliação do financeiro de imóveis (caixa real × ciclo de locação).
// Tudo apoiado no backbone do backend; o front não calcula resultado por heurística.
// -----------------------------------------------------------------------------

/** Sugestões de papel para os lançamentos do imóvel na competência (AAAA-MM). */
export async function sugerirReconciliacaoApi(contratoId, competencia) {
  if (!featureFlags.useApiImoveis) return [];
  const id = Number(contratoId);
  if (!id) return [];
  const rows = await request(`/api/locacoes/${id}/reconciliacao/sugestoes`, {
    query: { competencia: competencia || undefined },
  });
  return Array.isArray(rows) ? rows : [];
}

/** Confirma vínculos (lote ou linha a linha). `vinculos`: [{lancamentoFinanceiroId, papel, competenciaMes}]. */
export async function vincularReconciliacaoApi(contratoId, vinculos) {
  if (!featureFlags.useApiImoveis) return [];
  const id = Number(contratoId);
  if (!id) throw new Error('Contrato inválido para reconciliação.');
  const itens = (vinculos || [])
    .filter((v) => v && v.lancamentoFinanceiroId != null && v.papel)
    .map((v) => ({
      lancamentoFinanceiroId: Number(v.lancamentoFinanceiroId),
      papel: String(v.papel).toUpperCase(),
      competenciaMes: v.competenciaMes || null,
      rotuloClassificacao: v.rotuloClassificacao ? String(v.rotuloClassificacao).trim() : null,
    }));
  if (itens.length === 0) return [];
  const rows = await request(`/api/locacoes/${id}/reconciliacao/vincular`, {
    method: 'POST',
    body: { vinculos: itens },
  });
  return Array.isArray(rows) ? rows : [];
}

/** Desfaz um vínculo de reconciliação. */
export async function desvincularReconciliacaoApi(contratoId, vinculoId) {
  if (!featureFlags.useApiImoveis) return;
  const id = Number(contratoId);
  const vid = Number(vinculoId);
  if (!id || !vid) throw new Error('Parâmetros inválidos para desvincular.');
  await request(`/api/locacoes/${id}/reconciliacao/vinculos/${vid}`, { method: 'DELETE' });
}

/** Resultado por competência (`{ competencia }`) ou período (`{ inicio, fim }`). */
export async function obterResultadoImovelApi(contratoId, { competencia, inicio, fim } = {}) {
  if (!featureFlags.useApiImoveis) return null;
  const id = Number(contratoId);
  if (!id) return null;
  return request(`/api/locacoes/${id}/resultado`, {
    query: {
      competencia: competencia || undefined,
      inicio: inicio || undefined,
      fim: fim || undefined,
    },
  });
}

/** Carteira de repasses pendentes/divergentes (todos os imóveis). */
export async function listarRepassesPendentesApi({ ate } = {}) {
  if (!featureFlags.useApiImoveis) return { totalEmAberto: 0, itens: [] };
  return request('/api/locacoes/repasses-pendentes', {
    query: { ate: ate || undefined },
  });
}

/** Gera repasses internos (par débito/crédito na conta 900) para ALUGUELs vinculados sem REPASSE. */
export async function gerarRepassesInternosApi(contratoId, { competencia } = {}) {
  if (!featureFlags.useApiImoveis) return { repassesGerados: 0, repassesJaExistentes: 0, alugueisSemRepasse: 0 };
  const id = Number(contratoId);
  if (!id) throw new Error('Contrato inválido.');
  return request(`/api/locacoes/${id}/reconciliacao/gerar-repasses-internos`, {
    method: 'POST',
    query: { competencia: competencia || undefined },
  });
}

/** Checklist mês a mês: aluguel vinculado ou candidatos por competência. */
export async function obterMatrizCompetenciasApi(contratoId, { meses = 18 } = {}) {
  if (!featureFlags.useApiImoveis) return null;
  const id = Number(contratoId);
  if (!id) return null;
  return request(`/api/locacoes/${id}/reconciliacao/matriz-competencias`, {
    query: { meses: meses || undefined },
  });
}

/** Vínculos persistidos (ALUGUEL/REPASSE/DESPESA) com competência por lançamento. */
export async function listarVinculosReconciliacaoApi(contratoId) {
  if (!featureFlags.useApiImoveis) return [];
  const id = Number(contratoId);
  if (!id) return [];
  const rows = await request(`/api/locacoes/${id}/reconciliacao/vinculos`);
  return Array.isArray(rows) ? rows : [];
}

/** Cache em memória (sessão) para não repetir dezenas de GET ao aprovar/descartar. */
let cacheCadastroSugestoesVinculo = null;
let cacheCadastroSugestoesVinculoTs = 0;
const CACHE_CADASTRO_SUGESTOES_MS = 3 * 60 * 1000;
const cacheHistoricosVinculoPorChave = new Map();
let cacheCandidatosSemVinculo = null;
let cacheCandidatosSemVinculoKey = '';
let cacheCandidatosSemVinculoTs = 0;
const CACHE_CANDIDATOS_MS = 90 * 1000;
const HISTORICO_VINCULO_CONCORRENCIA = 10;

export function invalidarCachesSugestoesVinculoImoveis() {
  cacheCadastroSugestoesVinculo = null;
  cacheCadastroSugestoesVinculoTs = 0;
  cacheHistoricosVinculoPorChave.clear();
  cacheCandidatosSemVinculo = null;
  cacheCandidatosSemVinculoKey = '';
  cacheCandidatosSemVinculoTs = 0;
}

async function obterCadastroItensSugestoesVinculo(forcar = false) {
  if (
    !forcar &&
    cacheCadastroSugestoesVinculo?.ok &&
    Date.now() - cacheCadastroSugestoesVinculoTs < CACHE_CADASTRO_SUGESTOES_MS
  ) {
    return cacheCadastroSugestoesVinculo;
  }
  const cad = await carregarItensRelatorioImoveisApi();
  if (cad.ok) {
    cacheCadastroSugestoesVinculo = cad;
    cacheCadastroSugestoesVinculoTs = Date.now();
  }
  return cad;
}

async function mapComLimiteConcorrencia(itens, limite, fn) {
  const out = new Array(itens.length);
  let cursor = 0;
  async function worker() {
    for (;;) {
      const i = cursor;
      cursor += 1;
      if (i >= itens.length) break;
      out[i] = await fn(itens[i], i);
    }
  }
  const n = Math.max(1, Math.min(limite, itens.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

async function historicoVinculoParaImovel(im) {
  const cod8 = padCliente8(im.codigo);
  const procNum = Number.parseInt(String(im.proc).replace(/\D/g, ''), 10);
  const chave = `${String(cod8).replace(/\D/g, '')}|${procNum}`;
  if (cacheHistoricosVinculoPorChave.has(chave)) {
    return { chave, historico: cacheHistoricosVinculoPorChave.get(chave) };
  }
  try {
    const lancsUi = await listarLancamentosProcessoApiFirst({
      codigoCliente: cod8,
      numeroInterno: Number.isFinite(procNum) ? procNum : im.proc,
      processoId: im._apiProcessoId ?? null,
    });
    const apiShape = (lancsUi || []).map((t) => lancamentoUiParaPerfilHistorico(t, procNum));
    const historico = construirPerfilHistoricoImovel(apiShape);
    cacheHistoricosVinculoPorChave.set(chave, historico);
    return { chave, historico };
  } catch {
    const vazio = construirPerfilHistoricoImovel([]);
    cacheHistoricosVinculoPorChave.set(chave, vazio);
    return { chave, historico: vazio };
  }
}

async function listarCreditosBancoSemVinculoRecentes({ meses = 6, maxTotal = 1200, forcar = false } = {}) {
  const cacheKey = `${meses}|${maxTotal}`;
  if (
    !forcar &&
    cacheCandidatosSemVinculo &&
    cacheCandidatosSemVinculoKey === cacheKey &&
    Date.now() - cacheCandidatosSemVinculoTs < CACHE_CANDIDATOS_MS
  ) {
    return cacheCandidatosSemVinculo;
  }
  const candidatos = [];
  const vistos = new Set();
  for (const { ano, mes } of mesesRecentesParaBusca(meses)) {
    if (candidatos.length >= maxTotal) break;
    let page = 0;
    let totalPages = 1;
    while (page < totalPages && candidatos.length < maxTotal) {
      const p = await listarLancamentosFinanceiroPaginados({
        ano,
        mes,
        page,
        size: 150,
        sort: 'dataLancamento,desc',
      });
      totalPages = Number(p.totalPages) || 0;
      for (const l of p.content || []) {
        if (!lancamentoApiExtratoBanco(l) || !lancamentoApiSemVinculoProcesso(l)) continue;
        if (vistos.has(l.id)) continue;
        vistos.add(l.id);
        candidatos.push(l);
        if (candidatos.length >= maxTotal) break;
      }
      page += 1;
    }
  }
  cacheCandidatosSemVinculo = candidatos;
  cacheCandidatosSemVinculoKey = cacheKey;
  cacheCandidatosSemVinculoTs = Date.now();
  return candidatos;
}

/** Atualiza só o extrato/conta corrente do imóvel aberto (sem recarregar repasses, contrato, etc.). */
export async function recarregarSomentePainelFinanceiroImovel({ imovelId, imovelIdApi }) {
  const r = await carregarPainelAdministracaoImovel({ imovelId, imovelIdApi });
  return r.painelFinanceiro ?? null;
}

/**
 * Sugestões de vínculo de lançamentos bancários (extrato compartilhado) → imóveis (Cod.+Proc.).
 * Considera histórico de lançamentos já vinculados por imóvel.
 */
export async function carregarSugestoesVinculoImoveisExtrato(opts = {}) {
  const {
    imovelIdFiltro = null,
    mesesBusca = 6,
    limite = 50,
    scoreMinimo = 38,
    forcar = false,
    estrategia = 'melhorPorLancamento',
    maxParesPorLancamento = 6,
  } = opts;
  if (!featureFlags.useApiFinanceiro || !featureFlags.useApiImoveis) {
    return {
      ok: false,
      motivo: 'Ative VITE_USE_API_FINANCEIRO e VITE_USE_API_IMOVEIS.',
      sugestoes: [],
    };
  }

  const cad = await obterCadastroItensSugestoesVinculo(forcar);
  if (!cad.ok) {
    return { ok: false, motivo: cad.motivo || 'Falha ao carregar imóveis.', sugestoes: [] };
  }

  const imoveis = cad.itens || [];
  const historicosPorChave = new Map();
  const comVinculo = imoveis.filter(
    (im) => im.imovelOcupado && String(im.codigo ?? '').trim() && String(im.proc ?? '').trim(),
  );
  /** Histórico por imóvel é caro (N×API); carrega no máximo 20 pares, com cache por Cod.+Proc. */
  const comVinculoHistorico = comVinculo.length <= 20 ? comVinculo : comVinculo.slice(0, 20);
  const paresHistorico = await mapComLimiteConcorrencia(
    comVinculoHistorico,
    HISTORICO_VINCULO_CONCORRENCIA,
    historicoVinculoParaImovel,
  );
  for (const { chave, historico } of paresHistorico) {
    historicosPorChave.set(chave, historico);
  }

  const candidatos = await listarCreditosBancoSemVinculoRecentes({ meses: mesesBusca, forcar });
  const sugestoesBrutas = gerarSugestoesVinculoImoveis(candidatos, imoveis, historicosPorChave, {
    limite,
    scoreMinimo,
    imovelIdFiltro,
    estrategia,
    maxParesPorLancamento,
  });
  const sugestoes = filtrarSugestoesSemDescartadas(sugestoesBrutas);

  return {
    ok: true,
    sugestoes,
    totalCandidatos: candidatos.length,
    totalDescartadas: sugestoesBrutas.length - sugestoes.length,
  };
}

/**
 * Resolve ids reais (pessoa + processo) para gravar lançamento — mesmo critério do extrato Financeiro.
 * Não usa «793 → pessoa 793»; o processo pode pertencer a outra pessoa na base.
 */
export async function resolverIdsVinculoLancamentoCodProc(codigoCliente, proc, opts = {}) {
  const cod8 = padCliente8(codigoCliente);
  const procNum = Number.parseInt(String(proc ?? '').replace(/\D/g, ''), 10);

  let processoId =
    opts.processoIdApi != null && Number.isFinite(Number(opts.processoIdApi)) && Number(opts.processoIdApi) > 0
      ? Number(opts.processoIdApi)
      : null;
  let clienteId =
    opts.clienteIdApi != null && Number.isFinite(Number(opts.clienteIdApi)) && Number(opts.clienteIdApi) > 0
      ? Number(opts.clienteIdApi)
      : null;

  if (featureFlags.useApiProcessos && cod8) {
    try {
      const c = await buscarClientePorCodigo(cod8);
      const pk =
        c?.clienteId != null
          ? Number(c.clienteId)
          : c?.id != null && c?.pessoaId != null
            ? Number(c.id)
            : null;
      if (pk != null && Number.isFinite(pk)) {
        clienteId = pk;
      }
      if (!processoId && Number.isFinite(procNum) && procNum >= 0) {
        const p = await buscarProcessoPorChaveNatural(cod8, procNum);
        if (p?.id != null && Number.isFinite(Number(p.id))) {
          processoId = Number(p.id);
          const procClientePk =
            p.clienteId != null
              ? Number(p.clienteId)
              : null;
          if (procClientePk != null && Number.isFinite(procClientePk)) {
            clienteId = procClientePk;
          }
        }
      }
    } catch {
      /* mantém ids do cadastro do imóvel, se houver */
    }
  }

  if (!processoId) {
    processoId = await resolverProcessoId({ codigoCliente: cod8, numeroInterno: procNum });
  }
  if (processoId && !clienteId) {
    const p = await buscarProcessoPorId(processoId);
    if (p?.clienteId != null && Number.isFinite(Number(p.clienteId))) {
      clienteId = Number(p.clienteId);
    }
  }

  return { cod8, procNum, processoId: processoId || null, clienteId: clienteId || null };
}

/** Aplica vínculo Cod.+Proc. (+ tag de aluguel opcional) em um lançamento do extrato bancário. */
export async function aplicarSugestaoVinculoImovelExtrato(sugestao) {
  if (!featureFlags.useApiFinanceiro) {
    throw new Error('API financeiro desativada.');
  }
  const id = Number(sugestao?.lancamentoId);
  if (!id) throw new Error('Lançamento inválido.');

  const { cod8, procNum, processoId, clienteId } = await resolverIdsVinculoLancamentoCodProc(
    sugestao.codigoCliente,
    sugestao.proc,
    {
      processoIdApi: sugestao.processoIdApi,
      clienteIdApi: sugestao.clienteIdApi,
    },
  );
  if (!processoId) {
    throw new Error(`Processo não encontrado para ${cod8} / proc. ${procNum}.`);
  }

  const lanc = await buscarLancamentoFinanceiroApi(id);
  if (!lanc) throw new Error('Lançamento não encontrado na API.');

  const row = mapApiLancamentoToExtratoRow(lanc);
  const ui = extratoRowToUi(row);
  const codExib = String(Number(String(cod8).replace(/\D/g, '')) || cod8);
  ui.codCliente = codExib;
  ui.proc = String(procNum);
  ui._financeiroMeta = {
    ...ui._financeiroMeta,
    clienteId: clienteId || null,
    processoId,
  };

  if (sugestao.tagSugerida) {
    const tag = String(sugestao.tagSugerida).trim();
    const det = String(ui.descricaoDetalhada ?? '').trim();
    if (tag && !det.toUpperCase().includes(tag.toUpperCase())) {
      ui.descricaoDetalhada = det ? `${det} ${tag}` : tag;
    }
  } else if (sugestao.tipo === 'aluguel') {
    const det = String(ui.descricaoDetalhada ?? '').trim();
    if (!det.toUpperCase().includes(TAG_ADM_ALUGUEL)) {
      ui.descricaoDetalhada = det ? `${det} ${TAG_ADM_ALUGUEL}` : TAG_ADM_ALUGUEL;
    }
  }

  const salvo = await salvarOuAtualizarLancamentoFinanceiroApi(ui);
  if (!salvo?.id) throw new Error('Falha ao gravar vínculo no lançamento.');
  return { salvo, processoId, clienteId };
}
