import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';
import { loadClienteWhatsAppLocal, saveClienteWhatsAppLocal } from '../data/clienteWhatsAppStorage.js';
import { padCliente8Cadastro } from '../data/cadastroClientesStorage.js';
import { carregarContatosPessoa } from './pessoasEnderecosContatosRepository.js';
import { normalizePhoneForApi } from '../utils/whatsappFormat.js';

export function whatsappApiParaUi(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((w) => ({
    id: w.id ?? null,
    numero: w.numero ?? '',
    nomeLabel: w.nomeLabel ?? '',
    principal: w.principal === true,
    preenchidoAutomaticamente: w.preenchidoAutomaticamente === true,
    ativo: w.ativo !== false,
    pessoaId: w.pessoaId ?? null,
    pessoaContatoId: w.pessoaContatoId ?? null,
  }));
}

export function whatsappUiParaApi(itens) {
  return (Array.isArray(itens) ? itens : [])
    .map((w) => {
      const numero = normalizePhoneForApi(w.numero);
      if (!numero) return null;
      return {
        id: w.id ?? undefined,
        numero,
        nomeLabel: String(w.nomeLabel ?? '').trim() || null,
        principal: w.principal === true,
        preenchidoAutomaticamente: w.preenchidoAutomaticamente === true,
        ativo: w.ativo !== false,
        pessoaId: w.pessoaId ?? undefined,
        pessoaContatoId: w.pessoaContatoId ?? undefined,
      };
    })
    .filter(Boolean);
}

export async function listarClienteWhatsApp(clienteId, codigoClienteFallback) {
  const cod = padCliente8Cadastro(codigoClienteFallback ?? '');
  const id = Number(clienteId);
  if (featureFlags.useApiClientes && Number.isFinite(id) && id >= 1) {
    try {
      const data = await request(`/api/clientes/${id}/whatsapp`);
      return whatsappApiParaUi(data);
    } catch (err) {
      if (!String(err?.message || '').includes('404')) throw err;
    }
  }
  return loadClienteWhatsAppLocal(cod);
}

export async function salvarClienteWhatsApp(clienteId, codigoCliente, itensUi) {
  const cod = padCliente8Cadastro(codigoCliente ?? '');
  const id = Number(clienteId);
  if (featureFlags.useApiClientes && Number.isFinite(id) && id >= 1) {
    const body = whatsappUiParaApi(itensUi);
    const data = await request(`/api/clientes/${id}/whatsapp`, { method: 'PUT', body });
    return whatsappApiParaUi(data);
  }
  const local = (Array.isArray(itensUi) ? itensUi : []).map((w) => ({
    ...w,
    numero: normalizePhoneForApi(w.numero) || w.numero,
  }));
  saveClienteWhatsAppLocal(cod, local);
  return local;
}

export async function importarWhatsAppDaPessoa(clienteId, pessoaId, codigoCliente) {
  const id = Number(clienteId);
  const pid = Number(pessoaId);
  if (featureFlags.useApiClientes && Number.isFinite(id) && id >= 1 && Number.isFinite(pid) && pid >= 1) {
    const data = await request(`/api/clientes/${id}/whatsapp/importar-pessoa`, {
      method: 'POST',
      query: { pessoaId: pid },
    });
    return whatsappApiParaUi(data);
  }
  return importarWhatsAppDaPessoaLocal(pid, codigoCliente);
}

/** Fallback sem API: copia telefones de contatos da pessoa para localStorage. */
async function importarWhatsAppDaPessoaLocal(pessoaId, codigoCliente) {
  const cod = padCliente8Cadastro(codigoCliente ?? '');
  const existentes = loadClienteWhatsAppLocal(cod);
  const contatos = (await carregarContatosPessoa(pessoaId)) ?? [];
  const telefones = contatos.filter((c) => c.tipo === 'telefone' && String(c.valor ?? '').trim());
  const numerosVistos = new Set(existentes.map((e) => normalizePhoneForApi(e.numero)).filter(Boolean));
  const novos = [...existentes];
  let temPrincipal = novos.some((n) => n.principal);

  for (const t of telefones) {
    const numero = normalizePhoneForApi(t.valor);
    if (!numero || numerosVistos.has(numero)) continue;
    numerosVistos.add(numero);
    novos.push({
      numero,
      nomeLabel: 'WhatsApp — Pessoa',
      principal: !temPrincipal && novos.length === 0,
      preenchidoAutomaticamente: true,
      ativo: true,
      pessoaId: pid,
    });
    if (!temPrincipal && novos[novos.length - 1].principal) temPrincipal = true;
  }

  saveClienteWhatsAppLocal(cod, novos);
  return novos;
}
