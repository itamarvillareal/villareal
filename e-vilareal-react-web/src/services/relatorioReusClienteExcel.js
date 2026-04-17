import { pesquisarCadastroPessoasPorNomeOuCpf, buscarCliente } from '../api/clientesService.js';
import {
  listarProcessosPorCodigoCliente,
  listarPartesProcesso,
  mapApiProcessoToUiShape,
} from '../repositories/processosRepository.js';
import { featureFlags } from '../config/featureFlags.js';
import { listarParesPorCodigoClienteHistorico } from '../data/buscaClienteProcFinanceiro.js';

function normalizarChaveNome(nome) {
  return String(nome ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function poloEhReu(poloRaw) {
  const pol = String(poloRaw ?? '').toUpperCase();
  if (!pol) return false;
  if (pol.includes('AUTOR') || pol.includes('REQUERENTE') || pol.includes('CLIENTE')) return false;
  return pol.includes('REU') || pol.includes('RÉU') || pol.includes('PASSIVO');
}

async function resolverNomeParaIdCadastro(nomeTexto) {
  const n = String(nomeTexto ?? '').trim();
  if (!n || n === '—') return { idPessoa: null, nomeReu: n, observacao: '' };
  try {
    const hits = await pesquisarCadastroPessoasPorNomeOuCpf(n, { apenasAtivos: false, limite: 40 });
    const arr = Array.isArray(hits) ? hits : [];
    const nLow = n.toLowerCase();
    const exact = arr.find((p) => String(p.nome ?? '').trim().toLowerCase() === nLow);
    if (exact) return { idPessoa: Number(exact.id), nomeReu: String(exact.nome).trim(), observacao: '' };
    if (arr.length === 1) {
      return { idPessoa: Number(arr[0].id), nomeReu: String(arr[0].nome).trim(), observacao: '' };
    }
    const pref = nLow.slice(0, Math.min(12, nLow.length));
    const starts = arr.filter((p) => String(p.nome ?? '').trim().toLowerCase().startsWith(pref));
    if (starts.length === 1) {
      return { idPessoa: Number(starts[0].id), nomeReu: String(starts[0].nome).trim(), observacao: '' };
    }
    if (arr.length > 1) {
      return {
        idPessoa: null,
        nomeReu: n,
        observacao: `${arr.length} pessoas semelhantes no cadastro; confira o ID manualmente.`,
      };
    }
    return { idPessoa: null, nomeReu: n, observacao: 'Não encontrado no cadastro de pessoas.' };
  } catch {
    return { idPessoa: null, nomeReu: n, observacao: 'Falha ao consultar cadastro de pessoas.' };
  }
}

function padCliente8Digits(val) {
  const d = String(val ?? '').replace(/\D/g, '');
  const n = Number(d || '1');
  const safe = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  return String(safe).padStart(8, '0');
}

/**
 * Lista processos do cliente (histórico local), extrai texto de réu e tenta casar com cadastro de pessoas.
 * @param {string} codPad
 * @param {(ev: { atual: number; total: number }) => void} [onProgress]
 */
async function exportarReusModoHistoricoLocal(codPad, onProgress) {
  const pares = listarParesPorCodigoClienteHistorico(codPad, { maxResults: 500 });
  const seen = new Map();
  const total = pares.length;
  let atual = 0;
  for (const row of pares) {
    atual += 1;
    onProgress?.({ atual, total });
    const nomeReu = String(row.reu ?? row.parteOposta ?? '').trim();
    if (!nomeReu || nomeReu === '—') continue;
    const key = normalizarChaveNome(nomeReu);
    if (seen.has(key)) continue;
    const r = await resolverNomeParaIdCadastro(nomeReu);
    seen.set(key, {
      codigoCliente: codPad,
      proc: String(row.proc ?? ''),
      nomeReu: r.nomeReu || nomeReu,
      numeroPessoaCadastro: r.idPessoa != null && Number.isFinite(r.idPessoa) ? r.idPessoa : '',
      observacao: r.observacao || '',
    });
  }
  return [...seen.values()];
}

/**
 * Via API: partes com polo de réu; se não houver, usa o texto «parte oposta» do processo.
 * @param {string} codPad
 * @param {(ev: { atual: number; total: number }) => void} [onProgress]
 */
async function exportarReusModoApi(codPad, onProgress) {
  const rawList = await listarProcessosPorCodigoCliente(codPad);
  const lista = Array.isArray(rawList) ? rawList : [];
  const unique = new Map();

  const juntarProcs = (a, b) => {
    const procs = new Set(
      [String(a ?? ''), String(b ?? '')]
        .join(',')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
    return [...procs].sort((x, y) => Number(x) - Number(y)).join(', ');
  };

  const upsertRow = (key, row) => {
    const ex = unique.get(key);
    if (!ex) {
      unique.set(key, { ...row });
      return;
    }
    unique.set(key, {
      ...ex,
      proc: juntarProcs(ex.proc, row.proc),
      observacao: [ex.observacao, row.observacao].filter(Boolean).join(' · ') || ex.observacao,
    });
  };

  let idx = 0;
  for (const raw of lista) {
    idx += 1;
    onProgress?.({ atual: idx, total: lista.length });
    const ui = mapApiProcessoToUiShape(raw);
    const procStr = String(ui.numeroInterno ?? '').trim();
    const processoId = ui.processoId;
    if (!processoId) continue;

    let partes = [];
    try {
      partes = await listarPartesProcesso(processoId);
    } catch {
      partes = [];
    }
    const reusPartes = (partes || []).filter((p) => poloEhReu(p.polo));

    const pushReuLinha = async (nomeBaseBruto) => {
      const nomeBase = String(nomeBaseBruto ?? '').trim();
      if (!nomeBase || nomeBase === '—') return;
      let idPessoa = NaN;
      let nome = nomeBase;
      let observacao = '';
      const r = await resolverNomeParaIdCadastro(nomeBase);
      if (r.idPessoa != null && Number.isFinite(Number(r.idPessoa)) && Number(r.idPessoa) >= 1) {
        idPessoa = Number(r.idPessoa);
        nome = r.nomeReu || nomeBase;
        observacao = r.observacao || '';
      } else {
        observacao = r.observacao || '';
      }
      const key = Number.isFinite(idPessoa) && idPessoa >= 1 ? `id:${idPessoa}` : `n:${normalizarChaveNome(nome)}`;
      upsertRow(key, {
        codigoCliente: codPad,
        proc: procStr,
        nomeReu: nome,
        numeroPessoaCadastro: Number.isFinite(idPessoa) && idPessoa >= 1 ? idPessoa : '',
        observacao,
      });
    };

    if (reusPartes.length > 0) {
      for (const parte of reusPartes) {
        let idPessoa = parte.pessoaId != null ? Number(parte.pessoaId) : NaN;
        let nome = String(parte.nomeLivre ?? '').trim();
        if (Number.isFinite(idPessoa) && idPessoa >= 1) {
          try {
            const pe = await buscarCliente(idPessoa);
            if (pe?.nome) nome = String(pe.nome).trim() || nome;
          } catch {
            /* mantém nomeLivre */
          }
        } else {
          idPessoa = NaN;
        }
        const textoCabeca = String(ui.parteOposta ?? '').trim();
        const nomeBase = nome || textoCabeca;
        if (!nomeBase) continue;

        if (Number.isFinite(idPessoa) && idPessoa >= 1) {
          const key = `id:${idPessoa}`;
          upsertRow(key, {
            codigoCliente: codPad,
            proc: procStr,
            nomeReu: nomeBase,
            numeroPessoaCadastro: idPessoa,
            observacao: '',
          });
        } else {
          await pushReuLinha(nomeBase);
        }
      }
    } else {
      await pushReuLinha(String(ui.parteOposta ?? '').trim());
    }
  }

  return [...unique.values()].sort((a, b) => {
    const na = Number(a.numeroPessoaCadastro) || 1e12;
    const nb = Number(b.numeroPessoaCadastro) || 1e12;
    if (na !== nb) return na - nb;
    return String(a.nomeReu).localeCompare(String(b.nomeReu), 'pt-BR');
  });
}

/**
 * Gera `.xlsx` com réus do cliente: nome e número (ID) no cadastro de pessoas quando localizado.
 *
 * @param {string|number} codigoClienteRaw
 * @param {(ev: { atual: number; total: number }) => void} [onProgress]
 * @returns {Promise<{ linhas: number; nomeArquivo: string }>}
 */
export async function exportarReusClienteParaExcel(codigoClienteRaw, onProgress) {
  const codPad = padCliente8Digits(codigoClienteRaw);
  let linhas;
  if (featureFlags.useApiProcessos) {
    linhas = await exportarReusModoApi(codPad, onProgress);
  } else {
    linhas = await exportarReusModoHistoricoLocal(codPad, onProgress);
  }

  if (!linhas.length) {
    throw new Error('Nenhum réu encontrado para este código de cliente (verifique processos e partes).');
  }

  const XLSX = await import('xlsx');
  const header = ['Código cliente', 'Proc.', 'Nome (réu / parte oposta)', 'Nº pessoa (cadastro)', 'Observação'];
  const aoa = [
    header,
    ...linhas.map((r) => [
      r.codigoCliente,
      r.proc,
      r.nomeReu,
      r.numeroPessoaCadastro === '' || r.numeroPessoaCadastro == null ? '' : Number(r.numeroPessoaCadastro),
      r.observacao || '',
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Réus');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
  const nomeArquivo = `reus_cliente_${codPad}_${stamp}.xlsx`;
  XLSX.writeFile(wb, nomeArquivo);
  return { linhas: linhas.length, nomeArquivo };
}
