import { request } from '../api/httpClient.js';
import { formatValorMoedaCampo } from '../utils/moneyBr.js';
import { parseValorMonetarioBr } from '../utils/parseValorMonetarioBr.js';
import { featureFlags, FEATURE_IPTU_NOVO } from '../config/featureFlags.js';
import {
  getTransacoesContaCorrenteCompleto,
  normalizarCodigoClienteFinanceiro,
  normalizarProcFinanceiro,
} from '../data/financeiroData.js';
import {
  buildRelatorioFinanceiroImoveisMes,
  chaveParCodProc,
  extrairTotaisFinanceirosMesComRepasseAnterior,
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
  return /^\d{2}\/\d{2}\/\d{4}$/.test(s) ? s : s;
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
  if (String(item.codigo ?? '').trim() && String(item.proc ?? '').trim()) return item;
  const np = apiImovel?.numeroPlanilha;
  const idApi = apiImovel?.id;
  const v = await listarVinculosProcessoImovel({
    numeroPlanilha: np != null ? Number(np) : undefined,
    imovelIdApi: idApi != null ? Number(idApi) : undefined,
  });
  const lista = v.vinculos || [];
  const prim =
    lista.find((x) => x.principal) || lista.find((x) => x.cadastroAtual) || lista[lista.length - 1];
  if (!prim) return item;
  return {
    ...item,
    codigo: String(item.codigo || prim.codigoCliente || '').trim(),
    proc:
      String(item.proc || (prim.numeroInterno != null ? prim.numeroInterno : '')).trim(),
    _apiProcessoId: item._apiProcessoId || prim.processoId || null,
  };
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

  return {
    ...item,
    inquilino,
    inquilinoCpf,
    inquilinoContato,
    proprietario,
    proprietarioCpf,
    proprietarioContato,
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
    dataInicioContrato: toBrDate(contrato?.dataInicio),
    dataFimContrato: toBrDate(contrato?.dataFim),
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
    proprietarioNumeroPessoa: String(contrato?.locadorPessoaId ?? ''),
    proprietario: String(extras.proprietario ?? ''),
    proprietarioCpf: String(extras.proprietarioCpf ?? ''),
    proprietarioContato: String(extras.proprietarioContato ?? ''),
    linkVistoria: String(extras.linkVistoria ?? ''),
    inquilinoNumeroPessoa: String(contrato?.inquilinoPessoaId ?? ''),
    inquilino: String(extras.inquilino ?? ''),
    inquilinoCpf: String(extras.inquilinoCpf ?? ''),
    inquilinoContato: String(extras.inquilinoContato ?? ''),
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
  };
}

export async function resolverClienteIdPorCodigo(codigoCliente) {
  const cod = padCliente8(codigoCliente);
  const list = await request('/api/clientes');
  const c = (list || []).find((x) => String(x.codigoCliente) === cod);
  if (!c) return null;
  if (c.clienteId != null && Number.isFinite(Number(c.clienteId))) return Number(c.clienteId);
  return c.id != null && c.pessoaId != null ? Number(c.id) : null;
}

export async function resolverProcessoIdPorChave(codigoCliente, procInterno) {
  const p = await buscarProcessoPorChaveNatural(codigoCliente, procInterno);
  return p?.id ?? null;
}

