import { normalizarTextoBusca } from '../components/CadastroClientes.jsx';
import { featureFlags } from '../config/featureFlags.js';
import {
  extrairChavesCandidatasCnjDoTextoAgenda,
  extrairPartesClienteOpostaDoTextoCompromisso,
  encontrarProcessosHistoricoPorTextoAgenda,
} from '../domain/cnjAgendaResolucao.js';
import { padCliente } from './processosDadosRelatorio.js';
import { listarRegistrosProcessosHistoricoNormalizados } from './processosHistoricoData.js';
import { listarClientesIndiceCadastro } from '../repositories/clientesRepository.js';
import {
  listarProcessosPorCodigoCliente,
  listarProcessosPorNumeroProcessoDiagnostico,
} from '../repositories/processosRepository.js';

function chavePar(codCliente, proc) {
  const cod = padCliente(codCliente);
  const p = Math.floor(Number(proc));
  if (!cod || !Number.isFinite(p) || p < 1) return '';
  return `${cod}|${p}`;
}

function nomesCorrespondem(a, b) {
  const na = normalizarTextoBusca(a);
  const nb = normalizarTextoBusca(b);
  if (!na || !nb || na.length < 4 || nb.length < 4) return false;
  if (na === nb) return true;
  const menor = na.length <= nb.length ? na : nb;
  const maior = na.length <= nb.length ? nb : na;
  return maior.includes(menor) && menor.length >= Math.min(12, maior.length * 0.55);
}

function processoCorrespondePartes(row, parteA, parteB, nomeCliente) {
  const cliente = String(row.parteCliente ?? row.cliente ?? nomeCliente ?? '').trim();
  const oposta = String(row.parteOposta ?? '').trim();
  const autor = String(row.autor ?? '').trim();
  const reu = String(row.reu ?? row.parteOposta ?? '').trim();

  const blocos = [cliente, oposta, autor, reu].filter(Boolean);
  const hitAB =
    (nomesCorrespondem(cliente, parteA) || nomesCorrespondem(autor, parteA)) &&
    (nomesCorrespondem(oposta, parteB) || nomesCorrespondem(reu, parteB));
  const hitBA =
    (nomesCorrespondem(cliente, parteB) || nomesCorrespondem(autor, parteB)) &&
    (nomesCorrespondem(oposta, parteA) || nomesCorrespondem(reu, parteA));

  if (hitAB || hitBA) return true;

  const texto = blocos.join(' ');
  const t = normalizarTextoBusca(texto);
  const pa = normalizarTextoBusca(parteA);
  const pb = normalizarTextoBusca(parteB);
  return t.includes(pa) && t.includes(pb);
}

function mapDiagnosticoParaChave(row) {
  const proc = Number(row.proc ?? row.numeroInterno);
  if (!Number.isFinite(proc) || proc < 1) return null;
  return {
    codCliente: padCliente(row.codCliente),
    proc: Math.floor(proc),
    parteCliente: row.parteCliente,
    parteOposta: row.parteOposta,
    numeroProcessoNovo: row.numeroProcessoNovo,
  };
}

/**
 * @param {string} texto
 * @returns {Promise<{ ok: true, codCliente: string, proc: number, metodo: 'cnj'|'partes', detalhe?: string } | { ok: false, motivo: string, matches?: object[] }>}
 */
async function buscarPorCnjApi(texto) {
  const candidatos = [...extrairChavesCandidatasCnjDoTextoAgenda(texto)].sort(
    (a, b) => b.length - a.length
  );
  if (!candidatos.length) return { ok: false, motivo: 'sem_numero_processo' };

  const vistos = new Set();
  /** @type {{ codCliente: string, proc: number, parteCliente?: string, parteOposta?: string, numeroProcessoNovo?: string }[]} */
  const matches = [];

  for (const cand of candidatos) {
    const rows = await listarProcessosPorNumeroProcessoDiagnostico(cand);
    for (const row of rows) {
      const m = mapDiagnosticoParaChave(row);
      if (!m) continue;
      const k = chavePar(m.codCliente, m.proc);
      if (!k || vistos.has(k)) continue;
      vistos.add(k);
      matches.push(m);
    }
  }

  if (matches.length === 1) {
    return { ok: true, ...matches[0], metodo: 'cnj', detalhe: matches[0].numeroProcessoNovo };
  }
  if (matches.length > 1) {
    return { ok: false, motivo: 'ambiguo_cnj', matches };
  }
  return { ok: false, motivo: 'cnj_nao_encontrado' };
}

function buscarPorCnjHistoricoLocal(texto) {
  const store = {};
  for (const reg of listarRegistrosProcessosHistoricoNormalizados()) {
    const k = `${reg.codCliente}:${reg.proc}`;
    store[k] = reg;
  }
  const lista = encontrarProcessosHistoricoPorTextoAgenda(texto, store);
  if (lista.length === 1) {
    return {
      ok: true,
      codCliente: lista[0].codCliente,
      proc: lista[0].proc,
      metodo: 'cnj',
      detalhe: lista[0].numeroProcessoNovo,
    };
  }
  if (lista.length > 1) {
    return {
      ok: false,
      motivo: 'ambiguo_cnj',
      matches: lista.map((x) => ({
        codCliente: x.codCliente,
        proc: x.proc,
        numeroProcessoNovo: x.numeroProcessoNovo,
      })),
    };
  }
  return { ok: false, motivo: 'cnj_nao_encontrado' };
}

