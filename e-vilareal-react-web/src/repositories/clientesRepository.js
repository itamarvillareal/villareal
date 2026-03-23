import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  loadCadastroClienteDados,
  saveCadastroClienteDados,
  padCliente8Cadastro,
} from '../data/cadastroClientesStorage.js';

function mapApiToFront(c) {
  return {
    id: c.id,
    codigo: padCliente8Cadastro(c.codigoCliente),
    pessoa: c.pessoaId != null ? String(c.pessoaId) : '',
    nomeRazao: c.nomeReferencia ?? '',
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
  const lista = await listarClientesCadastro();
  return lista.find((c) => c.codigo === padCliente8Cadastro(codigo)) || null;
}

export async function salvarClienteCadastro(dados) {
  if (!featureFlags.useApiClientes) {
    saveCadastroClienteDados(dados.codigo, dados);
    return loadCadastroClienteDados(dados.codigo);
  }
  const atual = await obterClienteCadastroPorCodigo(dados.codigo);
  if (atual?.id) {
    const updated = await request(`/api/clientes/${atual.id}`, {
      method: 'PUT',
      body: mapFrontToApi(dados),
    });
    return mapApiToFront(updated);
  }
  const created = await request('/api/clientes', {
    method: 'POST',
    body: mapFrontToApi(dados),
  });
  return mapApiToFront(created);
}
