import { featureFlags } from '../config/featureFlags.js';
import { padCliente } from '../data/processosDadosRelatorio.js';
import { request } from '../api/httpClient.js';

function padCliente8(value) {
  return padCliente(value);
}

/** Campos de locatário/contrato versionados por par Cod.+Proc. */
export const CHAVES_EXTRAS_VINCULO_LOCATARIO = [
  'observacoesInquilino',
  'obsInquilino',
  'dataPag1TxCond',
  'dataPagamento1TxCondominial',
  'valorGarantia',
  'linkVistoria',
  'inquilino',
  'inquilinoCpf',
  'inquilinoContato',
  'inquilinoPessoaId',
  'inquilinoNumeroPessoa',
  'inquilinos',
  'contratoAssinadoInquilino',
  'contratoAssinadoProprietario',
  'contratoAssinadoGarantidor',
  'contratoAssinadoTestemunhas',
  'contratoArquivado',
  'contratoIntermediacaoArquivado',
  'contratoIntermediacaoAssinadoProprietario',
];

export function extrairExtrasVinculoLocatarioJsonDoUi(ui, extrasOrig = {}) {
  const orig = extrasOrig && typeof extrasOrig === 'object' ? extrasOrig : {};
  const out = {};
  for (const chave of CHAVES_EXTRAS_VINCULO_LOCATARIO) {
    if (Object.prototype.hasOwnProperty.call(orig, chave)) {
      out[chave] = orig[chave];
    }
  }
  if (ui) {
    out.observacoesInquilino = String(ui.observacoesInquilino ?? out.observacoesInquilino ?? '');
    out.dataPag1TxCond = String(ui.dataPag1TxCond ?? out.dataPag1TxCond ?? '');
    out.valorGarantia = String(ui.valorGarantia ?? out.valorGarantia ?? '');
    out.linkVistoria = String(ui.linkVistoria ?? out.linkVistoria ?? '');
    out.inquilino = String(ui.inquilino ?? out.inquilino ?? '');
    out.inquilinoCpf = String(ui.inquilinoCpf ?? out.inquilinoCpf ?? '');
    out.inquilinoContato = String(ui.inquilinoContato ?? out.inquilinoContato ?? '');
    out.contratoAssinadoInquilino = String(ui.contratoAssinadoInquilino ?? out.contratoAssinadoInquilino ?? 'nao');
    out.contratoAssinadoProprietario = String(
      ui.contratoAssinadoProprietario ?? out.contratoAssinadoProprietario ?? 'nao',
    );
    out.contratoAssinadoGarantidor = String(ui.contratoAssinadoGarantidor ?? out.contratoAssinadoGarantidor ?? 'nao');
    out.contratoAssinadoTestemunhas = String(
      ui.contratoAssinadoTestemunhas ?? out.contratoAssinadoTestemunhas ?? 'nao',
    );
    out.contratoArquivado = String(ui.contratoArquivado ?? out.contratoArquivado ?? 'nao');
    out.contratoIntermediacaoArquivado = String(
      ui.contratoIntermediacaoArquivado ?? out.contratoIntermediacaoArquivado ?? 'nao',
    );
    out.contratoIntermediacaoAssinadoProprietario = String(
      ui.contratoIntermediacaoAssinadoProprietario ?? out.contratoIntermediacaoAssinadoProprietario ?? 'nao',
    );
    const idInq = String(ui.inquilinoNumeroPessoa ?? '').trim();
    if (idInq) out.inquilinoPessoaId = idInq;
    if (Array.isArray(ui.inquilinos) && ui.inquilinos.length) {
      out.inquilinos = ui.inquilinos;
    }
  }
  return JSON.stringify(out);
}

export function removerExtrasVinculoLocatarioDoObjeto(extras) {
  if (!extras || typeof extras !== 'object') return extras ?? {};
  const out = { ...extras };
  for (const chave of CHAVES_EXTRAS_VINCULO_LOCATARIO) {
    delete out[chave];
  }
  return out;
}

/** Mescla snapshot do vínculo sobre o item de formulário (locatário/contrato). */
export function mesclarExtrasVinculoLocatarioNoItem(item, extrasRaw, normalizarExtras) {
  if (!item || !extrasRaw) return item;
  const norm = normalizarExtras ? normalizarExtras(extrasRaw) : extrasRaw;
  const merged = { ...item, ...norm };
  if (Array.isArray(extrasRaw.inquilinos)) {
    merged.inquilinos = extrasRaw.inquilinos;
  }
  if (norm.inquilinoPessoaId != null && String(norm.inquilinoPessoaId).trim()) {
    merged.inquilinoNumeroPessoa = String(norm.inquilinoPessoaId).trim();
  }
  return merged;
}

