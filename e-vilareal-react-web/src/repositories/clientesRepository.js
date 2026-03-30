import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  loadCadastroClienteDados,
  saveCadastroClienteDados,
  padCliente8Cadastro,
} from '../data/cadastroClientesStorage.js';

function mapApiToFront(c) {
  const pessoaIdStr =
    c.pessoaId != null ? String(c.pessoaId) : c.id != null ? String(c.id) : '';
  return {
    id: c.id,
    codigo: padCliente8Cadastro(c.codigoCliente),
    pessoa: pessoaIdStr,
    nomeRazao: c.nomeReferencia ?? c.nome ?? '',
    cnpjCpf: c.documentoReferencia ?? '',
    observacao: c.observacao ?? '',
    clienteInativo: c.inativo === true,
  };
}

function mapFrontToApi(d) {
  return {
    codigoCliente: padCliente8Cadastro(d.codigo),
    pessoaId: d.pessoa ? Number(String(d.pessoa).replace(/\D/g, '')) || null : null,
    nomeReferencia: String(d.nomeRazao ?? '').trim(),
    documentoReferencia: String(d.cnpjCpf ?? '').replace(/\D/g, '').slice(0, 20) || null,
    observacao: String(d.observacao ?? ''),
    inativo: d.clienteInativo === true,
  };
}

export async function listarClientesCadastro() {
  if (!featureFlags.useApiClientes) return [];
  const data = await request('/api/clientes');
  return Array.isArray(data) ? data.map(mapApiToFront) : [];
}

export async function obterClienteCadastroPorCodigo(codigo) {
  if (!featureFlags.useApiClientes) return null;
  const cod = padCliente8Cadastro(codigo);
  const lista = await listarClientesCadastro();
  const found = lista.find((c) => c.codigo === cod);
  if (found) return found;
  return resolverClienteCadastroPorCodigo(cod);
}

/**
 * Resolve um código (8 dígitos) para pessoa/nome quando não está na lista compacta ou ao navegar setas.
 * Com planilha importada, 404 se não houver linha — nunca assume cliente N = pessoa N.
 */
export async function resolverClienteCadastroPorCodigo(codigo) {
  if (!featureFlags.useApiClientes) return null;
  const cod = padCliente8Cadastro(codigo);
  try {
    const data = await request('/api/clientes/resolucao', { query: { codigoCliente: cod } });
    return data ? mapApiToFront(data) : null;
  } catch {
    return null;
  }
}

function emitCadastroClientesAtualizado() {
  try {
    window.dispatchEvent(new CustomEvent('vilareal:cadastro-clientes-externo-atualizado'));
  } catch {
    /* ignore */
  }
}

export async function salvarClienteCadastro(dados) {
  if (!featureFlags.useApiClientes) {
    saveCadastroClienteDados(dados.codigo, dados);
    emitCadastroClientesAtualizado();
    return loadCadastroClienteDados(dados.codigo);
  }
  const atual = await obterClienteCadastroPorCodigo(dados.codigo);
  if (atual?.id) {
    const updated = await request(`/api/clientes/${atual.id}`, {
      method: 'PUT',
      body: mapFrontToApi(dados),
    });
    emitCadastroClientesAtualizado();
    return mapApiToFront(updated);
  }
  const created = await request('/api/clientes', {
    method: 'POST',
    body: mapFrontToApi(dados),
  });
  emitCadastroClientesAtualizado();
  return mapApiToFront(created);
}
