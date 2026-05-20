import { request } from '../api/httpClient.js';
import { formatValorMoedaCampo } from '../utils/moneyBr.js';
import { parseValorMonetarioBr } from '../utils/parseValorMonetarioBr.js';
import { featureFlags, FEATURE_IPTU_NOVO } from '../config/featureFlags.js';
import { getTransacoesContaCorrenteCompleto } from '../data/financeiroData.js';
import {
  buildRelatorioFinanceiroImoveisMes,
  extrairTotaisFinanceirosMes,
  linhaRelatorioFinanceiroFromCadastro,
  montarPainelAdministracaoImovel,
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

/** Cache em memória: número da pessoa → nome (evita N×GET no relatório). */
const cacheNomePessoa = new Map();

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
  const prim = (v.vinculos || []).find((x) => x.cadastroAtual) || (v.vinculos || [])[0];
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
 * Preenche inquilino/proprietário pelo cadastro de pessoas quando só há o número (contrato API).
 */
export async function enriquecerNomesPartesImovelUi(item) {
  if (!item) return item;
  let inquilino = String(item.inquilino ?? '').trim();
  let proprietario = String(item.proprietario ?? '').trim();
  const idInq = parseIdPessoa(item.inquilinoNumeroPessoa);
  const idProp = parseIdPessoa(item.proprietarioNumeroPessoa);
  if (!inquilino && idInq) inquilino = await resolverNomePessoaPorId(idInq);
  if (!proprietario && idProp) proprietario = await resolverNomePessoaPorId(idProp);
  return { ...item, inquilino, proprietario };
}

export async function enriquecerNomesPartesImoveisLote(itens) {
  const lista = Array.isArray(itens) ? itens : [];
  const ids = new Set();
  for (const item of lista) {
    if (!String(item.inquilino ?? '').trim()) {
      const id = parseIdPessoa(item.inquilinoNumeroPessoa);
      if (id) ids.add(id);
    }
    if (!String(item.proprietario ?? '').trim()) {
      const id = parseIdPessoa(item.proprietarioNumeroPessoa);
      if (id) ids.add(id);
    }
  }
  await Promise.all([...ids].map((id) => resolverNomePessoaPorId(id)));
  return Promise.all(lista.map((item) => enriquecerNomesPartesImovelUi(item)));
}

function mapApiToUi(imovel, contrato) {
  const extras = normalizarExtrasImovelParaUi(parseJsonSafe(imovel?.camposExtrasJson, {}));
  const dadosBanc = parseJsonSafe(contrato?.dadosBancariosRepasseJson, {});
  const idApi = Number(imovel?.id);
  const np = imovel?.numeroPlanilha != null ? Number(imovel.numeroPlanilha) : null;
  /** No formulário Imóveis (API): o inteiro exibido é o da col. A da planilha; sem planilha, cai no id interno. */
  const imovelIdUi = np != null && Number.isFinite(np) && np >= 1 ? np : idApi;
  return {
    imovelId: imovelIdUi,
    imovelOcupado: String(imovel?.situacao || '').toUpperCase() !== 'DESOCUPADO',
    codigo: String(extras.codigo || imovel?.codigoCliente || ''),
    proc: String(
      extras.proc || (imovel?.numeroInternoProcesso != null ? imovel.numeroInternoProcesso : ''),
    ),
    observacoesInquilino: String(extras.observacoesInquilino ?? ''),
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
  };
}

export async function resolverClienteIdPorCodigo(codigoCliente) {
  const cod = padCliente8(codigoCliente);
  const list = await request('/api/clientes');
  const c = (list || []).find((x) => String(x.codigoCliente) === cod);
  return c?.id ?? null;
}

export async function resolverProcessoIdPorChave(codigoCliente, procInterno) {
  const p = await buscarProcessoPorChaveNatural(codigoCliente, procInterno);
  return p?.id ?? null;
}

function montarPayloadImovelFromUi(ui, clienteId, processoId) {
  const extras = {
    codigo: String(ui.codigo ?? ''),
    proc: String(ui.proc ?? ''),
    observacoesInquilino: String(ui.observacoesInquilino ?? ''),
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
    proprietario: String(ui.proprietario ?? ''),
    proprietarioCpf: String(ui.proprietarioCpf ?? ''),
    proprietarioContato: String(ui.proprietarioContato ?? ''),
    linkVistoria: String(ui.linkVistoria ?? ''),
    inquilino: String(ui.inquilino ?? ''),
    inquilinoCpf: String(ui.inquilinoCpf ?? ''),
    inquilinoContato: String(ui.inquilinoContato ?? ''),
    contratoAssinadoInquilino: String(ui.contratoAssinadoInquilino ?? 'nao'),
    contratoAssinadoProprietario: String(ui.contratoAssinadoProprietario ?? 'nao'),
    contratoAssinadoGarantidor: String(ui.contratoAssinadoGarantidor ?? 'nao'),
    contratoAssinadoTestemunhas: String(ui.contratoAssinadoTestemunhas ?? 'nao'),
    contratoArquivado: String(ui.contratoArquivado ?? 'nao'),
    contratoIntermediacaoArquivado: String(ui.contratoIntermediacaoArquivado ?? 'nao'),
    contratoIntermediacaoAssinadoProprietario: String(ui.contratoIntermediacaoAssinadoProprietario ?? 'nao'),
    valorGarantia: String(ui.valorGarantia ?? ''),
  };
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
  return {
    imovelId,
    locadorPessoaId: Number(ui.proprietarioNumeroPessoa) || null,
    inquilinoPessoaId: Number(ui.inquilinoNumeroPessoa) || null,
    dataInicio: toIsoDate(ui.dataInicioContrato),
    dataFim: toIsoDate(ui.dataFimContrato),
    valorAluguel: toNumberOrNull(ui.valorLocacao),
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
    observacoes: String(ui.observacoesInquilino || '').trim() || null,
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

/**
 * Todos os pares (codigoCliente, numeroInterno) com imóvel ligado ao nº da planilha.
 * @param {{ numeroPlanilha?: number, imovelIdApi?: number }} opts
 */
export async function listarVinculosProcessoImovel(opts = {}) {
  if (!featureFlags.useApiImoveis) {
    return { numeroPlanilha: opts.numeroPlanilha ?? null, vinculos: [] };
  }
  const np = Number(opts.numeroPlanilha);
  const idApi = Number(opts.imovelIdApi);
  try {
    if (Number.isFinite(idApi) && idApi > 0) {
      return await request(`/api/imoveis/${idApi}/vinculos-processo`);
    }
    if (Number.isFinite(np) && np >= 1) {
      return await request(`/api/imoveis/por-numero-planilha/${np}/vinculos-processo`);
    }
    return { numeroPlanilha: null, vinculos: [] };
  } catch {
    return { numeroPlanilha: np >= 1 ? np : null, vinculos: [] };
  }
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

/**
 * Resolve cadastro para painéis/navegação: prioriza nº da planilha (col. A), depois id interno da API.
 * Evita confundir GET /api/imoveis/{id} quando o id da URL é o número do imóvel na planilha.
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
  const apiId = Number(imovelIdApi ?? imovelId);
  if (Number.isFinite(apiId) && apiId >= 1) {
    return carregarImovelCadastro({ imovelId: apiId });
  }
  return { fonte: 'api', item: null, encontrado: false };
}

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
    const itens = await enriquecerNomesPartesImoveisLote(results);
    return { ok: true, itens };
  } catch (e) {
    return { ok: false, motivo: e?.message || 'Falha ao carregar dados para o relatório.', itens: [] };
  }
}

/**
 * Relatório financeiro consolidado (imóveis × mês): cadastro na API + totais da conta corrente por processo.
 */
export async function carregarRelatorioFinanceiroImoveisMes(chaveMesYYYYMM, opts = {}) {
  const { soOcupados = true } = opts;
  const cad = await carregarItensRelatorioImoveisApi();
  if (!cad.ok) {
    return { ok: false, motivo: cad.motivo, linhas: [], ultimaCarga: null };
  }

  let linhas = buildRelatorioFinanceiroImoveisMes(cad.itens, chaveMesYYYYMM, { soOcupados });

  if (featureFlags.useApiFinanceiro && linhas.length > 0) {
    const itensPorId = new Map(cad.itens.map((i) => [i.imovelId, i]));
    linhas = await Promise.all(
      linhas.map(async (linha) => {
        const procNum = Number(String(linha.proc).replace(/\D/g, ''));
        const codNum = Number(String(linha.codigo).replace(/\D/g, ''));
        if (!codNum || !Number.isFinite(procNum)) return linha;
        try {
          const lancs = await listarLancamentosProcessoApiFirst({
            codigoCliente: String(codNum).padStart(8, '0'),
            numeroInterno: procNum,
          });
          const totais = extrairTotaisFinanceirosMes(lancs, codNum, procNum, chaveMesYYYYMM);
          const item = itensPorId.get(linha.imovelId);
          if (!item) return { ...linha, ...totais };
          return linhaRelatorioFinanceiroFromCadastro(item, chaveMesYYYYMM, totais);
        } catch {
          return linha;
        }
      }),
    );
  }

  return { ok: true, linhas, ultimaCarga: new Date() };
}

export async function salvarImovelCadastro(uiPayload) {
  if (!featureFlags.useApiImoveis) {
    return { fonte: 'legado', salvo: false, motivo: 'Mock sem persistência real.' };
  }
  const codigoTrim = String(uiPayload.codigo ?? '').trim();
  let clienteId = null;
  if (codigoTrim) {
    clienteId = await resolverClienteIdPorCodigo(uiPayload.codigo);
    if (!clienteId) {
      throw new Error('Cliente não encontrado para o código informado.');
    }
  }
  const processoId =
    clienteId && String(uiPayload.proc ?? '').trim()
      ? await resolverProcessoIdPorChave(uiPayload.codigo, uiPayload.proc)
      : null;

  const bodyImovel = montarPayloadImovelFromUi(uiPayload, clienteId, processoId);
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
    item: mapApiToUi(imovelSalvo, contratoSalvo),
  };
}

export async function carregarPainelAdministracaoImovel({ imovelId, imovelIdApi, codigoFallback, procFallback }) {
  let codigo = String(codigoFallback ?? '').trim();
  let proc = String(procFallback ?? '').trim();
  let imovel = null;

  if (featureFlags.useApiImoveis) {
    const r = await carregarImovelCadastroParaPainel({ imovelId, imovelIdApi });
    imovel = r.item;
    if (imovel) {
      codigo = String(imovel.codigo || codigo).trim();
      proc = String(imovel.proc || proc).trim();
    }
  }

  const vinculoOk = codigo !== '' && proc !== '';
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
        processoId: imovel?._apiProcessoId ?? null,
      });
      fonte = 'api';
    } else {
      transacoes = getTransacoesContaCorrenteCompleto(codigo, proc);
    }
    painelFinanceiro = montarPainelAdministracaoImovelDeTransacoes(transacoes, codigo, proc, { fonte });
  }

  let contratos = [];
  let repasses = [];
  let despesas = [];
  let contratoVigente = null;
  if (featureFlags.useApiImoveis && imovel?._apiImovelId) {
    contratos = await request('/api/locacoes/contratos', { query: { imovelId: imovel._apiImovelId } });
    contratoVigente = selecionarContratoVigente(Array.isArray(contratos) ? contratos : []);
    if (contratoVigente?.id) {
      imovel = { ...imovel, _apiContratoId: contratoVigente.id };
      repasses = await request('/api/locacoes/repasses', { query: { contratoId: contratoVigente.id } });
      despesas = await request('/api/locacoes/despesas', { query: { contratoId: contratoVigente.id } });
    }
  }

  return {
    imovel,
    codigo,
    proc,
    vinculoOk,
    painelFinanceiro,
    contratos: contratos || [],
    contratoVigente,
    repasses: repasses || [],
    despesas: despesas || [],
  };
}

