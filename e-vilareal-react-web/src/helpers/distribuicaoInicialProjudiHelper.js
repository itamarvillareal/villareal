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
  let pessoaIdReu = null;
  let nomeAutorFallback = '';
  let nomeReuFallback = '';

  if (ctx.processoApiId) {
    try {
      const partes = await listarPartesProcesso(ctx.processoApiId);
      const autores = (partes || []).filter((p) => poloEhAutorProcesso(p.polo));
      const reus = (partes || []).filter((p) => poloEhReuProcesso(p.polo));
      pessoaIdAutor = autores[0]?.pessoaId != null ? Number(autores[0].pessoaId) : null;
      pessoaIdReu = reus[0]?.pessoaId != null ? Number(reus[0].pessoaId) : null;
      nomeAutorFallback = autores.map((p) => p.nome).filter(Boolean).join(', ');
      nomeReuFallback = reus.map((p) => p.nome).filter(Boolean).join(', ');
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
  if (!pessoaIdReu) {
    pessoaIdReu = clienteEhAutor ? idOposta : idCliente;
    nomeReuFallback = clienteEhAutor ? textoParteOposta : textoParteCliente;
  }

  const [pessoaAutor, pessoaReu] = await Promise.all([
    montarSnapshotPessoa(pessoaIdAutor, ctx.pessoasPorId, nomeAutorFallback),
    montarSnapshotPessoa(pessoaIdReu, ctx.pessoasPorId, nomeReuFallback),
  ]);

  const codigo = String(ctx.codigoCliente ?? '').trim();
  const proc = ctx.processo != null ? String(ctx.processo).trim() : '';
  const naturezaAcao = String(ctx.naturezaAcao ?? '').trim();

  return {
    valorCausa,
    idAssuntos: '',
    naturezaAcao: naturezaAcao || null,
    pessoaAutor,
    pessoaReu,
    codigoCliente: codigo || null,
    numeroInterno: proc || null,
    processoApiId: ctx.processoApiId ?? null,
    chaveProcesso: codigo && proc ? `${codigo}/${proc}` : null,
  };
}
