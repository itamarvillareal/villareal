import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';

function instantApiParaIso(v) {
  if (v == null) return new Date().toISOString();
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length >= 1) {
    const sec = Number(v[0]);
    if (Number.isFinite(sec)) return new Date(sec * 1000).toISOString();
  }
  return new Date().toISOString();
}

export function enderecosApiParaUi(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((e) => ({
    id: e.id != null ? Number(e.id) : null,
    numero: e.numero,
    rua: e.rua ?? '',
    bairro: e.bairro ?? '',
    estado: e.estado ?? e.municipio?.uf ?? '',
    cidade: e.cidade ?? e.municipio?.nome ?? '',
    municipioId: e.municipioId ?? e.municipio?.id ?? null,
    municipio: e.municipio ?? null,
    cidadeLegado: e.cidadeLegado ?? null,
    cep: e.cep != null ? String(e.cep) : '',
    autoPreenchido: Boolean(e.autoPreenchido),
    origem: e.origem ?? null,
    dataOrigem: e.dataOrigem ?? null,
  }));
}

export function enderecosUiParaApi(items) {
  const list = Array.isArray(items) ? items : [];
  return list
    .map((e, idx) => {
      const rua = String(e.rua ?? '').trim();
      if (!rua) return null;
      const n = Number(e.numero);
      const numero = Number.isFinite(n) && n >= 1 ? Math.floor(n) : idx + 1;
      const municipioId = Number(e.municipioId);
      if (!Number.isFinite(municipioId) || municipioId <= 0) return null;
      const cepDigits = String(e.cep ?? '').replace(/\D/g, '').slice(0, 8);
      const item = {
        numero,
        rua,
        bairro: String(e.bairro ?? '').trim() || null,
        municipioId: Math.floor(municipioId),
        cep: cepDigits || null,
        autoPreenchido: Boolean(e.autoPreenchido),
      };
      const idPersist = Number(e.id);
      if (Number.isFinite(idPersist) && idPersist > 0) {
        item.id = Math.floor(idPersist);
      }
      return item;
    })
    .filter(Boolean);
}

export function contatosApiParaUi(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((c) => ({
    tipo: c.tipo ?? 'email',
    valor: c.valor ?? '',
    dataLancamento: instantApiParaIso(c.dataLancamento),
    dataAlteracao: instantApiParaIso(c.dataAlteracao),
    usuario: c.usuario != null && String(c.usuario).trim() ? String(c.usuario).trim() : 'Usuário',
  }));
}

export function contatosUiParaApi(items, usuarioFallback) {
  const fallback = String(usuarioFallback ?? 'Usuário').trim() || 'Usuário';
  const now = new Date().toISOString();
  return (Array.isArray(items) ? items : [])
    .map((c) => {
      const tipo = String(c.tipo ?? 'email').toLowerCase();
      if (!/^(email|telefone|website)$/.test(tipo)) return null;
      const valor = String(c.valor ?? '').trim();
      if (!valor) return null;
      return {
        tipo,
        valor,
        dataLancamento: c.dataLancamento || now,
        dataAlteracao: c.dataAlteracao || now,
        usuario: String(c.usuario ?? fallback).trim() || fallback,
      };
    })
    .filter(Boolean);
}

export async function carregarEnderecosPessoa(pessoaId) {
  if (!featureFlags.useApiPessoasComplementares) return null;
  const id = Number(pessoaId);
  if (!Number.isFinite(id) || id < 1) return null;
  try {
    const data = await request(`/api/pessoas/${id}/enderecos`);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (String(err?.message || '').includes('404')) return [];
    throw err;
  }
}

export async function carregarContatosPessoa(pessoaId) {
  if (!featureFlags.useApiPessoasComplementares) return null;
  const id = Number(pessoaId);
  if (!Number.isFinite(id) || id < 1) return null;
  try {
    const data = await request(`/api/pessoas/${id}/contatos`);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (String(err?.message || '').includes('404')) return [];
    throw err;
  }
}

export async function salvarEnderecosPessoa(pessoaId, itemsUi) {
  if (!featureFlags.useApiPessoasComplementares) return null;
  const id = Number(pessoaId);
  if (!Number.isFinite(id) || id < 1) return null;
  const list = Array.isArray(itemsUi) ? itemsUi : [];
  const body = enderecosUiParaApi(itemsUi);
  const comRua = list.filter((e) => String(e?.rua ?? '').trim());
  if (comRua.length > 0 && body.length === 0) {
    throw new Error('Informe o município (busque e selecione na lista) em todos os endereços.');
  }
  if (comRua.length > body.length) {
    throw new Error('Um ou mais endereços estão sem município válido selecionado.');
  }
  const resp = await request(`/api/pessoas/${id}/enderecos`, {
    method: 'PUT',
    body,
  });
  if (resp && typeof resp === 'object' && Array.isArray(resp.enderecos)) {
    return {
      enderecos: resp.enderecos,
      avisos: Array.isArray(resp.avisos) ? resp.avisos : [],
    };
  }
  return {
    enderecos: Array.isArray(resp) ? resp : [],
    avisos: [],
  };
}

export async function incluirEnderecosLotePessoa(pessoaId, payload) {
  if (!featureFlags.useApiPessoasComplementares) return null;
  const id = Number(pessoaId);
  if (!Number.isFinite(id) || id < 1) return null;
  return request(`/api/pessoas/${id}/enderecos/lote`, {
    method: 'POST',
    body: payload,
  });
}

export async function salvarContatosPessoa(pessoaId, itemsUi, usuarioDefault) {
  if (!featureFlags.useApiPessoasComplementares) return null;
  const id = Number(pessoaId);
  if (!Number.isFinite(id) || id < 1) return null;
  const body = contatosUiParaApi(itemsUi, usuarioDefault);
  return request(`/api/pessoas/${id}/contatos`, {
    method: 'PUT',
    body,
  });
}
