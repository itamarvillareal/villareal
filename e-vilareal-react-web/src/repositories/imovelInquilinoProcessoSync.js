import { featureFlags } from '../config/featureFlags.js';
import {
  poloEhLadoEscritorio,
  poloJuridicoEscritorioEhAutor,
} from '../data/partesLadoEscritorio.js';
import {
  buscarProcessoPorId,
  listarPartesProcesso,
  sincronizarPartesIncremental,
} from './processosRepository.js';
import { request } from '../api/httpClient.js';
import {
  listarImoveisApi,
  resolverVinculoPrincipalProcessoImovel,
  selecionarContratoVigente,
} from './imoveisRepository.js';

function normQualificacao(q) {
  return String(q ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function ehParteClienteMarcada(p) {
  return normQualificacao(p?.qualificacao).includes('PARTE CLIENTE');
}

function ehParteOpostaMarcada(p) {
  return normQualificacao(p?.qualificacao).includes('PARTE OPOSTA');
}

function resolverPolosProcesso(papelParte) {
  const papel = String(papelParte ?? 'requerente').trim().toLowerCase();
  const poloCliente = papel === 'requerido' ? 'REU' : 'AUTOR';
  const poloOposta = papel === 'requerido' ? 'AUTOR' : 'REU';
  const qualCliente = papel === 'requerido' ? 'Parte cliente (requerido)' : 'Parte cliente';
  const qualOposta = papel === 'requerido' ? 'Parte oposta (requerente)' : 'Parte oposta';
  return { poloCliente, poloOposta, qualCliente, qualOposta };
}

/** Extrai entradas com pessoaId da parte oposta do processo. */
export function entradasParteOpostaFromPartesApi(partes, papelParte = 'requerente') {
  const lista = Array.isArray(partes) ? partes : [];
  const porQual = lista.filter((p) => {
    const id = Number(p?.pessoaId);
    return ehParteOpostaMarcada(p) && Number.isFinite(id) && id > 0;
  });
  if (porQual.length) {
    return porQual.map((p) => ({
      pessoaId: String(p.pessoaId),
      nome: String(p.nomeExibicao ?? p.nomeLivre ?? '').trim(),
    }));
  }
  const poloAutor = poloJuridicoEscritorioEhAutor(papelParte, lista);
  return lista
    .filter((p) => {
      const id = Number(p?.pessoaId);
      return !poloEhLadoEscritorio(p?.polo, poloAutor) && Number.isFinite(id) && id > 0;
    })
    .map((p) => ({
      pessoaId: String(p.pessoaId),
      nome: String(p.nomeExibicao ?? p.nomeLivre ?? '').trim(),
    }));
}

export function inquilinosUiFromEntradas(entradas) {
  const vistos = new Set();
  const out = [];
  for (const e of Array.isArray(entradas) ? entradas : []) {
    const id = String(e?.pessoaId ?? '').trim();
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    out.push({
      pessoaId: id,
      nome: String(e?.nome ?? '').trim(),
      cpf: String(e?.cpf ?? '').trim(),
      contato: String(e?.contato ?? '').trim(),
    });
  }
  return out;
}

export function mesclarInquilinosUi(contratoLista, processoLista) {
  const map = new Map();
  for (const f of [...(contratoLista || []), ...(processoLista || [])]) {
    const id = String(f?.pessoaId ?? '').trim();
    if (!id) continue;
    const prev = map.get(id) ?? {};
    map.set(id, {
      pessoaId: id,
      nome: String(f?.nome ?? prev.nome ?? '').trim(),
      cpf: String(f?.cpf ?? prev.cpf ?? '').trim(),
      contato: String(f?.contato ?? prev.contato ?? '').trim(),
    });
  }
  return [...map.values()];
}

export function derivarCamposLegadoInquilino(inquilinos) {
  const lista = Array.isArray(inquilinos) ? inquilinos : [];
  const primeiro = lista[0];
  const nomes = lista.map((i) => String(i?.nome ?? '').trim()).filter(Boolean);
  return {
    inquilinoNumeroPessoa: String(primeiro?.pessoaId ?? '').trim(),
    inquilino: nomes.length <= 1 ? nomes[0] ?? '' : nomes.join(', '),
    inquilinoCpf: String(primeiro?.cpf ?? '').trim(),
    inquilinoContato: String(primeiro?.contato ?? '').trim(),
  };
}

function padCliente8(value) {
  const s = String(value ?? '').replace(/\D/g, '');
  return s.padStart(8, '0').slice(-8);
}

function payloadContratoPreservandoCampos(contrato, imovelIdApi, ids) {
  return {
    imovelId: imovelIdApi,
    locadorPessoaId: contrato.locadorPessoaId ?? null,
    inquilinoPessoaId: ids[0] ?? null,
    inquilinosPessoaIds: ids,
    dataInicio: contrato.dataInicio ?? null,
    dataFim: contrato.dataFim ?? null,
    valorAluguel: contrato.valorAluguel ?? null,
    valorRepassePactuado: contrato.valorRepassePactuado ?? null,
    diaVencimentoAluguel: contrato.diaVencimentoAluguel ?? null,
    diaRepasse: contrato.diaRepasse ?? null,
    taxaAdministracaoPercent: contrato.taxaAdministracaoPercent ?? null,
    garantiaTipo: contrato.garantiaTipo ?? null,
    valorGarantia: contrato.valorGarantia ?? null,
    dadosBancariosRepasseJson: contrato.dadosBancariosRepasseJson ?? null,
    fiadoresPessoaIds: Array.isArray(contrato.fiadoresPessoaIds) ? contrato.fiadoresPessoaIds : null,
    observacoes: contrato.observacoes ?? null,
    status: contrato.status ?? 'VIGENTE',
  };
}

async function resolverProcessoIdDoImovel(uiItem) {
  const vinculo = await resolverVinculoPrincipalProcessoImovel(uiItem);
  if (vinculo?.processoId) return Number(vinculo.processoId);
  const id = Number(uiItem?._apiProcessoId);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function carregarInquilinosMescladosComProcesso(uiItem) {
  const base = inquilinosUiFromEntradas(uiItem?.inquilinos);
  if (!featureFlags.useApiProcessos) return base;
  const processoId = await resolverProcessoIdDoImovel(uiItem);
  if (!processoId) return base;
  try {
    const proc = await buscarProcessoPorId(processoId);
    const partes = await listarPartesProcesso(processoId);
    const papel = String(proc?.papelCliente ?? 'requerente').toLowerCase();
    const doProcesso = inquilinosUiFromEntradas(entradasParteOpostaFromPartesApi(partes, papel));
    return mesclarInquilinosUi(base, doProcesso);
  } catch {
    return base;
  }
}

export async function sincronizarInquilinosImovelParaProcesso(uiItem, inquilinos) {
  if (!featureFlags.useApiProcessos || !featureFlags.useApiImoveis) return { ok: false };
  const processoId = await resolverProcessoIdDoImovel(uiItem);
  if (!processoId) return { ok: false, motivo: 'Imóvel sem processo vinculado.' };

  const proc = await buscarProcessoPorId(processoId);
  const partes = await listarPartesProcesso(processoId);
  const papel = String(proc?.papelCliente ?? 'requerente').toLowerCase();
  const { poloCliente, poloOposta, qualCliente, qualOposta } = resolverPolosProcesso(papel);

  const linhasCliente = (partes || []).filter(ehParteClienteMarcada);
  const linhasOpostaInquilinos = inquilinosUiFromEntradas(inquilinos).map((row, ordem) => ({
    pessoaId: Number(row.pessoaId),
    nomeLivre: null,
    polo: poloOposta,
    qualificacao: qualOposta,
    ordem,
    advogadoPessoaIds: [],
  }));

  const payload = [
    ...linhasCliente.map((p, ordem) => ({
      pessoaId: p.pessoaId != null ? Number(p.pessoaId) : null,
      nomeLivre: p.pessoaId != null ? null : p.nomeLivre ?? p.nomeExibicao ?? null,
      polo: poloCliente,
      qualificacao: qualCliente,
      ordem,
      advogadoPessoaIds: [],
    })),
    ...linhasOpostaInquilinos,
  ];

  await sincronizarPartesIncremental(processoId, payload);
  return { ok: true, processoId };
}

export async function resolverImovelIdApiPorProcesso(processoId) {
  const pid = Number(processoId);
  if (!Number.isFinite(pid) || pid < 1) return null;
  if (!featureFlags.useApiImoveis) return null;
  try {
    const list = await listarImoveisApi();
    const hit = (list || []).find((im) => Number(im.processoId) === pid);
    if (hit?.id != null) return Number(hit.id);
  } catch {
    /* tenta fallback abaixo */
  }
  if (!featureFlags.useApiProcessos) return null;
  try {
    const proc = await buscarProcessoPorId(pid);
    const codigo = proc?.codigoCliente;
    const ni = proc?.numeroInterno ?? proc?.numeroInternoProcesso;
    if (!codigo || ni == null) return null;
    const r = await request('/api/imoveis/numero-por-vinculo', {
      query: { codigoCliente: padCliente8(codigo), numeroInterno: ni },
    });
    const np = Number(r?.numeroPlanilha);
    if (!Number.isFinite(np) || np < 1) return null;
    try {
      const list = await listarImoveisApi();
      const hit = (list || []).find((im) => Number(im.numeroPlanilha) === np);
      if (hit?.id != null) return Number(hit.id);
    } catch {
      /* continua */
    }
    const im = await request(`/api/imoveis/por-numero-planilha/${np}`);
    return im?.id != null ? Number(im.id) : null;
  } catch {
    return null;
  }
}

/** Processo → imóvel: grava inquilinos no contrato vigente do imóvel vinculado. */
export async function sincronizarParteOpostaProcessoParaInquilinosImovel(processoId, entradasOposta) {
  if (!featureFlags.useApiImoveis) return { ok: false };
  const imovelIdApi = await resolverImovelIdApiPorProcesso(processoId);
  if (!imovelIdApi) return { ok: false, motivo: 'Nenhum imóvel vinculado ao processo.' };

  const inquilinos = inquilinosUiFromEntradas(entradasOposta);
  const ids = inquilinos
    .map((i) => Number(i.pessoaId))
    .filter((id) => Number.isFinite(id) && id > 0);

  const contratos = await request('/api/locacoes/contratos', { query: { imovelId: imovelIdApi } });
  const contrato = selecionarContratoVigente(Array.isArray(contratos) ? contratos : []);
  if (!contrato?.id) return { ok: false, motivo: 'Imóvel sem contrato de locação.' };

  await request(`/api/locacoes/contratos/${contrato.id}`, {
    method: 'PUT',
    body: payloadContratoPreservandoCampos(contrato, imovelIdApi, ids),
  });

  return { ok: true, imovelIdApi, inquilinosPessoaIds: ids };
}
