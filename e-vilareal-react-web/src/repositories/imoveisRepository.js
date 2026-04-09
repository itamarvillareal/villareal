import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';
import { montarPainelAdministracaoImovel } from '../data/imoveisAdministracaoFinanceiro.js';

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
  const n = Number(String(v ?? '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseJsonSafe(s, fallback = {}) {
  try {
    const p = JSON.parse(String(s || ''));
    return p && typeof p === 'object' ? p : fallback;
  } catch {
    return fallback;
  }
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
    existeDebIptu: String(mock.existeDebIptu ?? ''),
    dataConsIptu: String(mock.dataConsIptu ?? ''),
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
    infoIptuTexto: String(mock.infoIptuTexto ?? ''),
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

function mapApiToUi(imovel, contrato) {
  const extras = parseJsonSafe(imovel?.camposExtrasJson, {});
  const dadosBanc = parseJsonSafe(contrato?.dadosBancariosRepasseJson, {});
  const idApi = Number(imovel?.id);
  const np = imovel?.numeroPlanilha != null ? Number(imovel.numeroPlanilha) : null;
  /** No formulário Imóveis (API): o inteiro exibido é o da col. A da planilha; sem planilha, cai no id interno. */
  const imovelIdUi = np != null && Number.isFinite(np) && np >= 1 ? np : idApi;
  return {
    imovelId: imovelIdUi,
    imovelOcupado: String(imovel?.situacao || '').toUpperCase() !== 'DESOCUPADO',
    codigo: String(extras.codigo ?? ''),
    proc: String(extras.proc ?? ''),
    observacoesInquilino: String(extras.observacoesInquilino ?? ''),
    endereco: String(imovel?.enderecoCompleto ?? ''),
    condominio: String(imovel?.condominio ?? ''),
    unidade: String(imovel?.unidade ?? ''),
    garagens: String(imovel?.garagens ?? ''),
    garantia: String(contrato?.garantiaTipo ?? ''),
    valorGarantia:
      extras.valorGarantia != null && String(extras.valorGarantia).trim() !== ''
        ? String(extras.valorGarantia)
        : contrato?.valorGarantia != null
          ? String(contrato.valorGarantia)
          : '',
    valorLocacao: contrato?.valorAluguel != null ? String(contrato.valorAluguel) : '',
    diaPagAluguel: contrato?.diaVencimentoAluguel != null ? String(contrato.diaVencimentoAluguel).padStart(2, '0') : '',
    dataPag1TxCond: String(extras.dataPag1TxCond ?? ''),
    inscricaoImobiliaria: String(imovel?.inscricaoImobiliaria ?? ''),
    existeDebIptu: String(extras.existeDebIptu ?? ''),
    dataConsIptu: String(extras.dataConsIptu ?? ''),
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
    infoIptuTexto: String(extras.infoIptuTexto ?? ''),
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
  const cod = padCliente8(codigoCliente);
  const list = await request('/api/processos', { query: { codigoCliente: cod } });
  const p = (list || []).find((x) => Number(x.numeroInterno) === Number(procInterno));
  return p?.id ?? null;
}

function montarPayloadImovelFromUi(ui, clienteId, processoId) {
  const extras = {
    codigo: String(ui.codigo ?? ''),
    proc: String(ui.proc ?? ''),
    observacoesInquilino: String(ui.observacoesInquilino ?? ''),
    dataPag1TxCond: String(ui.dataPag1TxCond ?? ''),
    existeDebIptu: String(ui.existeDebIptu ?? ''),
    dataConsIptu: String(ui.dataConsIptu ?? ''),
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
    infoIptuTexto: String(ui.infoIptuTexto ?? ''),
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
    return { fonte: 'api', item: mapApiToUi(apiImovel, contratoAtual), encontrado: true };
  } catch {
    return { fonte: 'api', item: null, encontrado: false };
  }
}

export async function carregarImovelCadastro({ imovelId }) {
  if (!featureFlags.useApiImoveis) {
    return { fonte: 'legado', item: null, encontrado: false };
  }
  try {
    const apiImovel = await request(`/api/imoveis/${Number(imovelId)}`);
    const contratos = await request('/api/locacoes/contratos', { query: { imovelId: apiImovel.id } });
    const contratoAtual = selecionarContratoVigente(Array.isArray(contratos) ? contratos : []);
    return { fonte: 'api', item: mapApiToUi(apiImovel, contratoAtual), encontrado: true };
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
    const results = await Promise.all(list.map((im) => carregarImovelCadastro({ imovelId: im.id })));
    const itens = results.map((r) => r.item).filter(Boolean);
    return { ok: true, itens };
  } catch (e) {
    return { ok: false, motivo: e?.message || 'Falha ao carregar dados para o relatório.', itens: [] };
  }
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

export async function carregarPainelAdministracaoImovel({ imovelId, codigoFallback, procFallback }) {
  let codigo = String(codigoFallback ?? '').trim();
  let proc = String(procFallback ?? '').trim();
  let imovel = null;

  if (featureFlags.useApiImoveis) {
    const r = await carregarImovelCadastro({ imovelId });
    imovel = r.item;
    if (imovel) {
      codigo = String(imovel.codigo || codigo).trim();
      proc = String(imovel.proc || proc).trim();
    }
  }

  const vinculoOk = codigo !== '' && proc !== '';
  const painelFinanceiro = vinculoOk ? montarPainelAdministracaoImovel(codigo, proc) : null;

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
