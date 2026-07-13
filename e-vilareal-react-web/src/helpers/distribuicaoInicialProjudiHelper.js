import { buscarCliente } from '../api/clientesService.js';
import { poloEhAutorProcesso, poloEhReuProcesso } from './documentoHelper.js';
import { listarPartesProcesso } from '../repositories/processosRepository.js';

function primeiraPessoaIdEntradas(entradas) {
  for (const e of entradas || []) {
    const id = Number(e?.pessoaId);
    if (Number.isFinite(id) && id > 0) return id;
  }
  return null;
}

function idsUnicosOrdenados(ids) {
  const out = [];
  for (const bruto of ids || []) {
    const id = Number(bruto);
    if (Number.isFinite(id) && id > 0 && !out.includes(id)) {
      out.push(id);
    }
  }
  return out;
}

async function montarSnapshotPessoa(pessoaId, pessoasPorId, nomeFallback) {
  if (!Number.isFinite(Number(pessoaId)) || Number(pessoaId) < 1) return null;
  const id = Number(pessoaId);
  const cached = pessoasPorId?.get?.(id);
  if (cached?.id != null) {
    return {
      id,
      nome: String(cached.nome ?? nomeFallback ?? '').trim(),
      cpf: String(cached.cpf ?? '').trim(),
      telefone: String(cached.telefone ?? '').trim(),
    };
  }
  try {
    const p = await buscarCliente(id);
    if (p?.id != null) {
      return {
        id,
        nome: String(p.nome ?? nomeFallback ?? '').trim(),
        cpf: String(p.cpf ?? '').trim(),
        telefone: String(p.telefone ?? '').trim(),
      };
    }
  } catch {
    // fallback mínimo
  }
  return {
    id,
    nome: String(nomeFallback ?? '').trim(),
    cpf: '',
    telefone: '',
  };
}

/**
 * Monta snapshot para a tela Distribuir Inicial PROJUDI a partir do formulário Processos.
 * @param {object} ctx
 */
export async function montarDadosDistribuicaoInicialFromProcesso(ctx) {
  const papelUi = String(ctx.papelParte ?? 'requerente').toLowerCase();
  const valorCausa = String(ctx.valorCausa ?? '').trim();
  const textoParteCliente = String(ctx.textoParteCliente ?? ctx.parteCliente ?? '').trim();
  const textoParteOposta = String(ctx.textoParteOposta ?? ctx.parteOposta ?? '').trim();

  let pessoaIdAutor = null;
  let pessoaIdsReu = [];
  let nomeAutorFallback = '';
  const nomesReuFallback = [];

  if (ctx.processoApiId) {
    try {
      const partes = await listarPartesProcesso(ctx.processoApiId);
      const autores = (partes || []).filter((p) => poloEhAutorProcesso(p.polo));
      const reus = (partes || []).filter((p) => poloEhReuProcesso(p.polo));
      pessoaIdAutor = autores[0]?.pessoaId != null ? Number(autores[0].pessoaId) : null;
      pessoaIdsReu = idsUnicosOrdenados(reus.map((p) => p.pessoaId));
      nomeAutorFallback = autores.map((p) => p.nome).filter(Boolean).join(', ');
      for (const reu of reus) {
        if (reu?.nome) nomesReuFallback.push(String(reu.nome).trim());
      }
    } catch {
      // usa entradas do formulário
    }
  }

  const idCliente = primeiraPessoaIdEntradas(ctx.parteClienteEntradas);
  const idOposta = primeiraPessoaIdEntradas(ctx.parteOpostaEntradas);
  const clienteEhAutor = papelUi !== 'requerido';

  if (!pessoaIdAutor) {
    pessoaIdAutor = clienteEhAutor ? idCliente : idOposta;
    nomeAutorFallback = clienteEhAutor ? textoParteCliente : textoParteOposta;
  }
  if (pessoaIdsReu.length === 0) {
    const idReuFallback = clienteEhAutor ? idOposta : idCliente;
    if (idReuFallback) {
      pessoaIdsReu = [idReuFallback];
    }
    if (nomesReuFallback.length === 0) {
      nomesReuFallback.push(clienteEhAutor ? textoParteOposta : textoParteCliente);
    }
  }

  const pessoaAutor = await montarSnapshotPessoa(pessoaIdAutor, ctx.pessoasPorId, nomeAutorFallback);
  const pessoasReu = await Promise.all(
    pessoaIdsReu.map((id, idx) =>
      montarSnapshotPessoa(id, ctx.pessoasPorId, nomesReuFallback[idx] ?? nomesReuFallback[0] ?? ''),
    ),
  );

  const codigo = String(ctx.codigoCliente ?? '').trim();
  const proc = ctx.processo != null ? String(ctx.processo).trim() : '';
  const naturezaAcao = String(ctx.naturezaAcao ?? '').trim();

  return {
    valorCausa,
    idAssuntos: '',
    naturezaAcao: naturezaAcao || null,
    pessoaAutor,
    pessoasReu: pessoasReu.filter(Boolean),
    pessoaReu: pessoasReu[0] ?? null,
    codigoCliente: codigo || null,
    numeroInterno: proc || null,
    processoApiId: ctx.processoApiId ?? null,
    chaveProcesso: codigo && proc ? `${codigo}/${proc}` : null,
  };
}