/** Garante que campos versionados por Cod.+Proc. reflitam o que acabou de ser salvo no formulário. */
export function mesclarCamposVinculoLocatarioDoUiNoItem(item, ui) {
  if (!item || !ui) return item;
  const merged = { ...item };
  for (const chave of CHAVES_EXTRAS_VINCULO_LOCATARIO) {
    if (!Object.prototype.hasOwnProperty.call(ui, chave)) continue;
    if (chave === 'inquilinos') {
      if (Array.isArray(ui.inquilinos)) merged.inquilinos = ui.inquilinos;
      continue;
    }
    if (chave === 'inquilinoPessoaId' || chave === 'inquilinoNumeroPessoa') {
      const id = String(ui.inquilinoNumeroPessoa ?? ui.inquilinoPessoaId ?? '').trim();
      if (id) merged.inquilinoNumeroPessoa = id;
      continue;
    }
    merged[chave] = ui[chave];
  }
  if (Object.prototype.hasOwnProperty.call(ui, 'observacoesInquilino')) {
    merged.observacoesInquilino = ui.observacoesInquilino;
  }
  return merged;
}

export async function carregarVinculoLocatarioImovel({ numeroPlanilha, codigoCliente, numeroInterno }) {
  if (!featureFlags.useApiImoveis) return null;
  const np = Number(numeroPlanilha);
  const cod = padCliente8(codigoCliente);
  const proc = Number(numeroInterno);
  if (!Number.isFinite(np) || np < 1 || !cod || !Number.isFinite(proc) || proc < 1) return null;
  try {
    return await request(`/api/imoveis/por-numero-planilha/${Math.floor(np)}/vinculo-locatario`, {
      query: { codigoCliente: cod, numeroInterno: Math.floor(proc) },
    });
  } catch {
    return null;
  }
}

export async function salvarVinculoLocatarioImovel({
  numeroPlanilha,
  codigoCliente,
  numeroInterno,
  processoId,
  camposExtrasJson,
}) {
  if (!featureFlags.useApiImoveis) return null;
  const np = Number(numeroPlanilha);
  const cod = padCliente8(codigoCliente);
  const proc = Number(numeroInterno);
  if (!Number.isFinite(np) || np < 1 || !cod || !Number.isFinite(proc) || proc < 1) return null;
  const body = {
    codigoCliente: cod,
    numeroInterno: Math.floor(proc),
    camposExtrasJson: camposExtrasJson ?? '{}',
  };
  if (processoId != null && Number(processoId) > 0) {
    body.processoId = Number(processoId);
  }
  return request(`/api/imoveis/por-numero-planilha/${Math.floor(np)}/vinculo-locatario`, {
    method: 'PUT',
    body,
  });
}

export function usuarioAlterouVinculoProcessoNoFormulario(uiPayload) {
  const codForm = String(uiPayload?.codigo ?? '').trim();
  const procForm = String(uiPayload?.proc ?? '').trim().replace(/^0+/, '') || String(uiPayload?.proc ?? '').trim();
  const codOrig = String(uiPayload?._vinculoCodigoOriginal ?? uiPayload?.codigo ?? '').trim();
  const procOrig =
    String(uiPayload?._vinculoProcOriginal ?? uiPayload?.proc ?? '')
      .trim()
      .replace(/^0+/, '') || String(uiPayload?._vinculoProcOriginal ?? uiPayload?.proc ?? '').trim();
  return padCliente8(codForm) !== padCliente8(codOrig) || procForm !== procOrig;
}

export async function resolverProcessoIdParaVinculoUi(item, resolverProcessoIdPorChave) {
  if (item?._apiProcessoId != null && Number(item._apiProcessoId) > 0) {
    return Number(item._apiProcessoId);
  }
  const cod = padCliente8(item?.codigo);
  const proc = String(item?.proc ?? '').trim();
  if (!cod || !proc || typeof resolverProcessoIdPorChave !== 'function') return null;
  try {
    return await resolverProcessoIdPorChave(cod, proc);
  } catch {
    return null;
  }
}