/** Cria (POST) ou atualiza (PUT) repasse; quando `payload.id` está definido, usa PUT. */
export async function salvarRepasseLocacao(payload) {
  if (!featureFlags.useApiImoveis) return null;
  const body = {
    contratoId: Number(payload.contratoId),
    competenciaMes: String(payload.competenciaMes || '').trim(),
    valorRecebidoInquilino: toNumberOrNull(payload.valorRecebidoInquilino),
    valorRepassadoLocador: toNumberOrNull(payload.valorRepassadoLocador),
    valorDespesasRepassar: toNumberOrNull(payload.valorDespesasRepassar),
    remuneracaoEscritorio: toNumberOrNull(payload.remuneracaoEscritorio),
    status: payload.status || 'PENDENTE',
    dataRepasseEfetiva: payload.dataRepasseEfetiva || null,
    observacao: payload.observacao || null,
    lancamentoFinanceiroVinculoId: payload.lancamentoFinanceiroVinculoId || null,
  };
  if (payload.id) {
    return request(`/api/locacoes/repasses/${payload.id}`, { method: 'PUT', body });
  }
  return request('/api/locacoes/repasses', { method: 'POST', body });
}

/** Cria (POST) ou atualiza (PUT) despesa; quando `payload.id` está definido, usa PUT. */
export async function salvarDespesaLocacao(payload) {
  if (!featureFlags.useApiImoveis) return null;
  const body = {
    contratoId: Number(payload.contratoId),
    competenciaMes: String(payload.competenciaMes || '').trim() || null,
    descricao: String(payload.descricao || '').trim(),
    valor: toNumberOrNull(payload.valor),
    categoria: payload.categoria || 'OUTROS',
    lancamentoFinanceiroId: payload.lancamentoFinanceiroId || null,
    observacao: payload.observacao || null,
  };
  if (payload.id) {
    return request(`/api/locacoes/despesas/${payload.id}`, { method: 'PUT', body });
  }
  return request('/api/locacoes/despesas', { method: 'POST', body });
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
      if (c?.id != null && Number.isFinite(Number(c.id))) {
        clienteId = Number(c.id);
      }
      if (!processoId && Number.isFinite(procNum) && procNum >= 0) {
        const p = await buscarProcessoPorChaveNatural(cod8, procNum);
        if (p?.id != null && Number.isFinite(Number(p.id))) {
          processoId = Number(p.id);
          const pessoaProc = p.clienteId ?? p.pessoaId;
          if (pessoaProc != null && Number.isFinite(Number(pessoaProc))) {
            clienteId = Number(pessoaProc);
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
    const pessoaProc = p?.clienteId ?? p?.pessoaId;
    if (pessoaProc != null && Number.isFinite(Number(pessoaProc))) {
      clienteId = Number(pessoaProc);
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