function montarPayloadImovelFromUi(ui, clienteId, processoId, espelhoCodProc = null) {
  const extrasOrig =
    ui._jsonExtrasOriginal && typeof ui._jsonExtrasOriginal === 'object' ? ui._jsonExtrasOriginal : {};
  const idProp = parseIdPessoa(ui.proprietarioNumeroPessoa);
  const idInq = parseIdPessoa(ui.inquilinoNumeroPessoa);
  const codEspelho = espelhoCodProc?.codigo ?? String(ui.codigo ?? '');
  const procEspelho = espelhoCodProc?.proc ?? String(ui.proc ?? '');

  const extras = {
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
    const nome = preservarChaveExtrasLegado(extrasOrig, ['proprietario']);
    const cpf = preservarChaveExtrasLegado(extrasOrig, ['proprietarioCpf']);
    const contato = preservarChaveExtrasLegado(extrasOrig, ['proprietarioContato']);
    if (nome) extras.proprietario = nome;
    if (cpf) extras.proprietarioCpf = cpf;
    if (contato) extras.proprietarioContato = contato;
  } else {
    extras.proprietario = String(ui.proprietario ?? '');
    extras.proprietarioCpf = String(ui.proprietarioCpf ?? '');
    extras.proprietarioContato = String(ui.proprietarioContato ?? '');
  }

  if (idInq) {
    const nome = preservarChaveExtrasLegado(extrasOrig, ['inquilino']);
    const cpf = preservarChaveExtrasLegado(extrasOrig, ['inquilinoCpf']);
    const contato = preservarChaveExtrasLegado(extrasOrig, ['inquilinoContato']);
    if (nome) extras.inquilino = nome;
    if (cpf) extras.inquilinoCpf = cpf;
    if (contato) extras.inquilinoContato = contato;
  } else {
    extras.inquilino = String(ui.inquilino ?? '');
    extras.inquilinoCpf = String(ui.inquilinoCpf ?? '');
    extras.inquilinoContato = String(ui.inquilinoContato ?? '');
  }
  const nPlan = Number(ui.imovelId);
  const numeroPlanilhaBody =
    Number.isFinite(nPlan) && nPlan >= 1 ? Math.floor(nPlan) : null;

  return {
    clienteId,
    processoId: processoId || null,
    numeroPlanilha: numeroPlanilhaBody,
    titulo: String(ui.unidade || ui.condominio || '').trim() || null,
    enderecoCompleto: String(ui.endereco || '').trim() || null,
    condominio: String(ui.condominio || '').trim() || null,
    unidade: String(ui.unidade || '').trim() || null,
    tipoImovel: null,
    situacao: ui.imovelOcupado ? 'OCUPADO' : 'DESOCUPADO',
    garagens: String(ui.garagens || '').trim() || null,
    inscricaoImobiliaria: String(ui.inscricaoImobiliaria || '').trim() || null,
    observacoes: String(ui.observacoesInquilino || '').trim() || null,
    camposExtrasJson: JSON.stringify(extras),
    ativo: true,
  };
}

function montarPayloadContratoFromUi(ui, imovelId) {
  const obsContratoLegado = String(ui._contratoObservacoesOriginal ?? '').trim();
  return {
    imovelId,
    locadorPessoaId: Number(ui.proprietarioNumeroPessoa) || null,
    inquilinoPessoaId: Number(ui.inquilinoNumeroPessoa) || null,
    dataInicio: toIsoDate(ui.dataInicioContrato),
    dataFim: toIsoDate(ui.dataFimContrato),
    valorAluguel: toNumberOrNull(ui.valorLocacao),
    taxaAdministracaoPercent:
      toNumberOrNull(String(ui.taxaAdministracaoPercent ?? '').replace(',', '.')) ?? 10,
    valorRepassePactuado: null,
    diaVencimentoAluguel: Number(ui.diaPagAluguel) || null,
    diaRepasse: Number(ui.diaRepasse) || null,
    garantiaTipo: String(ui.garantia || '').trim() || null,
    valorGarantia: toNumberOrNull(ui.valorGarantia),
    dadosBancariosRepasseJson: JSON.stringify({
      banco: String(ui.banco ?? ''),
      agencia: String(ui.agencia ?? ''),
      numeroBanco: String(ui.numeroBanco ?? ''),
      conta: String(ui.conta ?? ''),
      cpfBanco: String(ui.cpfBanco ?? ''),
      titular: String(ui.titular ?? ''),
      chavePix: String(ui.chavePix ?? ''),
    }),
    status: 'VIGENTE',
    observacoes: obsContratoLegado || null,
  };
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

function mesclarVinculosProcessoImovel(apiPayload, numeroPlanilha) {
  const np = Number(numeroPlanilha);
  const merged = Array.isArray(apiPayload?.vinculos) ? [...apiPayload.vinculos] : [];
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

  merged.forEach((v, i) => {
    v.principal = i === merged.length - 1;
  });
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
    return Number(cur.id) < Number(best.id) ? cur : best;
  }, null);
}