async function buscarPorPartesApi(parteA, parteB) {
  const clientes = await listarClientesIndiceCadastro();
  const na = normalizarTextoBusca(parteA);
  const nb = normalizarTextoBusca(parteB);

  const candidatosCli = clientes.filter((c) => {
    const nome = normalizarTextoBusca(c.nomeRazao);
    return nome.includes(na) || nome.includes(nb) || na.includes(nome) || nb.includes(nome);
  });

  const limite = candidatosCli.slice(0, 12);
  const vistos = new Set();
  /** @type {{ codCliente: string, proc: number }[]} */
  const matches = [];

  for (const cli of limite) {
    const cod = padCliente(cli.codigo);
    let processos = [];
    try {
      processos = await listarProcessosPorCodigoCliente(cod);
    } catch {
      continue;
    }
    for (const p of processos) {
      const proc = Number(p.numeroInterno);
      if (!Number.isFinite(proc) || proc < 1) continue;
      const row = {
        codCliente: cod,
        proc,
        parteCliente: cli.nomeRazao,
        parteOposta: p.parteOposta,
        autor: cli.nomeRazao,
        reu: p.parteOposta,
        cliente: cli.nomeRazao,
      };
      if (!processoCorrespondePartes(row, parteA, parteB, cli.nomeRazao)) continue;
      const k = chavePar(cod, proc);
      if (!k || vistos.has(k)) continue;
      vistos.add(k);
      matches.push({ codCliente: cod, proc });
    }
  }

  if (matches.length === 1) return { ok: true, ...matches[0], metodo: 'partes' };
  if (matches.length > 1) return { ok: false, motivo: 'ambiguo_partes', matches };
  return { ok: false, motivo: 'partes_nao_encontradas' };
}

function buscarPorPartesHistoricoLocal(parteA, parteB) {
  const vistos = new Set();
  /** @type {{ codCliente: string, proc: number }[]} */
  const matches = [];

  for (const reg of listarRegistrosProcessosHistoricoNormalizados()) {
    const row = {
      codCliente: reg.codCliente,
      proc: reg.proc,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      autor: reg.parteCliente,
      reu: reg.parteOposta,
      cliente: reg.cliente,
    };
    if (!processoCorrespondePartes(row, parteA, parteB, reg.cliente)) continue;
    const k = chavePar(reg.codCliente, reg.proc);
    if (!k || vistos.has(k)) continue;
    vistos.add(k);
    matches.push({ codCliente: reg.codCliente, proc: reg.proc });
  }

  if (matches.length === 1) return { ok: true, ...matches[0], metodo: 'partes' };
  if (matches.length > 1) return { ok: false, motivo: 'ambiguo_partes', matches };
  return { ok: false, motivo: 'partes_nao_encontradas' };
}

/**
 * Localiza cliente×processo a partir do texto do compromisso.
 * 1) Número do processo (CNJ parcial) na API ou histórico local
 * 2) Parte cliente × parte oposta
 *
 * @param {string} textoCompromisso
 */
export async function buscarProcessoPorTextoCompromissoAgenda(textoCompromisso) {
  const texto = String(textoCompromisso ?? '').trim();
  if (!texto) return { ok: false, motivo: 'texto_vazio' };

  if (featureFlags.useApiProcessos) {
    const cnj = await buscarPorCnjApi(texto);
    if (cnj.ok) return cnj;
    if (cnj.motivo === 'ambiguo_cnj') return cnj;
  } else {
    const cnj = buscarPorCnjHistoricoLocal(texto);
    if (cnj.ok) return cnj;
    if (cnj.motivo === 'ambiguo_cnj') return cnj;
  }

  const partes = extrairPartesClienteOpostaDoTextoCompromisso(texto);
  if (!partes) {
    return { ok: false, motivo: 'nao_identificado' };
  }

  if (featureFlags.useApiProcessos) {
    const pr = await buscarPorPartesApi(partes.parteA, partes.parteB);
    if (pr.ok) return pr;
    if (pr.motivo === 'ambiguo_partes') return pr;
  }

  const prLocal = buscarPorPartesHistoricoLocal(partes.parteA, partes.parteB);
  if (prLocal.ok) return prLocal;
  if (prLocal.motivo === 'ambiguo_partes') return prLocal;

  return { ok: false, motivo: 'nao_encontrado' };
}

export function mensagemResultadoLocalizarProcesso(resultado) {
  if (!resultado || resultado.ok) return '';
  if (resultado.motivo === 'ambiguo_cnj' || resultado.motivo === 'ambiguo_partes') {
    const n = resultado.matches?.length ?? 0;
    return `Mais de um processo corresponde (${n}). Abra Processos e refine a busca.`;
  }
  if (resultado.motivo === 'sem_numero_processo' || resultado.motivo === 'cnj_nao_encontrado') {
    return 'Número do processo não encontrado na base. Tentou também pelas partes.';
  }
  if (resultado.motivo === 'partes_nao_encontradas') {
    return 'Não foi possível localizar o processo pelas partes indicadas no texto.';
  }
  if (resultado.motivo === 'nao_identificado') {
    return 'Texto sem número de processo nem partes no formato «Autor x Réu».';
  }
  return 'Processo não encontrado na base.';
}