async function montarItemCadastroFromApiImovel(apiImovel) {
  const contratos = await request('/api/locacoes/contratos', { query: { imovelId: apiImovel.id } });
  const contratoAtual = selecionarContratoVigente(Array.isArray(contratos) ? contratos : []);
  let item = mapApiToUi(apiImovel, contratoAtual);
  item = await enriquecerCodigoProcDoVinculo(item, apiImovel);
  item = await enriquecerNomesPartesImovelUi(item);
  return item;
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

export async function carregarImovelCadastroPorNumeroPlanilha(numeroPlanilha) {
  if (!featureFlags.useApiImoveis) {
    return { fonte: 'legado', item: null, encontrado: false };
  }
  const n = Number(numeroPlanilha);
  if (!Number.isFinite(n) || n < 1) {
    return { fonte: 'api', item: null, encontrado: false };
  }
  try {
    const apiImovel = await request(`/api/imoveis/por-numero-planilha/${n}`);
    const item = await montarItemCadastroResiliente(apiImovel);
    return { fonte: 'api', item, encontrado: true };
  } catch {
    try {
      const list = await listarImoveisApi();
      const candidatos = (Array.isArray(list) ? list : []).filter((i) => Number(i.numeroPlanilha) === n);
      const melhor = escolherMelhorImovelApiPorNumeroPlanilha(candidatos);
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
export async function carregarImovelCadastroParaPainel({ imovelId, imovelIdApi } = {}) {
  if (!featureFlags.useApiImoveis) {
    return { fonte: 'legado', item: null, encontrado: false };
  }
  const np = Number(imovelId);
  if (Number.isFinite(np) && np >= 1) {
    const porPlanilha = await carregarImovelCadastroPorNumeroPlanilha(np);
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
    const contratos = await request('/api/locacoes/contratos', { query: { imovelId: apiImovel.id } });
    const contratoAtual = selecionarContratoVigente(Array.isArray(contratos) ? contratos : []);
    let item = mapApiToUi(apiImovel, contratoAtual);
    item = await enriquecerCodigoProcDoVinculo(item, apiImovel);
    item = await enriquecerNomesPartesImovelUi(item);
    return { fonte: 'api', item, encontrado: true };
  } catch {
    return { fonte: 'api', item: null, encontrado: false };
  }
}

/** Export admin Itamar: col. A da planilha = nº 1…66 (não código de cliente nem id interno da API). */
export const MAX_NUMERO_PLANILHA_RELATORIO_IMOVEIS = 66;

function scoreItemRelatorioImovel(item) {
  let s = 0;
  if (String(item?.unidade ?? '').trim()) s += 4;
  if (String(item?.condominio ?? '').trim()) s += 2;
  if (String(item?.codigo ?? '').trim()) s += 1;
  if (item?.imovelOcupado) s += 1;
  return s;
}

/** Uma linha por nº da planilha (1–66); descarta duplicados de import-real e registos com nº inválido. */
export function filtrarItensRelatorioPlanilhaAdmin(itens) {
  const porNumero = new Map();
  for (const item of itens || []) {
    const np = Number(item?.imovelId ?? item?.numeroPlanilhaColA);
    if (!Number.isFinite(np) || np < 1 || np > MAX_NUMERO_PLANILHA_RELATORIO_IMOVEIS) continue;
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
    const results = await Promise.all(
      list.map(async (im) => {
        const np = im.numeroPlanilha != null ? Number(im.numeroPlanilha) : null;
        const r =
          Number.isFinite(np) && np >= 1
            ? await carregarImovelCadastroPorNumeroPlanilha(np)
            : await carregarImovelCadastro({ imovelId: im.id });
        if (r.item) return r.item;
        // Sempre incluir o imóvel: a lista GET já traz o mesmo shape de ImovelResponse; se o GET por id falhar, monta a linha só com esse payload + sem contrato.
        const base = mapApiToUi(im, null);
        return enriquecerNomesPartesImovelUi(base);
      }),
    );
    const itens = filtrarItensRelatorioPlanilhaAdmin(
      await enriquecerNomesPartesImoveisLote(results),
    );
    return { ok: true, itens };
  } catch (e) {
    return { ok: false, motivo: e?.message || 'Falha ao carregar dados para o relatório.', itens: [] };
  }
}

/**
 * Relatório financeiro (imóveis × mês): extratos bancários com Cod.+Proc., filtrado por nº de imóvel no processo.
 */
export async function carregarRelatorioFinanceiroImoveisMes(chaveMesYYYYMM, opts = {}) {
  const { soOcupados = true, signal } = opts;
  const cad = await carregarItensRelatorioImoveisApi();
  if (!cad.ok) {
    return { ok: false, motivo: cad.motivo, linhas: [], ultimaCarga: null };
  }

  /** Cod.+proc. canônicos (N:N do imóvel) — evita buscar extrato do par errado (ex.: 938/4 vs 856/4). */
  const itensCanon = await Promise.all(
    (cad.itens || []).map(async (item) => {
      const chave = await resolverChaveProcessoContaCorrentePainel(item);
      return {
        ...item,
        codigo: chave.codigo || item.codigo,
        proc: chave.proc || item.proc,
        _apiProcessoId: chave.processoId ?? item._apiProcessoId ?? null,
      };
    }),
  );

  const totaisPorPar = new Map();
  const chavesVinculo = new Set();
  const metaPorChave = new Map();
  for (const item of itensCanon) {
    const cod = normalizarCodigoClienteFinanceiro(item.codigo);
    const procNorm = normalizarProcFinanceiro(item.proc);
    const chave = chaveParCodProc(cod, procNorm);
    if (chave) {
      chavesVinculo.add(chave);
      const prev = metaPorChave.get(chave);
      metaPorChave.set(chave, {
        processoId: item._apiProcessoId ?? prev?.processoId ?? null,
        valorLocacao: item.valorLocacao ?? prev?.valorLocacao ?? null,
        nomeInquilino: item.inquilino ?? prev?.nomeInquilino ?? null,
      });
    }
  }

  if (featureFlags.useApiFinanceiro) {
    await Promise.all(
      [...chavesVinculo].map(async (chave) => {
        const [cod, procNorm] = chave.split('|');
        const procNum = Number(procNorm);
        const meta = metaPorChave.get(chave) || {};
        try {
          const lancs = await listarLancamentosProcessoApiFirst({
            codigoCliente: cod,
            numeroInterno: Number.isFinite(procNum) && procNum >= 1 ? procNum : procNorm,
            processoId: meta.processoId ?? undefined,
            signal,
          });
          totaisPorPar.set(
            chave,
            extrairTotaisFinanceirosMesComRepasseAnterior(lancs, Number(cod), procNum, chaveMesYYYYMM, {
              valorAluguelContrato: meta.valorLocacao,
              nomeInquilino: meta.nomeInquilino,
            }),
          );
        } catch {
          /* mantém totais vazios para o par */
        }
      }),
    );
  } else {
    for (const chave of chavesVinculo) {
      const [cod, procNorm] = chave.split('|');
      const meta = metaPorChave.get(chave) || {};
      const lancs = getTransacoesContaCorrenteCompleto(cod, procNorm);
      totaisPorPar.set(
        chave,
        extrairTotaisFinanceirosMesComRepasseAnterior(lancs, Number(cod), Number(procNorm), chaveMesYYYYMM, {
          valorAluguelContrato: meta.valorLocacao,
          nomeInquilino: meta.nomeInquilino,
        }),
      );
    }
  }

  const linhas = buildRelatorioFinanceiroImoveisMes(itensCanon, chaveMesYYYYMM, {
    soOcupados,
    totaisPorPar,
  });

  return { ok: true, linhas, ultimaCarga: new Date() };
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
  }

  const bodyImovel = montarPayloadImovelFromUi(uiPayload, clienteId, vinculo.processoIdPayload, {
    codigo: vinculo.espelhoCodigo,
    proc: vinculo.espelhoProc,
  });
  const imovelSalvo = uiPayload._apiImovelId
    ? await request(`/api/imoveis/${uiPayload._apiImovelId}`, { method: 'PUT', body: bodyImovel })
    : await request('/api/imoveis', { method: 'POST', body: bodyImovel });

  const contratoBody = montarPayloadContratoFromUi(uiPayload, imovelSalvo.id);
  let contratoSalvo = null;
  if (contratoBody.dataInicio && contratoBody.valorAluguel != null) {
    contratoSalvo = uiPayload._apiContratoId
      ? await request(`/api/locacoes/contratos/${uiPayload._apiContratoId}`, { method: 'PUT', body: contratoBody })
      : await request('/api/locacoes/contratos', { method: 'POST', body: contratoBody });
  }

  return {
    fonte: 'api',
    salvo: true,
    item: await enriquecerNomesPartesImovelUi(mapApiToUi(imovelSalvo, contratoSalvo)),
  };
}

/**
 * Chave do processo para conta corrente / painel financeiro do imóvel (somente leitura).
 * Com N:N ({@code _apiProcessoId}): deriva cod+proc oficiais do processo — não dos extras.
 * Sem N:N: mantém cod/proc do cadastro (extras).
 */
export async function resolverChaveProcessoContaCorrentePainel(imovel) {
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
